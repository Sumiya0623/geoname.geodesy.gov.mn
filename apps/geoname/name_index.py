# -*- coding: utf-8 -*-
"""Нэрийн ИНДЕКСИЙН схем зураг — хүсэлтийн маягтын «Байршлын зураг» мөрд.

Хээрийн ажлын А0 нэрийн зураг хэвлэхэд сумын хил дээр 10см (цаасан дээр)‑ийн
индексийн тор тавьж, багануудыг 1,2,3.. (зүүн→баруун), мөрүүдийг А,Б,В..
(дээш→доош) дугаарладаг (mapprint.draw_index_grid). Хүсэлтийн маягт дээр ЯГ
ижил торыг дахин тооцоолж, тухайн байршлыг тэмдэглэсэн схемийг SVG‑ээр гаргана
— ингэснээр маягт дээрх индекс (ж: «В-2») хэвлэсэн зурагтай таарна.

SVG сонгосон шалтгаан: wkhtmltopdf нь inline SVG‑г вектороор гаргадаг тул
нэмэлт сан (matplotlib/PIL) шаардахгүй, PDF дотор тод хэвээр үлдэнэ.
"""

import math
import base64
import logging
from io import BytesIO

import requests
from PIL import Image, ImageDraw
from django.conf import settings
from django.contrib.gis.geos import Point, Polygon

from core.models import AdminUnit

from .mapprint import (fit_layout, _MN_INDEX_LETTERS, _lon_to_tile_x,
                       _lat_to_tile_y, _tile_to_lon, _tile_to_lat)

logger = logging.getLogger(__name__)

# Байр зүйн зураг — GeoServer‑ийн растер давхарга ба хүрээний zoom түвшин.
# Хүрээ = цэгийг агуулах web‑mercator ХАВТАН (tile) — «zoom 12 дээр тохируулсан
# хүрээ» гэдэг нь энэ (≈6 км).
TOPO_LAYER = "raster:1970"
TOPO_ZOOM = 12

# Дэлхийн радиусын ойролцоолол — mapprint‑ийнхтэй ИЖИЛ байх ёстой, эс бөгөөс
# индексийн нүд хэвлэсэн зурагтай таарахгүй.
_M_PER_DEG_LAT = 110540.0
_M_PER_DEG_LON = 111320.0

_SUM_LEVEL = "Сум/Дүүрэг"


def _print_scale(unit_geom):
    """Тухайн нэгжийн А0 нэрийн зургийн масштаб — apiviews‑ийн хэвлэх урсгалтай
    ижил (5км буфер → 2% зай → fit → 90мм захын нэмэлт → дахин fit)."""
    try:
        buf = unit_geom.transform(3857, clone=True).buffer(5000)
        u_buf = buf.transform(4326, clone=True)
    except Exception:
        u_buf = unit_geom
    x0, y0, x1, y1 = u_buf.extent
    px, py = (x1 - x0) * 0.02, (y1 - y0) * 0.02
    fit = fit_layout([x0 - px, y0 - py, x1 + px, y1 + py])
    margin_m = 0.09 * fit["scale"]
    clat = math.cos(math.radians((y0 + y1) / 2.0)) or 1.0
    dlat = margin_m / 111000.0
    dlon = margin_m / (111000.0 * clat)
    fit = fit_layout([x0 - px - dlon, y0 - py - dlat,
                      x1 + px + dlon, y1 + py + dlat])
    return fit["scale"]


def _rings(geom):
    """Polygon/MultiPolygon → гадна ринг(үүд)‑ийн (lon, lat) жагсаалт."""
    out = []
    if geom is None:
        return out
    if geom.geom_type == "Polygon":
        out.append(list(geom.exterior_ring.coords))
    elif geom.geom_type == "MultiPolygon":
        for poly in geom:
            out.append(list(poly.exterior_ring.coords))
    return out


