"""Газар зүйн нэрийн апп — БАЙНЫН (backend) үйлдлүүд.

Энд зөвхөн сервер талд гүйцэтгэгддэг зүйлс байна:
  • Лавлагааны баримт (HTML/PDF) — /inquire/<code>/
  • Хээрийн судалгааны АЖЛЫН ЗУРАГ (A0 PDF) бэлдэх — mapprint‑д дамжуулах
    параметр бүтээх туслахууд.
Frontend рүү өгөгдөл дамжуулдаг API‑ууд нь apiviews.py дотор байрлана.
"""

# ======================================================================
# ЛАВЛАГААНЫ БАРИМТ (GeoNameInquire) — QR‑аар шалгах хуудастай
# ======================================================================

import json

from django.conf import settings
from django.shortcuts import render, get_object_or_404
from django.utils import timezone

from core.models import GeoNameInquire, AdminUnit


def _current_domain(request):
    return f"{request.scheme}://{request.get_host()}"


def _type_path(geoname):
    chain, c, seen = [], geoname.type, set()
    while c and c.id not in seen:
        seen.add(c.id)
        chain.append(c.name)
        c = c.parent
    chain.reverse()
    return ' › '.join(chain)


def _utm_epsg(lon):
    """Уртрагаас UTM бүсийн EPSG (умард хагас бөмбөрцөг) — урт/талбай тооцоход."""
    zone = int((lon + 180) / 6) + 1
    return 32600 + zone


def _dms(value, is_lat):
    """Аравтын градусыг DMS (град°мин'сек")‑т — секунд таслалын 1 орны нарийвчлалтай."""
    hemi = ('N' if value >= 0 else 'S') if is_lat else ('E' if value >= 0 else 'W')
    v = abs(value)
    d = int(v)
    m_full = (v - d) * 60
    m = int(m_full)
    s = (m_full - m) * 60
    return f"{d}°{m:02d}'{s:04.1f}\"{hemi}"


def _mn_date(d):
    """Огноо: «2003.09.30»."""
    return f'{d.year}.{d.month:02d}.{d.day:02d}' if d else ''


# Геометрийн төрөл → баруун баганын гарчиг. Template дотор {% if %}{% elif %}
# бичихээс зайлсхийв — HTML форматтер уг мөрийг таслахад Django таг эвдэрдэг.
_MEASURE_LABELS = {'point': 'Солбицол', 'line': 'Урт', 'area': 'Талбай'}


def _measure(geom):
    """Геометрийн төрлөөр хэмжээ: цэг→солбицол(DMS), шугам→урт, талбай→км².
    Урт/талбайг геометрийн центроидын UTM бүс рүү хувиргаж тооцно.
    Буцаах dict‑д template‑д шууд хэвлэх `label` талбар багтана."""

    def out(kind, text, **extra):
        return {'kind': kind, 'text': text,
                'label': _MEASURE_LABELS.get(kind, 'Байрлал'), **extra}

    if not geom:
        return out(None, '—')
    gt = geom.geom_type
    if gt == 'Point':
        return out('point', f'{_dms(geom.y, True)}, {_dms(geom.x, False)}',
                   lat=geom.y, lon=geom.x)
    try:
        c = geom.centroid
        epsg = _utm_epsg(c.x)
        g2 = geom.clone()
        g2.transform(epsg)
        if 'Line' in gt:
            m = g2.length
            txt = f'{m/1000:.3f} км' if m >= 1000 else f'{m:.1f} м'
            return out('line', txt)
        if 'Polygon' in gt:
            km2 = g2.area / 1_000_000.0
            return out('area', f'{km2:.1f} км²')
    except Exception:
        pass
    return out(gt, '—')


def _admin_overlaps(geom):
    """Объекттой ДАВХЦАХ (intersects) Аймаг/Нийслэл + Сум/Дүүрэг нэгжүүд."""
    if not geom:
        return []
    qs = (AdminUnit.objects
          .filter(geom__intersects=geom,
                  level__name__in=['Аймаг/Нийслэл', 'Сум/Дүүрэг'])
          .select_related('level', 'parent')
          .order_by('level__name', 'unit'))
    out = []
    for u in qs:
        out.append({'level': u.level.name if u.level else '',
                    'name': u.unit,
                    'parent': u.parent.unit if u.parent_id else ''})
    return out


