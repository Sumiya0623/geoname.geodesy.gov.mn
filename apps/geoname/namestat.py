# -*- coding: utf-8 -*-
"""Нүүр хуудасны газрын зураг — ЗЗ нэгж бүрийн газар зүйн нэрийн тоо.

Нэвтрэлтгүй (AllowAny). Нэг хүсэлтээр газрын зурагт хэрэгтэй БҮХ зүйлийг өгнө:
нэгжийн хялбаршуулсан геометр, нийт нэрийн тоо, ангиллын (GEONAME_TYPES-ийн
хамгийн дээд түвшин: Байгаль / Хүний бүтээсэн / Засаг захиргаа) задаргаа.

  GET /api/n/name-stat/            → аймаг + нийслэл
  GET /api/n/name-stat/?parent=4   → тухайн аймгийн сум/дүүрэг
  GET /api/n/name-stat/?parent=91  → тухайн сумын баг/хороо

Хариу нь хүнд (геометр + бүлэглэсэн тоо, ~1с) тул process cache-д хадгална.
"""
import json

from django.contrib.gis.db.models import GeometryField
from django.contrib.gis.db.models.functions import AsGeoJSON
from django.core.cache import cache
from django.db import connection
from django.db.models import Count, FloatField, Func, Q, Value
from django.db.models.functions import Length
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from core.models import AdminUnit, Constant, GeoName

CACHE_TTL = 60 * 30          # 30 мин — нэр импорт ховор өөрчлөгддөг
LEVEL1 = 'Аймаг/Нийслэл'
LEVEL2 = 'Сум/Дүүрэг'
CAPITAL = 'Улаанбаатар'      # нийслэл — түүний хүүхдүүд нь дүүрэг


class Simplify(Func):
    """ST_SimplifyPreserveTopology — вэбд явуулах өмнө хилийг сийрэгжүүлнэ."""
    function = 'ST_SimplifyPreserveTopology'
    output_field = GeometryField()


# ---------------------------------------------------------------- helpers
def _type_index():
    """GEONAME_TYPES мод → (roots, subs, type_id → (root_id, sub_id)).

    root = 1-р түвшин (Байгаль/Хүний бүтээсэн/Засаг захиргаа),
    sub  = 2-р түвшин (Уул, Ус зүй, Суурьшил ...).
    """
    consts = {c.id: c for c in Constant.objects.filter(key='GEONAME_TYPES')}
    chain_cache = {}

    def chain(tid):
        if tid in chain_cache:
            return chain_cache[tid]
        out, cur, seen = [], consts.get(tid), set()
        while cur and cur.id not in seen:
            seen.add(cur.id)
            out.append(cur)
            cur = consts.get(cur.parent_id)
        out.reverse()                      # [root, sub, leaf...]
        chain_cache[tid] = out
        return out

    roots, subs, index = {}, {}, {}
    for tid in consts:
        ch = chain(tid)
        if not ch:
            continue
        root = ch[0]
        sub = ch[1] if len(ch) > 1 else None
        roots.setdefault(root.id, {'id': root.id, 'name': root.name,
                                   'code': root.code or ''})
        if sub is not None:
            subs.setdefault(sub.id, {'id': sub.id, 'name': sub.name,
                                     'root': root.id, 'code': sub.code or ''})
        index[tid] = (root.id, sub.id if sub else None)
    return roots, subs, index


def _agg(mapping):
    """{unit_id: group_id} → {group_id: {type_id: тоо}}.

    Нэг нэр аймаг БОЛОН сумд хоёуланд нь холбогддог тул бүлэг дотор
    COUNT(DISTINCT) хийж давхардлыг арилгана.
    """
    if not mapping:
        return {}
    vals = ','.join('(%d,%d)' % (u, g) for u, g in mapping.items())
    sql = f"""
        WITH rmap(unit_id, group_id) AS (VALUES {vals})
        SELECT r.group_id, g.type_id, COUNT(DISTINCT g.id)
        FROM core_geoname g
        JOIN core_geoname_unit gu ON gu.geoname_id = g.id
        JOIN rmap r ON r.unit_id = gu.adminunit_id
        WHERE g.is_approved AND g.type_id IS NOT NULL
        GROUP BY 1, 2
    """
    out = {}
    with connection.cursor() as cur:
        cur.execute(sql)
        for gid, tid, n in cur.fetchall():
            out.setdefault(gid, {})[tid] = n
    return out


