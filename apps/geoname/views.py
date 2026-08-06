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
BASE_LAYER = 'raster:1970_100k'
HEADER_RIGHT = 'ХЭЭРИЙН ТОДРУУЛАЛТАД'
# PDF өөрөө бичдэг нэрсийн фонт. WMS style‑ийн шошготой ижил хэмжээтэй байх
# ёстой: style дээр 15px × PRINT_SYMBOL_SCALE(0.5) × dpi/90 ≈ 6pt.
LABEL_FONT_SIZE = 6      # нэрийн фонт (давхцвал жижгэрнэ — minLabelFontSize)


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
    """Ажлын зурагт сонгуулах сумд — [{id, unit, parent_id, parent}].

    ТӨСӨЛД БҮРТГЭГДСЭН ЗЗ нэгжээс гарна: unit нь сум бол өөрөө, аймаг бол
    түүний бүх сум. Төсөлд нэгж бүртгээгүй бол (хуучин төслүүд) тооллогын
    байршлаас авто тодорхойлно."""
    from .apiviews import SUM_LVL
    p = (Project.objects.prefetch_related('units__level', 'units__parent')
         .filter(id=project_id).first())
    rows, seen = [], set()
    if p:
        aimag_ids = []
        for u in p.units.all():
            if u.level_id and (u.level.name or '') == SUM_LVL:
                if u.id not in seen:
                    seen.add(u.id)
                    rows.append(u)
            else:
                aimag_ids.append(u.id)
        if aimag_ids:
            for u in (AdminUnit.objects.filter(parent_id__in=aimag_ids,
                                               level__name=SUM_LVL)
                      .select_related('parent')):
                if u.id not in seen:
                    seen.add(u.id)
                    rows.append(u)
    if not rows:
        # Нэгж бүртгээгүй төсөл — тооллогын байршлаас
        u = project_union(project_id)
        if u is None:
            return []
        rows = list(AdminUnit.objects.filter(level__name=SUM_LVL,
                                             geom__intersects=u)
                    .select_related('parent'))
    rows.sort(key=lambda r: ((r.parent.unit if r.parent_id else ''), r.unit or ''))
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
    # Хилийн цэс — төлөв биш ч таних тэмдэгт тусдаа мөрөөр тоологдоно
    border_label, border_color, border_count = 'Хилийн цэс', '#b45309', 0
    for f in feats:
        props = f.get('properties') or {}
        ids = [s for s in str(props.get('status_ids') or '').split() if s.isdigit()]
        names = [n for n in (consts.get(int(s)) for s in ids) if n]
        f['_colors'] = [colors.get(n, RECOUNT_STATUS_FALLBACK) for n in names]
        for n in names:
            counts[n] = counts.get(n, 0) + 1
        if props.get('is_border') in (True, 'true', 'True', 1):
            border_count += 1
    legend = [{'name': c.name, 'color': colors[c.name],
               'count': counts.get(c.name, 0)} for c in rows]
    legend.append({'name': border_label, 'color': border_color,
                   'count': border_count})
    return feats, legend


