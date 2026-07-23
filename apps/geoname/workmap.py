# -*- coding: utf-8 -*-
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

# Дахин тооллогын төлөв бүрийн ӨНГӨ — frontend recountStatus.js‑тэй ЯГ ижил
RECOUNT_STATUS_COLORS = {
    'ижил': '#2563eb',
    'байршил': '#dc2626',
    'батлагдаагүй': '#f59e0b',
    'алдаатай': '#7c3aed',
    'шинэ': '#16a34a',
}
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
    consts = {c.id: c.name for c in
              Constant.objects.filter(key='RECOUNT_STATUS').order_by('id')}
    counts = {name: 0 for name in consts.values()}
    for f in feats:
        props = f.get('properties') or {}
        ids = [s for s in str(props.get('status_ids') or '').split() if s.isdigit()]
        names = [n for n in (consts.get(int(s)) for s in ids) if n]
        f['_colors'] = [RECOUNT_STATUS_COLORS.get(n, RECOUNT_STATUS_FALLBACK)
                        for n in names]
        for n in names:
            counts[n] = counts.get(n, 0) + 1
    legend = [{'name': n,
               'color': RECOUNT_STATUS_COLORS.get(n, RECOUNT_STATUS_FALLBACK),
               'count': counts.get(n, 0)} for n in consts.values()]
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