def _located(mapping, units):
    """{unit_id: тодруулсан (байршилтай) нэрийн тоо}.

    Байршилтай нэр цөөн (нийт ~1000) тул M2M холбоос БОЛОН геометрийн
    огтлолцол хоёуланг нь авч, id-гаар нь давхардлыг арилгана.
    """
    by_group = {}
    if mapping:
        vals = ','.join('(%d,%d)' % (u, g) for u, g in mapping.items())
        sql = f"""
            WITH rmap(unit_id, group_id) AS (VALUES {vals})
            SELECT DISTINCT r.group_id, g.id
            FROM core_geoname g
            JOIN core_geoname_unit gu ON gu.geoname_id = g.id
            JOIN rmap r ON r.unit_id = gu.adminunit_id
            WHERE g.is_approved AND g.geoloc IS NOT NULL
        """
        with connection.cursor() as cur:
            cur.execute(sql)
            for gid, nid in cur.fetchall():
                by_group.setdefault(gid, set()).add(nid)
    for u in units:
        if not u.geom:
            continue
        ids = (GeoName.objects
               .filter(is_approved=True, geoloc__isnull=False,
                       geoloc__intersects=u.geom)
               .values_list('id', flat=True))
        by_group.setdefault(u.id, set()).update(ids)
    return {gid: len(ids) for gid, ids in by_group.items()}


def _bag_groups(units):
    """Баг/хорооны түвшний тоолол: {unit_id: {type_id: тоо}}.

    Импортолсон нэрс аймаг+сумд л холбогддог (баг руу бараг холбогдоогүй) тул
    энэ түвшинд M2M холбоос БОЛОН байршил (geoloc) хоёрын АЛЬ нэгээр нь авна.
    """
    out = {}
    for u in units:
        cond = Q(unit__id=u.id)
        if u.geom:
            cond |= Q(geoloc__isnull=False, geoloc__intersects=u.geom)
        rows = (GeoName.objects
                .filter(is_approved=True, type__isnull=False)
                .filter(cond)
                .values_list('type_id')
                .annotate(c=Count('id', distinct=True)))
        out[u.id] = {tid: c for tid, c in rows}
    return out


def _descendants(root_ids):
    """{unit_id: root_id} — өгсөн нэгжүүд + тэдгээрийн БҮХ удам."""
    parents = dict(AdminUnit.objects.values_list('id', 'parent_id'))
    mapping = {rid: rid for rid in root_ids}
    for uid in parents:
        cur, seen = uid, set()
        while cur is not None and cur not in seen:
            if cur in mapping:
                mapping[uid] = mapping[cur]
                break
            seen.add(cur)
            cur = parents.get(cur)
    return mapping


def _geometry(unit_ids, tolerance):
    """{unit_id: (geojson dict, [center], [bbox])} — хялбаршуулсан хил."""
    qs = (AdminUnit.objects.filter(id__in=unit_ids)
          .exclude(geom__isnull=True)
          .annotate(gj=AsGeoJSON(
              Simplify('geom', Value(tolerance, output_field=FloatField())),
              precision=4)))
    out = {}
    for u in qs:
        c = u.geom.point_on_surface
        out[u.id] = (json.loads(u.gj),
                     [round(c.x, 4), round(c.y, 4)],
                     [round(v, 4) for v in u.geom.extent])
    return out


def _units_payload(units, groups, index, tolerance, located=None):
    """AdminUnit жагсаалт + бүлэглэсэн тоо → газрын зурагт бэлэн бүтэц."""
    geoms = _geometry([u.id for u in units], tolerance)
    rows = []
    for u in units:
        per_type = groups.get(u.id, {})
        cats, subs, total = {}, {}, 0
        for tid, n in per_type.items():
            root_id, sub_id = index.get(tid, (None, None))
            if root_id is None:
                continue
            total += n
            cats[root_id] = cats.get(root_id, 0) + n
            if sub_id:
                subs[sub_id] = subs.get(sub_id, 0) + n
        gj, center, bbox = geoms.get(u.id, (None, None, None))
        rows.append({
            'id': u.id,
            'name': u.unit,
            'parent': u.parent_id,
            'count': total,
            'located': (located or {}).get(u.id, 0),
            'cats': cats,
            'subs': subs,
            'center': center,
            'bbox': bbox,
            'geometry': gj,
        })
    rows.sort(key=lambda r: -r['count'])
    return rows