def compute(pt):
    """Цэгийг агуулах сумын индексийн торыг тооцно.

    → None (сум олдоогүй) эсвэл dict:
        unit, scale, cell_lon, cell_lat, ox, oy,
        cells {(i, j)}, cols [i…], rows [j…], label «В-2» | ''
    """
    if pt is None:
        return None
    unit = (AdminUnit.objects.filter(level__name=_SUM_LEVEL,
                                     geom__contains=pt)
            .exclude(geom__isnull=True).select_related("parent").first())
    if unit is None:
        return None
    geom = unit.geom
    scale = _print_scale(geom)

    x0, y0, x1, y1 = geom.extent
    clat = max(0.15, math.cos(math.radians((y0 + y1) / 2.0)))
    # Цаасан дээрх 100мм → газрын метр → градус
    cell_m = 0.1 * scale
    cell_lon = cell_m / (_M_PER_DEG_LON * clat)
    cell_lat = cell_m / _M_PER_DEG_LAT

    # Эгцлэл — сумын БАРУУН ДЭЭД булан (mapprint‑тэй ижил)
    ox, oy = x1, y1
    n_i = int(math.ceil((ox - x0) / cell_lon)) + 1
    n_j = int(math.ceil((oy - y0) / cell_lat)) + 1

    # Хилтэй огтлолцох нүднүүд. i: эгцлэлээс ЗҮҮН тийш, j: ДООШ.
    prep = geom.prepared
    cells = set()
    for i in range(n_i):
        lon_r = ox - i * cell_lon
        lon_l = lon_r - cell_lon
        for j in range(n_j):
            lat_t = oy - j * cell_lat
            lat_b = lat_t - cell_lat
            box = Polygon.from_bbox((lon_l, lat_b, lon_r, lat_t))
            box.srid = 4326
            if prep.intersects(box):
                cells.add((i, j))
    if not cells:
        return None

    cols = sorted({i for i, _ in cells}, reverse=True)   # зүүн→баруун
    rows = sorted({j for _, j in cells})                 # дээш→доош

    # Цэгийн нүд → «Үсэг-Тоо»
    pi = int(math.floor((ox - pt.x) / cell_lon))
    pj = int(math.floor((oy - pt.y) / cell_lat))
    label = ""
    if pi in cols and pj in rows:
        n = rows.index(pj)
        if n < len(_MN_INDEX_LETTERS):
            label = f"{_MN_INDEX_LETTERS[n]}-{cols.index(pi) + 1}"

    return {
        "unit": unit, "scale": scale,
        "cell_lon": cell_lon, "cell_lat": cell_lat,
        "ox": ox, "oy": oy, "cells": cells,
        "cols": cols, "rows": rows, "label": label,
    }


def _cell_label(idx, i, j):
    n = idx["rows"].index(j)
    if n >= len(_MN_INDEX_LETTERS):
        return ""
    return f"{_MN_INDEX_LETTERS[n]}-{idx['cols'].index(i) + 1}"