def _inquire_context(request, inq):
    g = inq.name
    geom = g.geoloc if g else None
    now = timezone.now()
    valid = bool(g and g.is_approved) and (inq.valid_until is None or inq.valid_until >= now)
    # Эрх зүйн баримт (батлагдсан) — LegalOrder
    orders = [{'name': o.name,
               'type': (o.type.name if o.type_id else ''),
               'org': (o.org.name if o.org_id else ''),
               'number': (f'№ {o.order_number}' if o.order_number else ''),
               'date': _mn_date(o.order_date)}
              for o in (g.legalorders.select_related('type', 'org').all() if g else [])]
    # Зураг (generic FK) — desc‑тэй
    from django.contrib.contenttypes.models import ContentType
    from core.models import Photo, GeoName
    ct = ContentType.objects.get_for_model(GeoName)
    photos = [{'url': (p.file.url if p.file else ''), 'desc': p.desc or ''}
              for p in Photo.objects.filter(content_type=ct, object_id=g.id)] if g else []
    # Тодруулалт (ReCount) — "<он> онд '<төсөл>' гэрээт ажлын хүрээнд тодруулсан"
    recounts = []
    for r in (g.recounts.select_related('project').all() if g else []):
        recounts.append({
            'year': r.created_date.year if getattr(r, 'created_date', None) else '',
            'project': (r.project.name if r.project_id else ''),
        })
    # Засаг захиргаа — газрын зургийн баруун талд хүснэгтгүйгээр нэг мөрөнд:
    # "Хөвсгөл аймаг, Баянзүрх сум"
    admins = _admin_overlaps(geom)
    parts = []
    for a in admins:
        name = a['name']
        if not name:
            continue
        if 'Аймаг' in a['level']:
            suffix = 'нийслэл' if 'Улаанбаатар' in name else 'аймаг'
        elif 'Сум' in a['level']:
            suffix = 'дүүрэг' if 'Улаанбаатар' in (a['parent'] or '') else 'сум'
        else:
            suffix = ''
        parts.append(f'{name} {suffix}'.strip())
    admin_text = ', '.join(parts)
    geojson = json.loads(geom.geojson) if geom else None
    requester = ''
    if inq.user:
        requester = (getattr(inq.user, 'full_name', '') or inq.user.get_full_name()
                     or inq.user.username or '')
    valid_until_str = (inq.valid_until.strftime('%Y-%m-%d')
                       if inq.valid_until else 'хугацаагүй')
    return {
        'requester': requester,
        'valid_until_str': valid_until_str,
        'current_domain': _current_domain(request),
        'inq': inq,
        'g': g,
        'valid': valid,
        'type_path': _type_path(g) if g else '',
        'measure': _measure(geom),
        'admins': admins,
        'admin_text': admin_text,
        'orders': orders,
        'photos': photos,
        'recounts': recounts,
        'geojson': json.dumps(geojson) if geojson else 'null',
        'coord_system': 'WGS84 (EPSG:4326)',
        # QR нь FRONTEND‑ийн хүчинтэй шалгах хуудас руу (лавлагааны дугаараар)
        'verify_url': f"{(settings.MY_FRONT_DOMAIN or '').rstrip('/')}/inquire/{inq.code}",
    }


def inquire_document(request, code):
    """Лавлагааны баримт (босоо A4, амьд газрын зураг, хэсгүүд, QR)."""
    inq = get_object_or_404(
        GeoNameInquire.objects.select_related('name', 'name__type', 'user'),
        code=code)
    return render(request, 'inquire/geonameInquire.html', _inquire_context(request, inq))


# ======================================================================
# ХЭЭРИЙН СУДАЛГААНЫ АЖЛЫН ЗУРАГ (A0 PDF) — mapprint‑ийн параметр бэлдэнэ
# ======================================================================

"""Хээрийн тодруулалтын АЖЛЫН ЗУРАГ — газар зүйн нэрийн зургаас ТУСДАА хөдөлгүүр.

Нэрийн зураг (apiviews._build_params) нь DEM + geoname_view WMS дээр тулгуурладаг
бол ажлын зураг нь:
  - Арын зураг: сканердсан байр зүйн "Нэрийн зураг" (raster:m100k_1984), DEM‑гүй
  - Дата: recount_view‑г WFS‑ээр татаж, PDF рүү ШУУД зурна (шошго давхцахгүй)
  - Таних тэмдэг: тооллогын ТӨЛӨВ бүрийн өнгө + тоо (вебийн RecountLegend хэлбэр)
  - Индексийн торгүй, гарчиг '... газар зүйн нэрийн тодруулалт'

Хамтын геометрийн туслахуудыг (union/rings/хөрш сум) apiviews‑аас ЗААВАЛ функц
дотроос импортолно — модуль хоорондын дугуй импортоос сэргийлнэ.
"""
import math

from core.models import AdminUnit, Constant, Project, ReCount

from . import mapprint