def _border_name_ids(unit_ids, is_sum):
    """Сонгосон нэгжийн ТҮВШНИЙ зааг дээрх хилийн цэс → (geoname_ids, recount_ids).

    Хилийн цэс нь borderunit (олон нэгж)‑ээр тодорхойлогдоно:
      • сум сонгосон  → 2+ ӨӨР СУМД харьяалагдсан, нэг нь сонгосон сум
      • аймаг сонгосон → 2+ ӨӨР АЙМАГТ харьяалагдсан, нэг нь сонгосон аймаг
        (сумын хоорондох зааг дээрх цэс аймгийн зурагт орохгүй)
    """
    from .apiviews import AIMAG_LVL, SUM_LVL
    from core.models import GeoName
    sel = set(int(x) for x in unit_ids)

    def _match(obj):
        # Түвшин бүрийг ТУСАД нь цуглуулна. Баг сонгогдсон байвал түүний
        # эцэг сум, өвөг аймгийг л тооцно — БАГИЙН id нь аймгийн жагсаалтад
        # орохгүй (эс бөгөөс 2 багийн зааг = аймгийн зааг мэт болно).
        sums, aimags = set(), set()
        for u in obj.borderunit.all():
            lvl = (u.level.name or '') if u.level_id else ''
            if lvl == AIMAG_LVL:
                aimags.add(u.id)
            elif lvl == SUM_LVL:
                sums.add(u.id)
                if u.parent_id:
                    aimags.add(u.parent_id)
            else:  # Баг/Хороо (эсвэл түүнээс доод) — эцэг сум, өвөг аймгаар
                if u.parent_id:
                    sums.add(u.parent_id)
                    par = u.parent
                    if par is not None and par.parent_id:
                        aimags.add(par.parent_id)
        if is_sum:
            # СУМ сонгосон — тухайн суманд ЭСВЭЛ түүнтэй хиллэсэн гэж
            # заасан цэс. Харьяалал заагаагүй бол ч орон зайн шүүлтээр орно.
            if not sums and not aimags:
                return True
            return bool(sums & sel)
        # АЙМАГ сонгосон — сонгосон аймгаас ӨӨР аймагтай хиллэсэн цэс л.
        # (нэг аймгийн доторх сум/багийн зааг дээрх цэс аймгийн зурагт орохгүй)
        return bool(aimags - sel)

    gids = [g.id for g in GeoName.objects.filter(is_border=True)
            .prefetch_related('borderunit__level', 'borderunit__parent__parent')
            if _match(g)]
    # Батлагдсан нэргүй (draft) тодруулалтын хилийн цэс — ReCount дээрээ
    rids = [r.id for r in ReCount.objects.filter(is_border=True, name__isnull=True)
            .prefetch_related('borderunit__level', 'borderunit__parent__parent')
            if _match(r)]
    return gids, rids


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