def svg(pt, width=520, height=430, note="", mm=76):
    """Индексийн схемийг inline SVG‑ээр буцаана. Тооцоо бүтэхгүй бол ''."""
    idx = compute(pt)
    if not idx:
        return ""
    geom = idx["unit"].geom
    cell_lon, cell_lat = idx["cell_lon"], idx["cell_lat"]
    ox, oy = idx["ox"], idx["oy"]

    # Торны БҮТЭН нүднүүдийн хүрээ (схемийн зурагдах муж)
    i_max, j_max = max(idx["cols"]), max(idx["rows"])
    i_min, j_min = min(idx["cols"]), min(idx["rows"])
    lon_l = ox - (i_max + 1) * cell_lon
    lon_r = ox - i_min * cell_lon
    lat_t = oy - j_min * cell_lat
    lat_b = oy - (j_max + 1) * cell_lat
    # Хил тор дотор бүрэн багтаагүй тохиолдолд өргөтгөнө
    gx0, gy0, gx1, gy1 = geom.extent
    lon_l, lon_r = min(lon_l, gx0), max(lon_r, gx1)
    lat_b, lat_t = min(lat_b, gy0), max(lat_t, gy1)

    pad = 0.03 * max(lon_r - lon_l, lat_t - lat_b)
    lon_l, lon_r = lon_l - pad, lon_r + pad
    lat_b, lat_t = lat_b - pad, lat_t + pad

    # ПРОЕКЦ: уртрагийн 1° нь өргөргийн 1°-аас cos(lat) дахин БОГИНО тул
    # lon/lat-ыг шууд ижил масштабаар зурвал нүд тэгш өнцөгт болж сунжирна.
    # Хэвлэлийн зураг (mapprint) нь x-д 111320·cos(lat), y-д 110540 ашигладаг
    # equirectangular буулгалттай — түүнийг ЯГ давтаж, нүдийг дөрвөлжин гаргана.
    clat = max(0.15, math.cos(math.radians((lat_t + lat_b) / 2.0)))
    span_x = ((lon_r - lon_l) * clat) or 1e-9   # газрын метрт пропорциональ
    span_y = (lat_t - lat_b) or 1e-9
    k = min(width / span_x, height / span_y)
    off_x = (width - span_x * k) / 2.0
    off_y = (height - span_y * k) / 2.0

    def sx(lon):
        return off_x + (lon - lon_l) * clat * k

    def sy(lat):
        return off_y + (lat_t - lat) * k

    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{mm}mm" '
        f'height="{mm * height / width:.1f}mm" '
        f'viewBox="0 0 {width} {height}">',
        f'<rect x="0.5" y="0.5" width="{width - 1}" height="{height - 1}" '
        f'fill="#fff" stroke="#7d9bc1" stroke-width="1"/>',
    ]

    # Сумын хил — цайвар шар дүүргэлт, улбар шар зураас
    simplified = geom.simplify(cell_lon / 40.0, preserve_topology=True) or geom
    for ring in _rings(simplified):
        pts = " ".join(f"{sx(lon):.1f},{sy(lat):.1f}" for lon, lat in ring)
        parts.append(
            f'<polygon points="{pts}" fill="#fdf6d8" fill-opacity="0.85" '
            f'stroke="#e08a2e" stroke-width="2.2" stroke-linejoin="round"/>')

    # Индексийн тор — зөвхөн хилтэй огтлолцох нүднүүд
    for (i, j) in sorted(idx["cells"]):
        x_r, x_l = sx(ox - i * cell_lon), sx(ox - (i + 1) * cell_lon)
        y_t, y_b = sy(oy - j * cell_lat), sy(oy - (j + 1) * cell_lat)
        parts.append(
            f'<rect x="{x_l:.1f}" y="{y_t:.1f}" width="{x_r - x_l:.1f}" '
            f'height="{y_b - y_t:.1f}" fill="none" stroke="#5b7fb5" '
            f'stroke-width="0.7"/>')
        lab = _cell_label(idx, i, j)
        if lab:
            parts.append(
                f'<text x="{(x_l + x_r) / 2:.1f}" y="{(y_t + y_b) / 2 + 4:.1f}" '
                f'text-anchor="middle" font-family="Arial" font-size="16" '
                f'fill="#4a4a4a">{lab}</text>')

    # Байршил — улаан цэг + тайлбарын заагч
    px, py = sx(pt.x), sy(pt.y)
    if note:
        bx, by = min(max(px - 115, 4), width - 240), 8
        parts.append(
            f'<line x1="{px:.1f}" y1="{py:.1f}" x2="{bx + 115:.1f}" '
            f'y2="{by + 26:.1f}" stroke="#5b7fb5" stroke-width="1"/>')
        parts.append(
            f'<rect x="{bx:.1f}" y="{by:.1f}" width="234" height="26" '
            f'fill="#fff" stroke="#5b7fb5" stroke-width="1"/>')
        parts.append(
            f'<text x="{bx + 117:.1f}" y="{by + 18:.1f}" text-anchor="middle" '
            f'font-family="Arial" font-size="14" fill="#1a1a1a">{note}</text>')
    parts.append(
        f'<circle cx="{px:.1f}" cy="{py:.1f}" r="6" fill="#d81b60" '
        f'stroke="#fff" stroke-width="1.5"/>')

    # Хойд зүгийн сум
    nx, ny = width - 30, 20
    parts.append(
        f'<text x="{nx}" y="{ny}" text-anchor="middle" font-family="Arial" '
        f'font-size="15" font-weight="bold" fill="#000">N</text>')
    parts.append(
        f'<polygon points="{nx},{ny + 5} {nx - 8},{ny + 38} {nx},{ny + 29} '
        f'{nx + 8},{ny + 38}" fill="#111"/>')

    parts.append("</svg>")
    return "".join(parts)


def point_from(lat, lon):
    if lat is None or lon is None:
        return None
    try:
        return Point(float(lon), float(lat), srid=4326)
    except (TypeError, ValueError):
        return None


# ---------------------------------------------------------------------------
# Байр зүйн зураг — raster:1970, zoom 12‑ийн хүрээ, нэрийг ОНЦГОЙ өнгөөр
# ---------------------------------------------------------------------------

def _tile_bbox(pt, zoom=TOPO_ZOOM):
    """Цэгийг агуулах хавтангийн хүрээ (lon_min, lat_min, lon_max, lat_max)."""
    tx = int(_lon_to_tile_x(pt.x, zoom))
    ty = int(_lat_to_tile_y(pt.y, zoom))
    return (_tile_to_lon(tx, zoom), _tile_to_lat(ty + 1, zoom),
            _tile_to_lon(tx + 1, zoom), _tile_to_lat(ty, zoom))