# Дахин тооллогын төлвийн ӨНГӨ нь Constant(RECOUNT_STATUS).color дээр
# хадгалагддаг (frontend‑тэй нэг эх сурвалж). Энд статик жагсаалт барихгүй.
RECOUNT_STATUS_FALLBACK = '#64748b'

# Арын зураг — сканердсан байр зүйн зураг М1:100000 (BaseMapLayer: M100kGeoName)
BASE_LAYER = 'raster:m100k_1984'
HEADER_RIGHT = 'ХЭЭРИЙН ТОДРУУЛАЛТАД'
LABEL_FONT_SIZE = 9      # нэрийн фонт (давхцвал 0.6 хүртэл өөрөө жижгэрнэ)


# ---------------------------------------------------------------- төслийн дата

def project_union(project_id):
    """Төслийн дахин тооллогын байршлуудын union (loc, эс бол нэрийн geoloc)."""
    from django.contrib.gis.db.models import Union as GisUnion
    from core.models import GeoName
    agg = ReCount.objects.filter(
        project_id=project_id, loc__isnull=False).aggregate(u=GisUnion('loc'))
    u = agg.get('u')
    if u is None:
        agg = GeoName.objects.filter(recounts__project_id=project_id).exclude(
            geoloc__isnull=True).aggregate(u=GisUnion('geoloc'))
        u = agg.get('u')
    return u


def project_units(project_id):
    """Тооллогын цэгүүд оногдох сумд (авто сонголт) — [{id, unit, parent}]."""
    from .apiviews import SUM_LVL
    u = project_union(project_id)
    if u is None:
        return []
    rows = (AdminUnit.objects.filter(level__name=SUM_LVL, geom__intersects=u)
            .select_related('parent').order_by('unit'))
    return [{'id': r.id, 'unit': r.unit, 'parent_id': r.parent_id,
             'parent': (r.parent.unit if r.parent_id else None)} for r in rows]


def project_corner(project_id):
    """Зүүн доод булангийн мөрүүд — гүйцэтгэгч / гэрээний дугаар / огноо."""
    p = Project.objects.select_related('org').filter(id=project_id).first()
    if not p:
        return []
    org = ''
    if p.org_id:
        org = (getattr(p.org, 'full_name', '') or p.org.get_full_name()
               or p.org.username or '')
    lines = []
    if org:
        lines.append(f'Гүйцэтгэгч: {org}')
    if p.dugaar and p.dugaar != 'un':
        lines.append(f'Гэрээний дугаар: {p.dugaar}')
    if p.signed_date:
        lines.append(f'Огноо: {p.signed_date.strftime("%Y.%m.%d")}')
    return lines


def recount_features(cql):
    """recount_view‑г WFS‑ээр татаж, дүрс бүрд төлөвийн өнгө ононо.
    → (features, status_legend[{name, color, count}])."""
    from apps.geoserver.apiviews import (
        GEONAME_WS, RECOUNT_VIEW, ensure_recount_view)
    try:
        ensure_recount_view()
    except Exception:
        pass
    feats = mapprint.fetch_wfs_features(f'{GEONAME_WS}:{RECOUNT_VIEW}', cql=cql)
    rows = list(Constant.objects.filter(key='RECOUNT_STATUS').order_by('id'))
    consts = {c.id: c.name for c in rows}
    colors = {c.name: (c.color or '').strip() or RECOUNT_STATUS_FALLBACK
              for c in rows}
    counts = {c.name: 0 for c in rows}
    for f in feats:
        props = f.get('properties') or {}
        ids = [s for s in str(props.get('status_ids') or '').split() if s.isdigit()]
        names = [n for n in (consts.get(int(s)) for s in ids) if n]
        f['_colors'] = [colors.get(n, RECOUNT_STATUS_FALLBACK) for n in names]
        for n in names:
            counts[n] = counts.get(n, 0) + 1
    legend = [{'name': c.name, 'color': colors[c.name],
               'count': counts.get(c.name, 0)} for c in rows]
    return feats, legend


def build_title(units):
    """'<Аймаг> аймгийн <Сум...> сумын газар зүйн нэрийн тодруулалт'."""
    parents, sums = [], []
    for u in units:
        sums.append(u.unit)
        if u.parent_id and u.parent.unit not in parents:
            parents.append(u.parent.unit)
    if parents:
        return (f"{', '.join(parents)} аймгийн {', '.join(sums)} сумын "
                f"газар зүйн нэрийн тодруулалт")
    return f"{', '.join(sums)} аймгийн газар зүйн нэрийн тодруулалт"


# ------------------------------------------------------------------ params