def build_params(unit_ids, project_id, dpi=200, corner_left=None,
                 is_border=False):
    """Ажлын зургийн mapprint params + meta. Нэрийн зургийн _build_params‑аас
    БҮРЭН тусдаа (DEM/индекс/geoname_view давхаргагүй).

    is_border=True бол ЗӨВХӨН хилийн цэсийг (сонгосон нэгжид холбогдсоныг) зурна."""
    from .apiviews import (
        AIMAG_LVL, SUM_LVL, _union_geom, _geom_rings, _buffer_band_rings,
        _bordering_units, _shared_border_dense)
    from apps.geoserver.apiviews import (
        GEONAME_WS, RECOUNT_VIEW, _GEONAME_TYPE_STYLE, ensure_geoname_type_style)
    # Ангиллын таних тэмдэг бүхий style (geoname_view‑тэй ижил баганатай тул
    # recount_view‑д мөн хүчинтэй)
    try:
        ensure_geoname_type_style()
    except Exception:
        pass
    RECOUNT_STYLE = f'{GEONAME_WS}:{_GEONAME_TYPE_STYLE}'
    # Нэрсийг WMS давхарга ӨӨРӨӨ бичнэ: үндсэн style‑ээс ҮҮСМЭЛ named style
    # (geoname_types_p<dpi>) — бүх шошгыг харуулах vendor option + тухайн dpi‑д
    # тохируулсан scale denominator. ҮНДСЭН STYLE ХЭВЭЭР (PDF талд
    # featureLabels=False тул нэр давхар бичигдэхгүй).
    _print_style = mapprint.ensure_print_style(
        GEONAME_WS, _GEONAME_TYPE_STYLE, dpi)
    # Style дотор шошгын дүрэмтэй ангиллууд — үлдсэнийх нь нэрийг PDF бичнэ
    try:
        _labeled_types = mapprint.sld_label_type_ids(
            mapprint.fetch_style_sld(GEONAME_WS, _GEONAME_TYPE_STYLE))
    except Exception:
        _labeled_types = set()

    union = _union_geom(unit_ids)
    if union is None:
        return None
    units = list(AdminUnit.objects.filter(id__in=unit_ids)
                 .select_related('parent', 'level'))
    is_sum = bool(units and units[0].level_id
                  and units[0].level.name == SUM_LVL)
    grid_minutes = 5.0 if is_sum else 15.0
    # Хөрш нэгжийн түвшин = сонгосныхтой ИЖИЛ. Аймгийн зураг дээр дотоод
    # сумдын хил зурагдахгүй (зөвхөн хөрш АЙМГИЙН хил).
    nb_level = SUM_LVL if is_sum else AIMAG_LVL

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
    if is_border:
        cql += ' AND is_border=true'
        if not is_sum:
            # АЙМГИЙН зураг — зөвхөн АЙМГИЙН зааг дээрх цэс. borderunit нь
            # «нөгөө талд аль нэгж байна» гэдгийг заадаг тул сонгосон аймгаас
            # ӨӨР аймаг заасан цэс л аймгийн хил дээрх болно (сум/багийн
            # хоорондох цэс аймгийн зурагт орохгүй).
            gids, rids = _border_name_ids(unit_ids, False)
            parts = []
            if gids:
                parts.append('name_id IN (%s)' % ','.join(str(i) for i in gids))
            if rids:
                parts.append('id IN (%s)' % ','.join(str(i) for i in rids))
            cql += (' AND (%s)' % ' OR '.join(parts)) if parts else ' AND id=-1'
        # СУМЫН зураг — сумын дотор буй БҮХ хилийн цэс (орон зайн шүүлт хангалттай)
    features, status_legend = recount_features(cql)
    # WMS style шошголохгүй ангиллын нэрийг PDF өөрөө бичнэ (нэргүй үлдэхгүй)
    if _print_style and _labeled_types:
        for f in features:
            try:
                tid = int((f.get('properties') or {}).get('type_id') or 0)
            except (TypeError, ValueError):
                tid = 0
            if tid not in _labeled_types:
                f['_label'] = True
    elif not _print_style:
        # Үүсмэл style үүсээгүй — үндсэн style шошголохгүй тул бүгдийг PDF бичнэ
        for f in features:
            f['_label'] = True

    boundary = _geom_rings(union)
    buffer_rings = _buffer_band_rings(union)
    neighbors = []
    for b in _bordering_units(union, nb_level, unit_ids):
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
        # Тодруулалтын ДҮРС ба НЭРИЙГ хоёуланг нь GeoServer‑ийн WMS давхарга
        # (ангиллын таних тэмдэг бүхий style) зурна — шошгыг нэг ч алгасахгүй
        # (SLD_BODY дээр conflictResolution=false). PDF нь зөвхөн төлвийн
        # өнгөт зураасыг нэмнэ (featureMarks=False, featureLabels=False).
        'layers': [
            # Арын сканердсан зураг — 0.75 тунгалаг (тодруулалт тод харагдана)
            {'type': 'wms', 'layerFullName': BASE_LAYER,
             'name': 'Нэрийн зураг (М1:100000)', 'opacity': 0.75,
             'visible': True},
            {'type': 'wms', 'layerFullName': f'{GEONAME_WS}:{RECOUNT_VIEW}',
             'name': 'Тодруулалт', 'opacity': 1.0, 'visible': True,
             'cql': cql,
             # Үүсмэл style (бүх шошго + dpi‑д тохирсон масштаб). Үүсгэж
             # чадаагүй бол үндсэн style‑аар л зурна.
             'styles': _print_style or RECOUNT_STYLE,
             # dpi тохируулга үүсмэл style дотор аль хэдийн хийгдсэн —
             # mapprint дахин SLD_BODY болгож дарж бичих ёсгүй.
             'noDpiSld': True},
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
            'features': features,            # style шошголдоггүй нэрсийг бичнэ
            'featureMarks': False,           # дүрсийг WMS давхарга зурна
            'featureLabels': False,          # нэрийг ч WMS давхарга бичнэ
            'featureBars': False,            # нэрийн доор төлвийн зураас ТАВИХГҮЙ
            'statusLegend': status_legend,   # төлөв бүрийн өнгө + тоо
            'labelFontSize': LABEL_FONT_SIZE,
            'minLabelFontSize': 4.5,   # давхцвал ийш нь хүртэл жижгэрнэ
        },
    }
    meta = {'scale': scale, 'name_count': len(features), 'title': title,
            'widthMM': fit['widthMM'], 'heightMM': fit['heightMM'],
            'orientation': fit['orientation'], 'gridMinutes': int(grid_minutes),
            'status_legend': status_legend}
    return params, meta