def _build(parent_id):
    roots, subs, index = _type_index()
    capital = AdminUnit.objects.filter(level__name=LEVEL1,
                                       unit__icontains=CAPITAL).first()
    capital_id = capital.id if capital else None

    if parent_id:
        parent = AdminUnit.objects.filter(id=parent_id).first()
        if not parent:
            return None
        units = list(parent.children.all()
                     .select_related('level').order_by('unit'))
        is_bag = bool(units) and units[0].level_id and \
            (units[0].level.name or '').startswith('Баг')
        if is_bag:
            groups = _bag_groups(units)
            located = _located({u.id: u.id for u in units}, units)
            tolerance = 0.0015
        else:
            mapping = _descendants([u.id for u in units])
            groups = _agg(mapping)
            located = _located(mapping, units)
            tolerance = 0.004
        parent_info = {'id': parent.id, 'name': parent.unit,
                       'parent': parent.parent_id,
                       'level': (parent.level.name if parent.level else '')}
    else:
        parent = None
        units = list(AdminUnit.objects.filter(level__name=LEVEL1)
                     .order_by('unit'))
        mapping = _descendants([u.id for u in units])
        groups = _agg(mapping)
        located = _located(mapping, units)
        tolerance = 0.008
        parent_info = None

    rows = _units_payload(units, groups, index, tolerance, located)
    total = sum(r['count'] for r in rows)
    total_located = sum(r['located'] for r in rows)
    cat_total = {}
    for r in rows:
        for rid, n in r['cats'].items():
            cat_total[rid] = cat_total.get(rid, 0) + n

    bboxes = [r['bbox'] for r in rows if r['bbox']]
    bbox = ([min(b[0] for b in bboxes), min(b[1] for b in bboxes),
             max(b[2] for b in bboxes), max(b[3] for b in bboxes)]
            if bboxes else None)

    root_rows = [dict(r, count=cat_total.get(r['id'], 0))
                 for r in roots.values()]
    root_rows.sort(key=lambda r: -r['count'])
    used = {sid for r in rows for sid in r['subs']}

    return {
        'total': total,
        'located': total_located,
        'parent': parent_info,
        'roots': root_rows,
        'subs': [subs[s] for s in used if s in subs],
        'capital': capital_id,
        'bbox': bbox,
        'units': rows,
    }


def _facts(unit_id):
    """Сонгосон нутгийн нэрсийн онцлох 3 жагсаалт.

    common   — хамгийн их давтагдсан нэр (өөр өөр газарт ижил нэр)
    longest  — хамгийн урт нэр
    shortest — хамгийн богино нэр
    """
    qs = (GeoName.objects.filter(is_approved=True)
          .exclude(name__isnull=True).exclude(name=''))
    if unit_id:
        ids = list(_descendants([unit_id]))
        qs = qs.filter(unit__id__in=ids)
    common = [{'name': r['name'], 'value': r['c']}
              for r in qs.values('name')
              .annotate(c=Count('id', distinct=True))
              .order_by('-c', 'name')[:3]]
    by_len = qs.annotate(n=Length('name')).values('name', 'n').distinct()
    longest = [{'name': r['name'], 'value': r['n']}
               for r in by_len.order_by('-n', 'name')[:3]]
    shortest = [{'name': r['name'], 'value': r['n']}
                for r in by_len.order_by('n', 'name')[:3]]
    return {'common': common, 'longest': longest, 'shortest': shortest}


class NameStatViewSet(viewsets.ViewSet):
    """Нүүр хуудасны нэрийн статистик газрын зураг (нэвтрэлтгүй)."""
    permission_classes = [AllowAny]

    @action(detail=False, methods=['get'], url_path='facts')
    def facts(self, request):
        """?unit=<id> → тухайн нэгжийн (эс бөгөөс улсын) онцлох нэрс."""
        raw = (request.query_params.get('unit') or '').strip()
        unit_id = int(raw) if raw.isdigit() else None
        key = f'namestat:facts:v1:{unit_id or "all"}'
        data = cache.get(key)
        if data is None:
            data = _facts(unit_id)
            cache.set(key, data, CACHE_TTL)
        return Response(data, status=200)

    def list(self, request):
        raw = (request.query_params.get('parent') or '').strip()
        parent_id = int(raw) if raw.isdigit() else None
        key = f'namestat:v3:{parent_id or "root"}'
        data = cache.get(key)
        if data is None:
            data = _build(parent_id)
            if data is None:
                return Response({'detail': 'Нэгж олдсонгүй'}, status=404)
            cache.set(key, data, CACHE_TTL)
        return Response(data, status=200)