def build_params(unit_ids, project_id, dpi=200, corner_left=None):
    """Ажлын зургийн mapprint params + meta. Нэрийн зургийн _build_params‑аас
    БҮРЭН тусдаа (DEM/индекс/geoname_view давхаргагүй)."""
    from .apiviews import (
        SUM_LVL, _union_geom, _geom_rings, _buffer_band_rings,
        _bordering_units, _shared_border_dense)

    union = _union_geom(unit_ids)
    if union is None:
        return None
    units = list(AdminUnit.objects.filter(id__in=unit_ids)
                 .select_related('parent', 'level'))
    is_sum = bool(units and units[0].level_id
                  and units[0].level.name == SUM_LVL)
    grid_minutes = 5.0 if is_sum else 15.0

    # Хилээс ГАДАГШ ~1км амьсгаа (хүрээнд наалдахгүй хэрийн бага зай)
    u_buf = union
    try:
        u3857 = union.transform(3857, clone=True)
        u_buf = u3857.buffer(1000.0).transform(4326, clone=True)
    except Exception:
        pass
    x0, y0, x1, y1 = u_buf.extent
    px, py = (x1 - x0) * 0.005, (y1 - y0) * 0.005
    fit = mapprint.fit_layout([x0 - px, y0 - py, x1 + px, y1 + py])
    # Захын шошго багтах зай — цаасан дээр ~8мм (индексийн тор байхгүй)
    margin_m = 0.008 * fit['scale']
    clat = math.cos(math.radians((y0 + y1) / 2.0)) or 1.0
    dlat = margin_m / 111000.0
    dlon = margin_m / (111000.0 * clat)
    fit = mapprint.fit_layout([x0 - px - dlon, y0 - py - dlat,
                               x1 + px + dlon, y1 + py + dlat])
    scale, bbox = fit['scale'], fit['bbox']

    # Тооллогын дата — сонгосон хилд багтах, тухайн төслийнх (WFS)
    wkt = (union.simplify(0.004, preserve_topology=True) or union).wkt
    cql = f"project_id={int(project_id)} AND INTERSECTS(geoloc, {wkt})"
    features, status_legend = recount_features(cql)

    boundary = _geom_rings(union)
    buffer_rings = _buffer_band_rings(union)
    neighbors = []
    for b in _bordering_units(union, SUM_LVL, unit_ids):
        cen = b.geom.centroid
        nb = {'name': b.unit, 'rings': _geom_rings(b.geom),
              'cx': round(cen.x, 6), 'cy': round(cen.y, 6),
              'border': _shared_border_dense(union, b.geom)}
        try:
            nb['band'] = _buffer_band_rings(b.geom)
        except Exception:
            nb['band'] = []
        neighbors.append(nb)

    title = build_title(units)
    params = {
        'paper': {'format': 'custom', 'widthMM': float(fit['widthMM']),
                  'heightMM': float(fit['heightMM']), 'marginMM': 8.0,
                  'orientation': fit['orientation']},
        'map': {'bbox': bbox, 'scale': scale, 'dpi': dpi, 'rotation': 0},
        # Зөвхөн сканердсан байр зүйн зураг (DEM‑гүй). Тооллогын цэгүүдийг
        # WMS‑ээр биш, доорх features‑ээс PDF рүү шууд зурна.
        'layers': [
            {'type': 'wms', 'layerFullName': BASE_LAYER,
             'name': 'Нэрийн зураг (М1:100000)', 'opacity': 1.0, 'visible': True},
        ],
        'layout': {
            'titleText': '', 'subtitle': title,
            'showLegend': False, 'showNorthArrow': True, 'showGrid': True,
            'showScaleBar': True, 'showScaleValue': True, 'adjacentNomeks': {},
            'showIndexGrid': False,          # нэрийн индекс — ажлын зураг дээр хэрэггүй
            'boundary': boundary, 'neighbors': neighbors, 'buffer': buffer_rings,
            'gridMinutes': grid_minutes,
            'cornerLeft': [ln for ln in (corner_left or []) if ln] or None,
            'headerRight': HEADER_RIGHT,
            'features': features,            # WFS дүрсүүд (PDF дээр өөрсдөө зурна)
            'statusLegend': status_legend,   # төлөв бүрийн өнгө + тоо
            'labelFontSize': LABEL_FONT_SIZE,
        },
    }
    meta = {'scale': scale, 'name_count': len(features), 'title': title,
            'widthMM': fit['widthMM'], 'heightMM': fit['heightMM'],
            'orientation': fit['orientation'], 'gridMinutes': int(grid_minutes),
            'status_legend': status_legend}
    return params, meta