def _whiten_black_border(img):
    """Мозайкийн хамрахгүй ХАР талбарыг цайруулна.

    raster:1970-ийн зарим хуудас дутуу газар нь alpha=0 биш, ДҮҮРЭН ХАР
    (0,0,0,255) пикселээр ирдэг тул цагаан дэвсгэр дээр буулгахад арилахгүй.
    Тэр талбар нь ЗУРГИЙН ИРМЭГТ шүргэдэг тул ирмэгээс floodfill хийж зөвхөн
    залгаа хар мужийг цайруулна — зургийн дотор дахь хар бичээс, тэмдэглэгээ
    хөндөгдөхгүй.
    """
    w, h = img.size
    step = max(1, w // 200)
    seeds = []
    for x in range(0, w, step):
        seeds.append((x, 0))
        seeds.append((x, h - 1))
    for y in range(0, h, step):
        seeds.append((0, y))
        seeds.append((w - 1, y))
    for sx_, sy_ in seeds:
        try:
            if sum(img.getpixel((sx_, sy_))[:3]) < 60:      # бараг хар
                ImageDraw.floodfill(img, (sx_, sy_), (255, 255, 255),
                                    thresh=40)
        except Exception:
            pass


def _wms_jpeg(bbox, width, height):
    """raster:1970-ийг GetMap-аар татаж, ЦАГААН дэвсгэр дээр буулгаад JPEG.

    ЯАГААД ингэв:
      • PNG-ийг TRANSPARENT=true-гээр авахгүй бол мозайкийн хамрахгүй хэсэг
        ХАР дөрвөлжин болж гардаг (BGCOLOR нь зөвхөн зурагдаагүй талбарт
        үйлчилдэг, растерын nodata пикселд биш).
      • Гэвч PNG нь скан зурагт 800КБ+ болж PDF-г хэт томсгодог тул цагаан
        дэвсгэр дээр нийлүүлээд JPEG болгож шахна.
    """
    base = (settings.GEOSERVER_URL or "").rstrip("/")
    if not base:
        return None
    try:
        r = requests.get(
            f"{base}/{TOPO_LAYER.split(':')[0]}/wms",
            params={
                "SERVICE": "WMS", "VERSION": "1.1.1", "REQUEST": "GetMap",
                "LAYERS": TOPO_LAYER, "SRS": "EPSG:4326",
                "BBOX": ",".join(str(v) for v in bbox),
                "WIDTH": int(width), "HEIGHT": int(height),
                "FORMAT": "image/png", "TRANSPARENT": "true",
            },
            auth=(settings.GEOSERVER_USER, settings.GEOSERVER_PASSWORD),
            timeout=90,
        )
        if not (r.ok and r.headers.get("content-type", "").startswith("image/")):
            logger.warning("raster:1970 GetMap амжилтгүй: %s %s",
                           r.status_code, r.headers.get("content-type"))
            return None
        src = Image.open(BytesIO(r.content)).convert("RGBA")
        canvas = Image.new("RGB", src.size, (255, 255, 255))
        canvas.paste(src, mask=src.split()[3])
        _whiten_black_border(canvas)
        out = BytesIO()
        canvas.save(out, format="JPEG", quality=82, optimize=True)
        return out.getvalue()
    except Exception:
        logger.exception("raster:1970 GetMap алдаа")
    return None


def _geom_paths(geom, to_x, to_y):
    """Геометрийг SVG path/polyline болгоно (шугам, талбай, олон хэсэгтэй)."""
    out = []
    if geom is None:
        return out
    gt = geom.geom_type
    if gt in ("LineString", "LinearRing"):
        pts = " ".join(f"{to_x(x):.1f},{to_y(y):.1f}" for x, y in geom.coords)
        out.append(f'<polyline points="{pts}" fill="none" stroke="#d81b60" '
                   f'stroke-width="3" stroke-linejoin="round" '
                   f'stroke-linecap="round"/>')
    elif gt == "MultiLineString":
        for part in geom:
            out.extend(_geom_paths(part, to_x, to_y))
    elif gt == "Polygon":
        pts = " ".join(f"{to_x(x):.1f},{to_y(y):.1f}"
                       for x, y in geom.exterior_ring.coords)
        out.append(f'<polygon points="{pts}" fill="#d81b60" '
                   f'fill-opacity="0.18" stroke="#d81b60" stroke-width="3" '
                   f'stroke-linejoin="round"/>')
    elif gt == "MultiPolygon":
        for part in geom:
            out.extend(_geom_paths(part, to_x, to_y))
    return out


def topo_svg(pt, label="", width=520, height=430, mm=76, geom=None):
    """Байр зүйн зураг дээр нэрийг тэмдэглэсэн SVG. Растер аваагүй бол ''.

    Зотон нь индексийн бүдүүвчтэй ЯГ ИЖИЛ хэмжээтэй (маягтад хоёулаа нүдний
    50%-д багтдаг тул ижил өндөртэй гарна). Zoom 12-ийн хавтан газар дээрээ
    дөрвөлжин тул растерыг гажуудуулахгүйгээр зотны голд ДӨРВӨЛЖНӨӨР байрлуулж,
    үлдсэн хэсгийг цагаанаар үлдээнэ.
    """
    if pt is None:
        return ""
    side = min(width, height)
    bbox = _tile_bbox(pt)
    raw = _wms_jpeg(bbox, side * 2, side * 2)   # 2x — хэвлэхэд тод байх
    if not raw:
        return ""
    uri = "data:image/jpeg;base64," + base64.b64encode(raw).decode()

    ix = (width - side) / 2.0
    iy = (height - side) / 2.0
    span_x = (bbox[2] - bbox[0]) or 1e-9
    span_y = (bbox[3] - bbox[1]) or 1e-9
    px = ix + (pt.x - bbox[0]) / span_x * side
    py = iy + (bbox[3] - pt.y) / span_y * side

    def to_x(lon):
        return ix + (lon - bbox[0]) / span_x * side

    def to_y(lat):
        return iy + (bbox[3] - lat) / span_y * side

    esc = (label or "").replace("&", "&amp;").replace("<", "&lt;")
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{mm}mm" '
        f'height="{mm * height / width:.1f}mm" '
        f'viewBox="0 0 {width} {height}">',
        f'<rect x="0" y="0" width="{width}" height="{height}" fill="#fff"/>',
        f'<image x="{ix:.1f}" y="{iy:.1f}" width="{side}" height="{side}" '
        f'xlink:href="{uri}" href="{uri}"/>',
    ]
    # Зурсан ДҮРС (жалга, гол г.м. шугаман объект) — өөрийнх нь хэлбэрээр.
    # Дүрс байхгүй (эсвэл цэг) үед доорх улаан цэг л үлдэнэ.
    if geom is not None and geom.geom_type != "Point":
        parts.extend(_geom_paths(geom, to_x, to_y))

    # Нэр — ОНЦГОЙ өнгө (улаан), цагаан хүрээтэй тул зураг дээр тод харагдана
    if esc:
        parts.append(
            f'<text x="{px + 12:.1f}" y="{py - 8:.1f}" font-family="Arial" '
            f'font-size="24" font-weight="bold" fill="#d81b60" '
            f'stroke="#fff" stroke-width="5" paint-order="stroke" '
            f'stroke-linejoin="round">{esc}</text>')
    r = 6 if (geom is None or geom.geom_type == "Point") else 4
    parts.append(
        f'<circle cx="{px:.1f}" cy="{py:.1f}" r="{r}" fill="#d81b60" '
        f'stroke="#fff" stroke-width="2"/>')
    # Хойд зүгийн заагч — зургийн зүүн дээд буланд
    nx, ny = ix + 8, iy + 8
    parts.append(
        f'<g><rect x="{nx:.1f}" y="{ny:.1f}" width="34" height="42" '
        f'fill="#fff" fill-opacity="0.85" stroke="#888" stroke-width="0.6"/>'
        f'<text x="{nx + 17:.1f}" y="{ny + 12:.1f}" text-anchor="middle" '
        f'font-family="Arial" font-size="9" font-weight="bold">N</text>'
        f'<polygon points="{nx + 17:.1f},{ny + 14:.1f} {nx + 12:.1f},'
        f'{ny + 36:.1f} {nx + 17:.1f},{ny + 30:.1f} {nx + 22:.1f},'
        f'{ny + 36:.1f}" fill="#111"/></g>')
    parts.append(
        f'<rect x="{ix + 0.75:.1f}" y="{iy + 0.75:.1f}" '
        f'width="{side - 1.5}" height="{side - 1.5}" fill="none" '
        f'stroke="#7d9bc1" stroke-width="1.5"/>')
    parts.append("</svg>")
    return "".join(parts)
