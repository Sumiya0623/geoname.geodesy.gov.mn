# -*- coding: utf-8 -*-
"""Газар зүйн нэрийн зургийн хэвлэлийн эх (raster) — серверийн PDF хөдөлгүүр.

map.geodesy.gov.mn-ийн apps/map/print багцыг (constants/utm_utils/wms_fetcher/
layout_elements/pdf_renderer) НЭГ модульд нэгтгэж, geoname-д тохируулсан:
  - Фонт: Times New Roman (Arial биш)
  - GeoServer: settings.GEOSERVER_URL / GEOSERVER_USER / GEOSERVER_PASSWORD
  - Гарчиг/хил залгаа сум: apiviews-аас тооцоолж layout-аар дамжуулна
Доод хэсэгт geoname-ийн нэмэлт (render) орсон.
"""
import os
import re
import math
import logging
import datetime
from io import BytesIO
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
from PIL import Image, ImageDraw, ImageChops

from django.conf import settings

from reportlab.pdfgen import canvas as rl_canvas
from reportlab.lib.utils import ImageReader
from reportlab.lib.colors import HexColor, black, white, Color
from reportlab.lib.units import mm as RL_MM
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

logger = logging.getLogger(__name__)

_TNR = '/usr/share/fonts/truetype/msttcorefonts/Times_New_Roman.ttf'
_TNR_B = '/usr/share/fonts/truetype/msttcorefonts/Times_New_Roman_Bold.ttf'
_fonts_registered = False
def _ensure_fonts():
    global _fonts_registered
    if _fonts_registered:
        return
    try:
        pdfmetrics.registerFont(TTFont('TNR', _TNR))
        pdfmetrics.registerFont(TTFont('TNR-Bold', _TNR_B))
        pdfmetrics.registerFont(TTFont('DejaVuSans', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))
        pdfmetrics.registerFont(TTFont('DejaVuSans-Bold', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'))
    except Exception as exc:
        logger.warning("Font registration failed: %s", exc)
    _fonts_registered = True

def _gs_base():
    return (settings.GEOSERVER_URL or '').rstrip('/')



# ===================== constants.py =====================

PAPER_SIZES = {
    'a4': (297, 210),
    'a3': (420, 297),
    'a2': (594, 420),
    'a1': (841, 594),
}

PRINT_SCALES = [
    5000, 10000, 25000, 50000, 100000, 200000,
    500000, 1000000, 2500000, 5000000, 10000000,
]

MM_PER_INCH = 25.4

# Standard topographic grid intervals (degrees) per scale
GRID_INTERVALS = [
    {'maxScale': 25000,   'lon': 7.5 / 60,  'lat': 5.0 / 60},
    {'maxScale': 50000,   'lon': 15.0 / 60,  'lat': 10.0 / 60},
    {'maxScale': 100000,  'lon': 30.0 / 60,  'lat': 20.0 / 60},
    {'maxScale': 200000,  'lon': 1.0,         'lat': 40.0 / 60},
    {'maxScale': 500000,  'lon': 3.0,         'lat': 2.0},
    {'maxScale': 1000000, 'lon': 6.0,         'lat': 4.0},
]

# Layout zone sizes (mm)
FRAME_PAD_MM = 10      # Grid frame outer offset + buffer
HEADER_H_MM = 28       # Header area height
FOOTER_H_MM = 48       # Footer area height (with scale bar)
FOOTER_MIN_MM = 6      # Footer without scale bar
LEGEND_RATIO = 0.22    # Legend width as fraction of content width
LEGEND_GAP_MM = 2      # Gap between map and legend

# Grid frame sub-elements (mm)
GRID_GAP_MM = 1.5      # Gap between map border and zebra band
GRID_BAND_H_MM = 5.0   # Zebra band height (originally 0.5 in some places)
GRID_LABEL_ZONE_MM = 6  # Label zone width outside band


def get_grid_intervals(scale):
    """Get appropriate grid spacing for a given scale denominator."""
    if not scale:
        return {'lon': 1, 'lat': 1}
    for iv in GRID_INTERVALS:
        if scale <= iv['maxScale']:
            return iv
    return GRID_INTERVALS[-1]


def mm_to_pt(val_mm):
    """Convert millimeters to ReportLab points (1 pt = 1/72 inch)."""
    return val_mm * 72.0 / MM_PER_INCH


def mm_to_px(val_mm, dpi=300):
    """Convert millimeters to pixels at given DPI."""
    return round(val_mm * dpi / MM_PER_INCH)


# ===================== utm_utils.py =====================

def lat_lon_to_utm(lat, lon):
    """Convert WGS84 lat/lon (degrees) to UTM easting/northing/zone."""
    zone = int((lon + 180) / 6) + 1
    lon0 = ((zone - 1) * 6 - 177) * (math.pi / 180)
    phi = lat * (math.pi / 180)
    lam = lon * (math.pi / 180)

    a = 6378137.0
    f = 1 / 298.257223563
    e2 = 2 * f - f * f
    ep2 = e2 / (1 - e2)
    k0 = 0.9996

    sin_p = math.sin(phi)
    cos_p = math.cos(phi)
    tan_p = math.tan(phi)

    N = a / math.sqrt(1 - e2 * sin_p * sin_p)
    T = tan_p * tan_p
    C = ep2 * cos_p * cos_p
    A = cos_p * (lam - lon0)

    M = a * (
        (1 - e2 / 4 - 3 * e2 * e2 / 64) * phi
        - (3 * e2 / 8 + 3 * e2 * e2 / 32) * math.sin(2 * phi)
        + (15 * e2 * e2 / 256) * math.sin(4 * phi)
        - (35 * e2 ** 3 / 3072) * math.sin(6 * phi)
    )

    easting = (
        k0 * N * (
            A
            + (1 - T + C) * A ** 3 / 6
            + (5 - 18 * T + T * T + 72 * C - 58 * ep2) * A ** 5 / 120
        )
        + 500000
    )

    northing = k0 * (
        M
        + N * tan_p * (
            A * A / 2
            + (5 - T + 9 * C + 4 * C * C) * A ** 4 / 24
            + (61 - 58 * T + T * T + 600 * C - 330 * ep2) * A ** 6 / 720
        )
    )

    if lat < 0:
        northing += 10000000

    return {'easting': easting, 'northing': northing, 'zone': zone}


def utm_to_lat_lon(easting, northing, zone, northern=True):
    """Convert UTM easting/northing/zone to WGS84 lat/lon (degrees)."""
    k0 = 0.9996
    a = 6378137.0
    f = 1 / 298.257223563
    e2 = 2 * f - f * f
    e1 = (1 - math.sqrt(1 - e2)) / (1 + math.sqrt(1 - e2))
    lon0 = ((zone - 1) * 6 - 177) * (math.pi / 180)

    x = easting - 500000
    y = northing if northern else northing - 10000000

    M0 = y / k0
    mu = M0 / (a * (1 - e2 / 4 - 3 * e2 * e2 / 64 - 5 * e2 ** 3 / 256))

    phi1 = (
        mu
        + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * math.sin(2 * mu)
        + (21 * e1 * e1 / 16 - 55 * e1 ** 4 / 32) * math.sin(4 * mu)
        + (151 * e1 ** 3 / 96) * math.sin(6 * mu)
    )

    sp = math.sin(phi1)
    cp = math.cos(phi1)
    tp = math.tan(phi1)
    ep2 = e2 / (1 - e2)

    N1 = a / math.sqrt(1 - e2 * sp * sp)
    T1 = tp * tp
    C1 = ep2 * cp * cp
    R1 = a * (1 - e2) / ((1 - e2 * sp * sp) ** 1.5)
    D = x / (N1 * k0)

    lat = phi1 - (N1 * tp / R1) * (
        D * D / 2
        - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * ep2) * D ** 4 / 24
        + (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * ep2 - 3 * C1 * C1)
        * D ** 6 / 720
    )

    lon = lon0 + (
        D
        - (1 + 2 * T1 + C1) * D ** 3 / 6
        + (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * ep2 + 24 * T1 * T1)
        * D ** 5 / 120
    ) / cp

    return {'lat': lat * 180 / math.pi, 'lon': lon * 180 / math.pi}


def dms_parts(deg):
    """Split a degree value into d, m, s components."""
    a = abs(deg)
    d = int(a)
    m = int((a - d) * 60)
    s = round(((a - d) * 60 - m) * 60)
    if s == 60:
        s = 0
        m += 1
    if m == 60:
        m = 0
        d += 1
    full = f"{d}\u00b0{m:02d}'{s:02d}\""
    return {'d': d, 'm': m, 's': s, 'full': full}


def fmt_easting(meters, zone):
    """Format UTM easting for grid labels: small = zone+col, big = 2-digit km."""
    km = round(meters / 1000)
    big = km % 100
    col = (km // 100) % 10
    small = f"{zone}{col}"
    return {'small': small, 'big': f"{big:02d}"}


def fmt_northing(meters):
    """Format UTM northing for grid labels: small = 1000km+100km, big = 2-digit km."""
    km = round(meters / 1000)
    big = km % 100
    small = km // 100
    return {'small': str(small) if small > 0 else '', 'big': f"{big:02d}"}


def build_utm_grid_lines(extent_4326):
    """
    Generate UTM 1km grid line coordinates for a given WGS84 extent.
    Returns list of dicts: {'type': 'easting'|'northing', 'value': float, 'points': [(lon, lat), ...]}
    """
    if not extent_4326:
        return []

    lon_min, lat_min, lon_max, lat_max = extent_4326
    zone = int(((lon_min + lon_max) / 2 + 180) / 6) + 1

    bl = lat_lon_to_utm(lat_min, lon_min)
    tr = lat_lon_to_utm(lat_max, lon_max)

    e_min = int(min(bl['easting'], tr['easting']) / 1000) * 1000 - 1000
    e_max = math.ceil(max(bl['easting'], tr['easting']) / 1000) * 1000 + 1000
    n_min = int(min(bl['northing'], tr['northing']) / 1000) * 1000 - 1000
    n_max = math.ceil(max(bl['northing'], tr['northing']) / 1000) * 1000 + 1000

    lines = []

    # Vertical lines (constant easting)
    e = e_min
    while e <= e_max:
        pts = []
        n = n_min
        while n <= n_max:
            ll = utm_to_lat_lon(e, n, zone, True)
            pts.append((ll['lon'], ll['lat']))
            n += 500
        if len(pts) >= 2:
            lines.append({'type': 'easting', 'value': e, 'points': pts})
        e += 1000

    # Horizontal lines (constant northing)
    n = n_min
    while n <= n_max:
        pts = []
        e = e_min
        while e <= e_max:
            ll = utm_to_lat_lon(e, n, zone, True)
            pts.append((ll['lon'], ll['lat']))
            e += 500
        if len(pts) >= 2:
            lines.append({'type': 'northing', 'value': n, 'points': pts})
        n += 1000

    return lines


# ===================== wms_fetcher.py =====================

logger = logging.getLogger(__name__)

# OGC standard pixel size = 0.00028 m  →  ~90.71 DPI
_OGC_DPI = 25.4 / 0.28


class LayerNotFoundError(Exception):
    """Raised when GeoServer returns LayerNotDefined."""
    pass


# ---------------------------------------------------------------------------
# GeoServer WMS
# ---------------------------------------------------------------------------

def _geoserver_wms_url(layer_full_name=''):
    """Build GeoServer WMS URL from settings."""
    gs_base = _gs_base()

    # Use workspace-specific endpoint if layer has workspace prefix
    if ':' in layer_full_name:
        workspace = layer_full_name.split(':')[0]
        return f"{gs_base}/{workspace}/wms"
    return f"{gs_base}/wms"


# GeoServer maxRequestMemory = 65536 KB.  Keep each tile under 50 MB
# so we stay well within the limit.  (memory ≈ W × H × 4 bytes)
_MAX_TILE_BYTES = 50 * 1024 * 1024   # 50 MB


def _fetch_layer_sld(layer_full_name, auth):
    """Fetch the default style SLD XML for a GeoServer layer via REST API."""
    rest_base = _gs_base() + '/rest'

    if ':' not in layer_full_name:
        return None

    workspace, layer_name = layer_full_name.split(':', 1)

    try:
        # Get layer's default style name
        r = requests.get(
            f'{rest_base}/workspaces/{workspace}/layers/{layer_name}.json',
            auth=auth, timeout=15,
        )
        if not r.ok:
            return None

        style_info = r.json().get('layer', {}).get('defaultStyle', {})
        style_name = style_info.get('name')
        if not style_name:
            return None

        # Fetch SLD content (try workspace-scoped first, then global)
        for url in [
            f'{rest_base}/workspaces/{workspace}/styles/{style_name}.sld',
            f'{rest_base}/styles/{style_name}.sld',
        ]:
            r = requests.get(url, auth=auth, timeout=15)
            if r.ok and r.text.strip():
                return r.text

    except Exception as exc:
        logger.warning("Failed to fetch SLD for %s: %s", layer_full_name, exc)

    return None


def _adjust_sld_scale_denominators(sld_xml, dpi_ratio):
    """Adjust Min/MaxScaleDenominator values in SLD XML by dividing by dpi_ratio.

    GeoServer always uses the OGC pixel size (0.00028 m) to compute scale
    from WIDTH/HEIGHT, ignoring FORMAT_OPTIONS dpi.  At 300 DPI the pixel
    count is ~3.3× larger so GeoServer sees scale / 3.3.

    By dividing the SLD thresholds by the same ratio the rules fire at the
    correct printed scale.
    """
    def _replace(match):
        tag = match.group(1)
        value = float(match.group(2))
        adjusted = value / dpi_ratio
        return f'<{tag}>{adjusted:.0f}</{tag}>'

    return re.sub(
        r'<((?:Min|Max)ScaleDenominator)>\s*([\d.]+)\s*</\1>',
        _replace,
        sld_xml,
    )


def _fetch_wms_single(wms_url, auth, layer_full_name, bbox, w, h, dpi,
                       sld_body=None, cql=None, styles=None, clip=None):
    """Fetch a single WMS GetMap request — no tiling."""
    lon_min, lat_min, lon_max, lat_max = bbox
    params = {
        'SERVICE': 'WMS',
        'VERSION': '1.1.1',
        'REQUEST': 'GetMap',
        'LAYERS': layer_full_name,
        'STYLES': styles or '',
        'SRS': 'EPSG:4326',
        'BBOX': f'{lon_min},{lat_min},{lon_max},{lat_max}',
        'WIDTH': int(w),
        'HEIGHT': int(h),
        'FORMAT': 'image/png',
        'TRANSPARENT': 'true',
        'FORMAT_OPTIONS': f'dpi:{dpi}',
    }

    if sld_body:
        params['SLD_BODY'] = sld_body
    if cql:
        params['CQL_FILTER'] = cql
    if clip:
        # GeoServer WMS vendor param — растер/вектор гаралтыг WKT полигоноор тайрна
        # (request SRS = EPSG:4326 тул srid prefix-гүй 4326 WKT)
        params['clip'] = clip

    # Use POST when SLD_BODY/CQL/clip is present (can be large for GET query string)
    if sld_body or cql or clip:
        r = requests.post(wms_url, data=params, auth=auth, timeout=120)
    else:
        r = requests.get(wms_url, params=params, auth=auth, timeout=120)

    content_type = r.headers.get('content-type', '')
    if r.status_code != 200 or 'image' not in content_type:
        body_snippet = r.text[:400]
        # Detect specific GeoServer exceptions
        if 'LayerNotDefined' in body_snippet:
            raise LayerNotFoundError(
                f"Layer not found in GeoServer: {layer_full_name}"
            )
        raise RuntimeError(
            f"WMS GetMap failed for {layer_full_name}: "
            f"HTTP {r.status_code}, content-type={content_type}, "
            f"body={body_snippet}"
        )

    return Image.open(BytesIO(r.content)).convert('RGBA')


def fetch_wms_layer(layer_full_name, bbox_4326, width_px, height_px, dpi=300,
                    scale=None, cql=None, styles=None, clip=None, sld_body=None):
    """
    Fetch a single WMS layer from GeoServer at the specified DPI.

    If the requested image would exceed GeoServer's maxRequestMemory,
    the request is automatically split into smaller tiles and stitched.

    sld_body — өгсөн бол энэ inline SLD-г ашиглана (динамик ColorMap г.м.);
    STYLES-ийг орлоно.
    """
    width_px = int(width_px)
    height_px = int(height_px)
    wms_url = _geoserver_wms_url(layer_full_name)
    auth = (settings.GEOSERVER_USER, settings.GEOSERVER_PASSWORD)

    # For high-DPI print: adjust SLD scale denominators so that
    # MinScaleDenominator / MaxScaleDenominator rules match correctly.
    if sld_body is None and scale and dpi > 96:
        dpi_ratio = dpi / _OGC_DPI
        original_sld = _fetch_layer_sld(layer_full_name, auth)
        if original_sld and 'ScaleDenominator' in original_sld:
            sld_body = _adjust_sld_scale_denominators(original_sld, dpi_ratio)
            logger.info(
                "Adjusted SLD scale denominators for %s (ratio=%.2f)",
                layer_full_name, dpi_ratio,
            )

    mem_needed = width_px * height_px * 4
    if mem_needed <= _MAX_TILE_BYTES:
        return _fetch_wms_single(
            wms_url, auth, layer_full_name, bbox_4326, width_px, height_px, dpi,
            sld_body=sld_body, cql=cql, styles=styles, clip=clip,
        )

    # --- Tiled fetch ---
    # Determine grid size so each tile stays under the memory limit
    max_pixels_per_tile = _MAX_TILE_BYTES // 4
    total_pixels = width_px * height_px
    n_tiles = math.ceil(total_pixels / max_pixels_per_tile)
    # Split along the longer axis
    cols = 1
    rows = 1
    if width_px >= height_px:
        cols = math.ceil(math.sqrt(n_tiles * width_px / max(height_px, 1)))
        rows = math.ceil(n_tiles / max(cols, 1))
    else:
        rows = math.ceil(math.sqrt(n_tiles * height_px / max(width_px, 1)))
        cols = math.ceil(n_tiles / max(rows, 1))
    cols = max(cols, 1)
    rows = max(rows, 1)

    logger.info(
        "Tiling WMS request for %s: %dx%d px → %dx%d grid (%d tiles)",
        layer_full_name, width_px, height_px, cols, rows, cols * rows,
    )

    lon_min, lat_min, lon_max, lat_max = bbox_4326
    d_lon = (lon_max - lon_min) / cols
    d_lat = (lat_max - lat_min) / rows

    canvas = Image.new('RGBA', (width_px, height_px), (0, 0, 0, 0))

    tile_w = width_px / cols
    tile_h = height_px / rows

    for row in range(rows):
        for col in range(cols):
            t_lon_min = lon_min + col * d_lon
            t_lon_max = lon_min + (col + 1) * d_lon
            # bbox y goes bottom-to-top, image y goes top-to-bottom
            t_lat_min = lat_min + (rows - 1 - row) * d_lat
            t_lat_max = lat_min + (rows - row) * d_lat

            tw = int(round(tile_w))
            th = int(round(tile_h))

            try:
                tile_img = _fetch_wms_single(
                    wms_url, auth, layer_full_name,
                    (t_lon_min, t_lat_min, t_lon_max, t_lat_max),
                    tw, th, dpi, sld_body=sld_body, cql=cql, styles=styles,
                    clip=clip,
                )
                if tile_img.size != (tw, th):
                    tile_img = tile_img.resize((tw, th), Image.LANCZOS)

                px_x = int(round(col * tile_w))
                px_y = int(round(row * tile_h))
                canvas.paste(tile_img, (px_x, px_y))
            except Exception as exc:
                logger.warning(
                    "WMS tile [%d,%d] failed for %s: %s",
                    col, row, layer_full_name, exc,
                )

    return canvas


# ---------------------------------------------------------------------------
# XYZ basemap tiles
# ---------------------------------------------------------------------------

def _lon_to_tile_x(lon, zoom):
    n = 2 ** zoom
    return int((lon + 180.0) / 360.0 * n)


def _lat_to_tile_y(lat, zoom):
    n = 2 ** zoom
    lat_rad = math.radians(lat)
    return int((1.0 - math.log(math.tan(lat_rad) + 1.0 / math.cos(lat_rad)) / math.pi) / 2.0 * n)


def _tile_to_lon(x, zoom):
    return x / (2 ** zoom) * 360.0 - 180.0


def _tile_to_lat(y, zoom):
    n = math.pi - 2.0 * math.pi * y / (2 ** zoom)
    return math.degrees(math.atan(math.sinh(n)))


def fetch_basemap_tiles(url_template, bbox_4326, width_px, height_px):
    """
    Fetch XYZ tiles covering bbox and composite into a single image.
    """
    lon_min, lat_min, lon_max, lat_max = bbox_4326

    # Pick zoom level that gives roughly the needed resolution
    deg_per_px = (lon_max - lon_min) / max(width_px, 1)
    tile_size = 256
    zoom = int(math.log2(360.0 / (deg_per_px * tile_size)))
    zoom = max(0, min(zoom, 19))

    x_min = _lon_to_tile_x(lon_min, zoom)
    x_max = _lon_to_tile_x(lon_max, zoom)
    y_min = _lat_to_tile_y(lat_max, zoom)   # lat_max → smaller tile y
    y_max = _lat_to_tile_y(lat_min, zoom)

    tiles_x = x_max - x_min + 1
    tiles_y = y_max - y_min + 1
    mosaic_w = tiles_x * tile_size
    mosaic_h = tiles_y * tile_size

    # Fetch tiles in parallel
    def _fetch_one(tx, ty):
        url = (
            url_template
            .replace('{z}', str(zoom))
            .replace('{x}', str(tx))
            .replace('{y}', str(ty))
        )
        try:
            resp = requests.get(url, timeout=30, headers={'User-Agent': 'MapGeodesy/1.0'})
            if resp.ok and 'image' in resp.headers.get('content-type', ''):
                return (tx, ty, Image.open(BytesIO(resp.content)).convert('RGBA'))
        except Exception as exc:
            logger.warning("Tile fetch failed z=%d x=%d y=%d: %s", zoom, tx, ty, exc)
        return (tx, ty, None)

    mosaic = Image.new('RGBA', (mosaic_w, mosaic_h), (255, 255, 255, 255))

    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = [
            pool.submit(_fetch_one, tx, ty)
            for ty in range(y_min, y_max + 1)
            for tx in range(x_min, x_max + 1)
        ]
        for f in as_completed(futures):
            tx, ty, img = f.result()
            if img:
                px_x = (tx - x_min) * tile_size
                px_y = (ty - y_min) * tile_size
                mosaic.paste(img, (px_x, px_y))

    # Determine the lon/lat of the tile grid corners
    grid_lon_min = _tile_to_lon(x_min, zoom)
    grid_lon_max = _tile_to_lon(x_max + 1, zoom)
    grid_lat_max = _tile_to_lat(y_min, zoom)
    grid_lat_min = _tile_to_lat(y_max + 1, zoom)

    # Crop mosaic to exactly the requested bbox (in pixel coords)
    def _lon_to_px(lon):
        return int((lon - grid_lon_min) / (grid_lon_max - grid_lon_min) * mosaic_w)

    def _lat_to_px(lat):
        return int((grid_lat_max - lat) / (grid_lat_max - grid_lat_min) * mosaic_h)

    crop_left = max(0, _lon_to_px(lon_min))
    crop_right = min(mosaic_w, _lon_to_px(lon_max))
    crop_top = max(0, _lat_to_px(lat_max))
    crop_bottom = min(mosaic_h, _lat_to_px(lat_min))

    cropped = mosaic.crop((crop_left, crop_top, crop_right, crop_bottom))
    return cropped.resize((int(width_px), int(height_px)), Image.LANCZOS)


# ---------------------------------------------------------------------------
# Layer compositing
# ---------------------------------------------------------------------------

def _build_clip_mask(clip_polys, bbox, w, h):
    """clip_polys = [{'exterior': [[lon,lat],...], 'holes': [[[lon,lat],...]]}]
    → PIL 'L' mask (255 = полигон дотор, 0 = гадна/нүх). bbox = [w,s,e,n] 4326."""
    lon0, lat0, lon1, lat1 = bbox
    dw = (lon1 - lon0) or 1e-9
    dh = (lat1 - lat0) or 1e-9

    def _px(ring):
        return [((x - lon0) / dw * w, (lat1 - y) / dh * h) for x, y in ring]

    mask = Image.new('L', (w, h), 0)
    drw = ImageDraw.Draw(mask)
    for poly in clip_polys:
        ext = poly.get('exterior') or []
        if len(ext) >= 3:
            drw.polygon(_px(ext), fill=255)
        for hole in poly.get('holes') or []:
            if len(hole) >= 3:
                drw.polygon(_px(hole), fill=0)
    return mask


def composite_layers(layers_config, bbox_4326, width_px, height_px, dpi=300,
                     scale=None):
    """
    Render all layers bottom-to-top into a single RGBA image.
    """
    canvas = Image.new('RGBA', (int(width_px), int(height_px)), (255, 255, 255, 255))

    for layer_cfg in layers_config:
        if not layer_cfg.get('visible', True):
            continue

        opacity = layer_cfg.get('opacity', 1.0)
        img = None
        clip_polys = layer_cfg.get('clipPolys')

        try:
            if layer_cfg['type'] == 'basemap':
                url_tpl = layer_cfg.get('url', '')
                if url_tpl:
                    img = fetch_basemap_tiles(url_tpl, bbox_4326, width_px, height_px)
            elif layer_cfg['type'] == 'wms':
                layer_name = layer_cfg.get('layerFullName', '')
                if layer_name:
                    img = fetch_wms_layer(
                        layer_name, bbox_4326, width_px, height_px, dpi,
                        scale=scale, cql=layer_cfg.get('cql') or None,
                        styles=layer_cfg.get('styles') or None,
                        clip=layer_cfg.get('clip') or None,
                        sld_body=layer_cfg.get('sld_body') or None,
                    )
        except LayerNotFoundError:
            logger.info("Skipping non-existent layer: %s", layer_cfg.get('layerFullName', ''))
            continue
        except Exception as exc:
            logger.warning("Layer fetch failed (%s): %s", layer_cfg, exc)
            continue

        if img is None:
            continue

        # Resize if dimensions don't match
        if img.size != (int(width_px), int(height_px)):
            img = img.resize((int(width_px), int(height_px)), Image.LANCZOS)

        # Геометрээр тайрах (PIL mask) — WMS clip нь растер дээр fast-path алдаа
        # өгдөг тул энд alpha mask-аар хийнэ (255=дотор, 0=гадна/нүх)
        if clip_polys:
            mask = _build_clip_mask(clip_polys, bbox_4326,
                                    int(width_px), int(height_px))
            new_alpha = ImageChops.multiply(img.split()[3], mask)
            img.putalpha(new_alpha)

        # Apply opacity
        if opacity < 1.0:
            alpha = img.split()[3]
            alpha = alpha.point(lambda p: int(p * opacity))
            img.putalpha(alpha)

        canvas = Image.alpha_composite(canvas, img)

    return canvas


# ===================== layout_elements.py =====================

# Font names (registered in pdf_renderer.py)
FONT = 'TNR'
FONT_BOLD = 'TNR-Bold'
# ---------------------------------------------------------------------------
# Coordinate mapping helpers
# ---------------------------------------------------------------------------

def _lon_to_x(lon, bbox, map_x, map_w):
    """Map WGS84 longitude to canvas x (simple linear — ignores Mercator)."""
    lon_min, _, lon_max, _ = bbox
    return map_x + (lon - lon_min) / (lon_max - lon_min) * map_w


def _lat_to_y_top_down(lat, bbox, map_y_bottom, map_h):
    """Map WGS84 latitude to canvas y (ReportLab: y=0 at bottom)."""
    _, lat_min, _, lat_max = bbox
    # Higher latitude → higher y in ReportLab
    return map_y_bottom + (lat - lat_min) / (lat_max - lat_min) * map_h


def _utm_to_px(e, n, zone, bbox, map_x, map_y_bottom, map_w, map_h):
    """Convert UTM easting/northing to canvas pixel coordinates."""
    ll = utm_to_lat_lon(e, n, zone, True)
    return (
        _lon_to_x(ll['lon'], bbox, map_x, map_w),
        _lat_to_y_top_down(ll['lat'], bbox, map_y_bottom, map_h),
    )


# ---------------------------------------------------------------------------
# Header
# ---------------------------------------------------------------------------

def draw_header(c, layout, page_w, page_h, margin, header_h, frame_l, frame_r):
    content_y_top = page_h - margin  # top of content area (ReportLab y)
    frame_cx = (frame_l + frame_r) / 2
    frame_w = frame_r - frame_l
    frame_top = content_y_top - header_h
    subtitle = layout.get('subtitle', '')
    cur_y = content_y_top - mm_to_pt(14)
    if subtitle:
        # Зургийн нэр (спец: Times New Roman 60) — A0-д ТОМ, шаардвал мөр таслана
        t_fs = float(layout.get('titleFontSize') or 60)
        max_w = frame_w * 0.92
        words = subtitle.split(' ')
        lines, cur = [], ''
        for w in words:
            test = f"{cur} {w}" if cur else w
            if c.stringWidth(test, FONT_BOLD, t_fs) > max_w and cur:
                lines.append(cur)
                cur = w
            else:
                cur = test
        if cur:
            lines.append(cur)
        # Гарчгийг зургийн ХҮРЭЭНД дөхүүлнэ: сүүлийн мөр хүрээний дээд ирмэгээс
        # ~12мм дээр байрлана (хэтэрхий хол биш).
        frame_top_y = page_h - mm_to_pt(RM_TOP)
        line_h = t_fs + 6
        cur_y = frame_top_y + mm_to_pt(12) + (len(lines) - 1) * line_h
        c.setFont(FONT_BOLD, t_fs)
        c.setFillColor(black)
        for ln in lines:
            c.drawCentredString(frame_cx, cur_y, ln)
            cur_y -= line_h
    cur_y -= mm_to_pt(2)
    title_text = layout.get('titleText', '')
    title_fs = 12
    if title_text:
        c.setFont(FONT, title_fs)
        c.setFillColor(black)
        max_title_w = frame_w * 0.7
        words = title_text.split(' ')
        lines = []
        cur_line = ''
        for w in words:
            test = f"{cur_line} {w}" if cur_line else w
            if c.stringWidth(test, FONT, title_fs) > max_title_w and cur_line:
                lines.append(cur_line)
                cur_line = w
            else:
                cur_line = test
        if cur_line:
            lines.append(cur_line)
        line_h = title_fs + 2
        for ln in lines:
            c.drawCentredString(frame_cx, cur_y, ln)
            cur_y -= line_h
    # ITRF / НУУЦ — зургийн ХҮРЭЭНЭЭС ДЭЭШ (давхцахгүй), хүрээний ирмэгээс 4мм дээр
    itrf_y = page_h - mm_to_pt(RM_TOP) + mm_to_pt(4)
    c.setFont(FONT, 14)  # спец: геодезийн солбицол TNR 14
    c.setFillColor(black)
    c.drawString(frame_l, itrf_y, 'ITRF2020 /2015.0/ солбицлын тогтолцоо')
    c.drawRightString(frame_r, itrf_y, 'АЛБАН ХЭРЭГЦЭЭНД')

# ---------------------------------------------------------------------------
# Grid frame
# ---------------------------------------------------------------------------

def draw_grid_frame(c, layout, bbox, scale, map_x, map_y, map_w, map_h):
    lon_min, lat_min, lon_max, lat_max = bbox
    # Солбицлын торны интервал — ТОГТМОЛ 5 минут (layout-аар өөрчилж болно)
    gi_min = float(layout.get('gridMinutes') or 5.0)
    grid_int = {'lon': gi_min / 60.0, 'lat': gi_min / 60.0}
    GAP = mm_to_pt(2)
    BAND_H = mm_to_pt(1.4)
    LABEL_ZONE = mm_to_pt(10)
    outer_off = GAP + BAND_H + LABEL_ZONE
    BOLD_W = max(1.5, 2.5 * 72 / 96)
    oL = map_x - outer_off
    oR = map_x + map_w + outer_off
    oT = map_y + map_h + outer_off   # top in RL coords = higher y
    oB = map_y - outer_off           # bottom in RL coords = lower y
    bL = oL + GAP
    bR = oR - GAP
    bT = oT - GAP   # band top (just inside outer)
    bB = oB + GAP   # band bottom
    iL = map_x - LABEL_ZONE
    iR = map_x + map_w + LABEL_ZONE
    iT = map_y + map_h + LABEL_ZONE
    iB = map_y - LABEL_ZONE
    zone = int(((lon_min + lon_max) / 2 + 180) / 6) + 1
    c.saveState()
    p = c.beginPath()
    p.rect(map_x, map_y, map_w, map_h)
    c.clipPath(p, stroke=0)
    c.setStrokeColor(Color(0, 0, 0, 0.12))
    c.setLineWidth(0.05)  ## todorhoiloogui baina.
    c.setDash(mm_to_pt(1), mm_to_pt(1))
    # Зургийн дотор graticule тор ХАРУУЛАХГҮЙ (зөвхөн нэрийн индекс тор үлдэнэ)
    _show_grat = layout.get('showGraticuleLines', False)
    lon_start = math.ceil(lon_min / grid_int['lon']) * grid_int['lon']
    lon = lon_start
    while lon <= lon_max and _show_grat:
        x = _lon_to_x(lon, bbox, map_x, map_w)
        if map_x < x < map_x + map_w:
            c.line(x, map_y, x, map_y + map_h)
        lon += grid_int['lon']
    lat_start = math.ceil(lat_min / grid_int['lat']) * grid_int['lat']
    lat = lat_start
    while lat <= lat_max and _show_grat:
        y = _lat_to_y_top_down(lat, bbox, map_y, map_h)
        if map_y < y < map_y + map_h:
            c.line(map_x, y, map_x + map_w, y)
        lat += grid_int['lat']
    c.setDash()
    c.restoreState()
    # ----- 2. UTM 1km grid lines -----
    uBL = lat_lon_to_utm(lat_min, lon_min)
    uTR = lat_lon_to_utm(lat_max, lon_max)
    uBR = lat_lon_to_utm(lat_min, lon_max)
    uTL = lat_lon_to_utm(lat_max, lon_min)
    e_min = int(min(uBL['easting'], uTL['easting']) / 1000) * 1000
    e_max = math.ceil(max(uBR['easting'], uTR['easting']) / 1000) * 1000
    n_min = int(min(uBL['northing'], uBR['northing']) / 1000) * 1000
    n_max = math.ceil(max(uTL['northing'], uTR['northing']) / 1000) * 1000
    c.setStrokeColor(black)
    c.setLineWidth(0.05)  ### UTM-n grid-n tor zurag dotor
    _show_utm_grid = layout.get('showUtmGrid', False)  # default: торыг ХАСНА
    # Easting (vertical) lines — дээш/доош label zone руу гарна, зүүн/баруун руу үгүй
    c.saveState()
    p = c.beginPath()
    p.rect(map_x, bB, map_w, bT - bB)
    c.clipPath(p, stroke=0)
    e = e_min
    while e <= e_max and _show_utm_grid:
        path = c.beginPath()
        first = True
        n = n_min
        while n <= n_max:
            px_x, px_y = _utm_to_px(e, n, zone, bbox, map_x, map_y, map_w, map_h)
            if first:
                path.moveTo(px_x, px_y)
                first = False
            else:
                path.lineTo(px_x, px_y)
            n += 500
        c.drawPath(path)
        e += 1000
    c.restoreState()
    # Northing (horizontal) lines — зүүн/баруун label zone руу гарна, дээш/доош руу үгүй
    c.saveState()
    p = c.beginPath()
    p.rect(bL, map_y, bR - bL, map_h)
    c.clipPath(p, stroke=0)
    n = n_min
    while n <= n_max and _show_utm_grid:
        path = c.beginPath()
        first = True
        e = e_min
        while e <= e_max:
            px_x, px_y = _utm_to_px(e, n, zone, bbox, map_x, map_y, map_w, map_h)
            if first:
                path.moveTo(px_x, px_y)
                first = False
            else:
                path.lineTo(px_x, px_y)
            e += 500
        c.drawPath(path)
        n += 1000
    c.restoreState()
    # ----- 3. Zebra alternating band (WGS84 — торны интервалаар: 15/5 мин) -----
    MIN1 = grid_int['lon']  # gi_min/60 (аймаг 15мин, сум 5мин)
    lon_xs = []
    lon_v = math.ceil(lon_min / MIN1) * MIN1
    while lon_v <= lon_max:
        x = _lon_to_x(lon_v, bbox, map_x, map_w)
        if map_x < x < map_x + map_w:
            lon_xs.append(x)
        lon_v += MIN1
    lat_ys = []
    lat_v = math.ceil(lat_min / MIN1) * MIN1
    while lat_v <= lat_max:
        y = _lat_to_y_top_down(lat_v, bbox, map_y, map_h)
        if map_y < y < map_y + map_h:
            lat_ys.append(y)
        lat_v += MIN1
    lat_ys.sort()
    # Top band (horizontal, at bT)
    top_segs = [bL] + lon_xs + [bR]
    for i in range(len(top_segs) - 1):
        c.setFillColor(white if i % 2 == 0 else black)
        c.rect(top_segs[i], bT - BAND_H, top_segs[i + 1] - top_segs[i], BAND_H, stroke=0, fill=1)
    # Bottom band (horizontal, at bB)
    bot_segs = [bL] + lon_xs + [bR]
    for i in range(len(bot_segs) - 1):
        c.setFillColor(white if i % 2 == 0 else black)
        c.rect(bot_segs[i], bB, bot_segs[i + 1] - bot_segs[i], BAND_H, stroke=0, fill=1)
    # Left band (vertical)
    v_band_b = iB
    v_band_t = bT - BAND_H
    left_segs = [v_band_b] + [y for y in lat_ys if v_band_b < y < v_band_t] + [v_band_t]
    for i in range(len(left_segs) - 1):
        c.setFillColor(white if i % 2 == 0 else black)
        c.rect(bL, left_segs[i], BAND_H, left_segs[i + 1] - left_segs[i], stroke=0, fill=1)
    # Right band (vertical)
    right_segs = [v_band_b] + [y for y in lat_ys if v_band_b < y < v_band_t] + [v_band_t]
    for i in range(len(right_segs) - 1):
        c.setFillColor(white if i % 2 == 0 else black)
        c.rect(bR - BAND_H, right_segs[i], BAND_H, right_segs[i + 1] - right_segs[i], stroke=0, fill=1)
    # ----- 3b. 6 dots per zebra segment in the GAP -----
    dot_r = max(0.4, mm_to_pt(0.12))
    c.setFillColor(black)
    def _draw_dots_6(segs, is_horiz, fixed_center):
        for i in range(len(segs) - 1):
            a, b = segs[i], segs[i + 1]
            step = (b - a) / 7
            for k in range(1, 7):
                pos = a + step * k
                if is_horiz:
                    c.circle(pos, fixed_center, dot_r, stroke=0, fill=1)
                else:
                    c.circle(fixed_center, pos, dot_r, stroke=0, fill=1)
    _draw_dots_6(top_segs, True, (oT + bT) / 2)
    _draw_dots_6(bot_segs, True, (bB + oB) / 2)
    _draw_dots_6(left_segs, False, (oL + bL) / 2)
    _draw_dots_6(right_segs, False, (bR + oR) / 2)
    # ----- 3c. WGS84 tick lines: zebra outer edge → bold outer frame -----
    c.setStrokeColor(black)
    c.setLineWidth(0.2) ### minutin tor zebragiin 2 tald haruulj baigaa
    for x in lon_xs:
        c.line(x, bT, x, oT)
        c.line(x, bB, x, oB)
    for y in lat_ys:
        if y <= v_band_b or y >= v_band_t:
            continue
        c.line(bL, y, oL, y)
        c.line(bR, y, oR, y)
    # ----- 4. Frame strokes -----
    c.setStrokeColor(black)
    # Bold outer frame
    c.setLineWidth(BOLD_W)  # gadna hureee
    c.rect(oL, oB, oR - oL, oT - oB, stroke=1, fill=0)
    # Band outer edge
    c.setLineWidth(0.1) ## zebragiin 2 taliin shugamnii orgon
    c.rect(bL, bB, bR - bL, bT - bB, stroke=1, fill=0)
    # Label zone outer edge
    c.rect(iL, iB, iR - iL, iT - iB, stroke=1, fill=0)
    # Inner frame (map border)
    c.setLineWidth(0.2) ### зургийн гадна baigaa huree 
    c.rect(map_x, map_y, map_w, map_h, stroke=1, fill=0)
    # ----- 4b. Corner extension lines -----
    c.setStrokeColor(black)
    c.setLineWidth(0.2) ### bulanguudiin toriig urgeljluulj baigaa huree 
    # Top-left
    c.line(map_x, map_y + map_h, map_x, iT)
    c.line(map_x, map_y + map_h, iL, map_y + map_h)
    # Top-right
    c.line(map_x + map_w, map_y + map_h, map_x + map_w, iT)
    c.line(map_x + map_w, map_y + map_h, iR, map_y + map_h)
    # Bottom-left
    c.line(map_x, map_y, map_x, iB)
    c.line(map_x, map_y, iL, map_y)
    # Bottom-right
    c.line(map_x + map_w, map_y, map_x + map_w, iB)
    c.line(map_x + map_w, map_y, iR, map_y)
    # ----- 4c. Adjacent nomek names -----
    adj = layout.get('adjacentNomeks', {})
    frame_cy = (oT + oB) / 2
    if adj.get('west'):
        c.saveState()
        c.translate(oL, frame_cy)
        c.rotate(90)
        text = adj['west']
        tw = c.stringWidth(text, FONT_BOLD, 8)
        # White halo
        c.setFillColor(white)
        c.rect(-tw / 2 - mm_to_pt(1.5), -5, tw + mm_to_pt(3), 10, stroke=0, fill=1)
        c.setFillColor(black)
        c.setFont(FONT_BOLD, 8)
        c.drawCentredString(0, -3, text)
        c.restoreState()
    if adj.get('east'):
        c.saveState()
        c.translate(oR, frame_cy)
        c.rotate(-90)
        text = adj['east']
        tw = c.stringWidth(text, FONT_BOLD, 8)
        c.setFillColor(white)
        c.rect(-tw / 2 - mm_to_pt(1.5), -5, tw + mm_to_pt(3), 10, stroke=0, fill=1)
        c.setFillColor(black)
        c.setFont(FONT_BOLD, 8)
        c.drawCentredString(0, -3, text)
        c.restoreState()
    frame_cx = (oL + oR) / 2
    if adj.get('north'):
        c.saveState()
        c.translate(frame_cx, oT)
        text = adj['north']
        tw = c.stringWidth(text, FONT_BOLD, 8)
        c.setFillColor(white)
        c.rect(-tw / 2 - mm_to_pt(1.5), -5, tw + mm_to_pt(3), 10, stroke=0, fill=1)
        c.setFillColor(black)
        c.setFont(FONT_BOLD, 8)
        c.drawCentredString(0, -3, text)
        c.restoreState()
    if adj.get('south'):
        c.saveState()
        c.translate(frame_cx, oB)
        text = adj['south']
        tw = c.stringWidth(text, FONT_BOLD, 8)
        c.setFillColor(white)
        c.rect(-tw / 2 - mm_to_pt(1.5), -5, tw + mm_to_pt(3), 10, stroke=0, fill=1)
        c.setFillColor(black)
        c.setFont(FONT_BOLD, 8)
        c.drawCentredString(0, -3, text)
        c.restoreState()
    # ----- 5. WGS84 1-minute ticks crossing map border -----
    tick_len = mm_to_pt(1.2)
    c.setStrokeColor(black)
    c.setLineWidth(0.2) ### zurgiin hureenii dotor taliin shudnuud 
    for x in lon_xs:
        if x <= map_x + mm_to_pt(1) or x >= map_x + map_w - mm_to_pt(1):
            continue
        # Top: inward (down)
        c.line(x, map_y + map_h, x, map_y + map_h - tick_len)
        # Bottom: inward (up)
        c.line(x, map_y, x, map_y + tick_len)
    for y in lat_ys:
        if y <= map_y + mm_to_pt(1) or y >= map_y + map_h - mm_to_pt(1):
            continue
        c.line(map_x, y, map_x + tick_len, y)
        c.line(map_x + map_w, y, map_x + map_w - tick_len, y)
    # ----- 6. UTM easting/northing labels -----
    utm_big_fs = 11
    utm_small_fs = 8
    utm_pad = mm_to_pt(1)
    corner_min = mm_to_pt(15)
    # Visible easting lines
    vis_east = []
    e = e_min
    while e <= e_max:
        px_x_t, _ = _utm_to_px(e, n_max, zone, bbox, map_x, map_y, map_w, map_h)
        px_x_b, _ = _utm_to_px(e, n_min, zone, bbox, map_x, map_y, map_w, map_h)
        if map_x + mm_to_pt(3) < px_x_t < map_x + map_w - mm_to_pt(3):
            vis_east.append({'e': e, 'xT': px_x_t, 'xB': px_x_b})
        e += 1000
    first_full_e = 0
    last_full_e = max(0, len(vis_east) - 1)
    if len(vis_east) > 1 and vis_east[0]['xT'] - map_x < corner_min:
        first_full_e = 1
    if len(vis_east) > 1 and map_x + map_w - vis_east[-1]['xT'] < corner_min:
        last_full_e = max(0, len(vis_east) - 2)
    for idx, item in enumerate(vis_east):
        # Буланд ойр бол алгасах
        dist_left = item['xT'] - map_x
        dist_right = map_x + map_w - item['xT']
        if dist_left < corner_min or dist_right < corner_min:
            continue
        # UTM км easting labels — ХАССАН (дотор талын км дугаарыг харуулахгүй)
        continue
    # Visible northing lines
    vis_north = []
    n = n_min
    while n <= n_max:
        _, px_y_l = _utm_to_px(e_min, n, zone, bbox, map_x, map_y, map_w, map_h)
        _, px_y_r = _utm_to_px(e_max, n, zone, bbox, map_x, map_y, map_w, map_h)
        if map_y + mm_to_pt(3) < px_y_l < map_y + map_h - mm_to_pt(3):
            vis_north.append({'n': n, 'yL': px_y_l, 'yR': px_y_r})
        n += 1000
    first_full_n = 0
    last_full_n = max(0, len(vis_north) - 1)
    if len(vis_north) > 1 and map_y + map_h - vis_north[-1]['yL'] < corner_min:
        first_full_n = 1
    if len(vis_north) > 1 and vis_north[0]['yL'] - map_y < corner_min:
        last_full_n = max(0, len(vis_north) - 2)
    for idx, item in enumerate(vis_north):
        # Буланд ойр бол алгасах
        dist_bottom = item['yL'] - map_y
        dist_top = map_y + map_h - item['yL']
        if dist_bottom < corner_min or dist_top < corner_min:
            continue
        # UTM км northing labels — ХАССАН (дотор талын км дугаарыг харуулахгүй)
        continue
    lat_b_parts = dms_parts(lat_min)
    lat_t_parts = dms_parts(lat_max)
    lon_l_parts = dms_parts(lon_min)
    lon_r_parts = dms_parts(lon_max)
    _cell_fs = 8

    def _draw_corner(vl, vr, fy, is_bottom, lon_start_x, lon_dir, lat_p, lon_p):
        vcx = (vl + vr) / 2
        is_left = (lon_dir > 0)
        lat_ms = f"{lat_p['m']:02d}'"
        if lat_p['s']:
            lat_ms += f"{lat_p['s']:02d}\""
        lat_deg_value = int(lat_p['d'])
        lon_deg_value = int(lon_p['d'])
        lon_deg = f"{lon_deg_value}\u00b0"
        lon_ms = f"{lon_p['m']:02d}'"
        if lon_p['s']:
            lon_ms += f"{lon_p['s']:02d}\""
        if is_bottom:
            cell_b, cell_t = fy - LABEL_ZONE, fy
        else:
            cell_b, cell_t = fy, fy + LABEL_ZONE
        if is_bottom:
            lon_row_center_y = cell_b + (LABEL_ZONE * 0.1)  # Доод талд шахсан
        else:
            lon_row_center_y = cell_t - (LABEL_ZONE * 0.25)  # Дээд талд ойртуулах
        if is_left:
            cell_lon_text = lon_deg  # Left side: degree
            ext_text = lon_ms         # Right side: minutes/seconds
        else:
            cell_lon_text = lon_ms    # Left side: minutes/seconds
            ext_text = lon_deg        # Right side: degree
        c.setFillColor(black)
        _fs = _cell_fs
        _cap = _fs * 0.68  # Arial cap height (тоон тэмдэгтийн дээд хэмжээ)
        _line_pad = mm_to_pt(0.3)  # Бүх шугамнаас ижил зай
        _pad = _line_pad
        c.setFont(FONT, _fs)
        if is_bottom:
            lat_deg_y = fy + _line_pad  # градус дээр
            c.drawCentredString(vcx, lat_deg_y, f"{lat_deg_value}\u00b0")
            c.setFont(FONT, _fs)
            lat_ms_y = fy - _cap - _line_pad  # минут доор
            c.drawCentredString(vcx, lat_ms_y, lat_ms)
        else:
            lat_deg_y = fy + _line_pad  # градус ДЭЭР (fy +)
            c.drawCentredString(vcx, lat_deg_y, f"{lat_deg_value}\u00b0")
            c.setFont(FONT, _fs)
            lat_ms_y = fy - _cap - _line_pad  # минут ДООР (fy -)
            c.drawCentredString(vcx, lat_ms_y, lat_ms)
        c.setFont(FONT, _fs)
        if is_left:
            cell_text_x = vr - _pad
            c.drawRightString(cell_text_x, lon_row_center_y, cell_lon_text)
        else:
            cell_text_x = vl + _pad
            c.drawString(cell_text_x, lon_row_center_y, cell_lon_text)
        c.setFont(FONT, _fs)
        if is_left:
            ext_x = lon_start_x + _pad
            c.drawString(ext_x, lon_row_center_y, ext_text)
        else:
            ext_x = lon_start_x - _pad
            c.drawRightString(ext_x, lon_row_center_y, ext_text)
    # Bottom-left
    _draw_corner(iL, map_x-1, map_y, True, map_x, +1, lat_b_parts, lon_l_parts)
    # Bottom-right
    _draw_corner(map_x + map_w, iR, map_y, True, map_x + map_w, -1, lat_b_parts, lon_r_parts)
    # Top-left
    _draw_corner(iL, map_x, map_y + map_h, False, map_x, +1, lat_t_parts, lon_l_parts)
    # Top-right
    _draw_corner(map_x + map_w, iR, map_y + map_h, False, map_x + map_w, -1, lat_t_parts, lon_r_parts)

    # ----- 7. Graticule координатын ТЕКСТ (grid тутам = 5/15 мин) -----
    gi = grid_int['lon']
    c.setFillColor(black)
    fs_g = 9
    c.setFont(FONT, fs_g)
    # Уртраг — дээд/доод ирмэгт ХЭВТЭЭ, зебрагийн ДОТОР талд (label zone)
    lon_v = math.ceil(lon_min / gi) * gi
    while lon_v <= lon_max + 1e-9:
        x = _lon_to_x(lon_v, bbox, map_x, map_w)
        if map_x + mm_to_pt(8) < x < map_x + map_w - mm_to_pt(8):
            pp = dms_parts(lon_v)
            txt = f"{int(pp['d'])}°{pp['m']:02d}'"
            c.drawCentredString(x, iT - mm_to_pt(4.5), txt)  # дээд (доош, зураг тал руу)
            c.drawCentredString(x, iB + mm_to_pt(2.8), txt)  # доод (дээш, зураг тал руу)
        lon_v += gi
    # Өргөрөг — зүүн/баруун ирмэгт БОСОО, зебрагийн ДОТОР талд
    lat_v = math.ceil(lat_min / gi) * gi
    while lat_v <= lat_max + 1e-9:
        y = _lat_to_y_top_down(lat_v, bbox, map_y, map_h)
        if map_y + mm_to_pt(8) < y < map_y + map_h - mm_to_pt(8):
            pp = dms_parts(lat_v)
            txt = f"{int(pp['d'])}°{pp['m']:02d}'"
            # Зүүн ирмэг — 90° эргүүлж (текст зураг руу харна), label zone дотор
            c.saveState()
            c.translate(iL + mm_to_pt(3.2), y)
            c.rotate(90)
            c.drawCentredString(0, 0, txt)
            c.restoreState()
            # Баруун ирмэг — 90° эргүүлж
            c.saveState()
            c.translate(iR - mm_to_pt(3.2), y)
            c.rotate(90)
            c.drawCentredString(0, -fs_g * 0.72, txt)
            c.restoreState()
        lat_v += gi

def _draw_utm_easting_label(c, parts, x, y, pos, show_full, big_fs, small_fs):
    """Draw UTM easting label (vertical grid line)."""
    c.setFillColor(black)
    _gap = mm_to_pt(0.5)
    if show_full and parts['small']:
        # Small зүүн талд — big-н дээд талтай тэнцүүлсэн
        big_top = y + big_fs * 0.72  # big текстийн cap height
        small_y = big_top - small_fs * 0.72  # small-н cap height-г big-н cap-тай тэнцүүлэх
        c.setFont(FONT, small_fs)
        c.drawRightString(x - _gap, small_y, parts['small'])
        c.setFont(FONT, big_fs)
        c.drawString(x + _gap, y, parts['big'])
    else:
        c.setFont(FONT, big_fs)
        c.drawString(x + _gap, y, parts['big'])

def _draw_utm_northing_label(c, parts, x, y, align, show_full, big_fs, small_fs):
    """Draw UTM northing label (horizontal grid line)."""
    c.setFillColor(black)
    y_off = y + mm_to_pt(0.3)
    _gap = mm_to_pt(0.3)
    if show_full and parts['small']:
        if align == 'left':
            c.setFont(FONT, small_fs)
            c.drawString(x, y_off, parts['small'])
            sw = c.stringWidth(parts['small'], FONT, small_fs)
            c.setFont(FONT, big_fs)
            c.drawString(x + sw, y_off, parts['big'])
        else:
            c.setFont(FONT, big_fs)
            c.drawRightString(x, y_off, parts['big'])
            bw = c.stringWidth(parts['big'], FONT, big_fs)
            c.setFont(FONT, small_fs)
            c.drawRightString(x - bw, y_off, parts['small'])
    else:
        c.setFont(FONT, big_fs)
        if align == 'left':
            # Шугамын дээр талд
            c.drawString(x, y + _gap, parts['big'])
        else:
            # Шугамын дээр талд
            c.drawRightString(x, y + _gap, parts['big'])

# ---------------------------------------------------------------------------
# North arrow
# ---------------------------------------------------------------------------
def draw_north_arrow(c, cx, cy, size, rotation=0):
    """Draw a two-tone north arrow with 'N' letter."""
    c.saveState()
    c.translate(cx, cy)
    c.rotate(math.degrees(rotation) if rotation else 0)
    h = size
    w = size * 0.35
    # Left half (dark)
    p = c.beginPath()
    p.moveTo(0, h / 2)
    p.lineTo(-w / 2, -h / 2)
    p.lineTo(0, -h * 0.15)
    p.close()
    c.setFillColor(HexColor('#333333'))
    c.drawPath(p, fill=1, stroke=0)
    # Right half (light)
    p = c.beginPath()
    p.moveTo(0, h / 2)
    p.lineTo(w / 2, -h / 2)
    p.lineTo(0, -h * 0.15)
    p.close()
    c.setFillColor(HexColor('#aaaaaa'))
    c.setStrokeColor(HexColor('#333333'))
    c.setLineWidth(1)
    c.drawPath(p, fill=1, stroke=1)
    # "N" letter
    c.setFillColor(HexColor('#222222'))
    c.setFont(FONT_BOLD, size * 0.38)
    c.drawCentredString(0, -h / 2 - size * 0.38 - 2, 'N')
    c.restoreState()

# ---------------------------------------------------------------------------
# Legend
# ---------------------------------------------------------------------------
def draw_legend(c, layers, leg_x, leg_y, leg_w, leg_h, legend_columns=1):
    """Draw legend panel with layer symbols and names."""
    # Border
    c.setStrokeColor(black)
    c.setLineWidth(1)
    c.rect(leg_x, leg_y, leg_w, leg_h, stroke=1, fill=0)
    pad = mm_to_pt(2)
    row_h = mm_to_pt(5)
    icon_sz = mm_to_pt(3.5)
    fs = 7
    title_fs = 8
    col_w = (leg_w - 2 * pad) / legend_columns
    # Title
    c.setFont(FONT_BOLD, title_fs)
    c.setFillColor(HexColor('#222222'))
    title_y = leg_y + leg_h - pad - title_fs
    c.drawString(leg_x + pad, title_y, 'Таних тэмдэг')
    start_y = title_y - mm_to_pt(3)
    visible = [l for l in (layers or []) if l.get('visible', True)]
    for i, layer in enumerate(visible):
        col = i % legend_columns
        row = i // legend_columns
        lx = leg_x + pad + col * col_w
        ly = start_y - row * row_h
        if ly < leg_y + pad:
            break
        gt = (layer.get('geometryType', '') or '').lower()
        color = layer.get('color', '#000000')
        hex_color = HexColor(color) if color.startswith('#') else black
        if 'point' in gt or gt == 'p':
            c.setFillColor(hex_color)
            c.circle(lx + icon_sz / 2, ly + icon_sz / 3, icon_sz / 3, stroke=0, fill=1)
        elif 'line' in gt or gt == 'l':
            c.setStrokeColor(hex_color)
            c.setLineWidth(2)
            c.line(lx, ly + icon_sz / 2, lx + icon_sz, ly + icon_sz / 2)
        else:
            # Polygon
            try:
                r_val = int(color[1:3], 16) / 255
                g_val = int(color[3:5], 16) / 255
                b_val = int(color[5:7], 16) / 255
                fill_color = Color(r_val, g_val, b_val, 0.2)
            except (ValueError, IndexError):
                fill_color = Color(0, 0, 0, 0.2)
            c.setFillColor(fill_color)
            c.setStrokeColor(hex_color)
            c.setLineWidth(1.5)
            c.rect(lx, ly, icon_sz, icon_sz - 2, stroke=1, fill=1)
        # Label
        c.setFillColor(HexColor('#333333'))
        c.setFont(FONT, fs)
        max_tw = col_w - icon_sz - mm_to_pt(2)
        name = layer.get('name', f"Layer {layer.get('id', '?')}")
        # Truncate if too wide
        while c.stringWidth(name, FONT, fs) > max_tw and len(name) > 3:
            name = name[:-1]
        c.drawString(lx + icon_sz + mm_to_pt(1.5), ly, name)

# ---------------------------------------------------------------------------
# Scale bar & footer
# ---------------------------------------------------------------------------
def draw_scale_bar_and_footer(c, layout, scale, map_x, map_y, map_w, map_h, show_grid):
    """Draw scale value, scale bar, and footer text."""
    show_scale_bar = layout.get('showScaleBar', True)
    show_scale_value = layout.get('showScaleValue', True)
    if not show_scale_bar and not show_scale_value:
        return
    # Footer position — below the grid frame (or map border)
    if show_grid:
        frame_outer_off = mm_to_pt(2) + mm_to_pt(0.4) + mm_to_pt(8)
    else:
        frame_outer_off = 0
    outer_frame_bottom = map_y - frame_outer_off
    footer_y = outer_frame_bottom - mm_to_pt(10)
    footer_cx = map_x + map_w / 2
    cur_y = footer_y
    # Scale value: "1 : X,XXX"
    if show_scale_value and scale:
        scale_fs = 19
        c.setFillColor(HexColor('#111111'))
        c.setFont(FONT_BOLD, scale_fs)
        c.drawCentredString(footer_cx, cur_y, f"1 : {scale:,}".replace(',', ' '))
        cur_y -= mm_to_pt(5)
    # Scale bar
    if show_scale_bar and scale:
        m_per_mm = scale / 1000
        total_bar_w = map_w * 0.275
        left_bar_px = total_bar_w / 2
        right_bar_px = total_bar_w - left_bar_px
        bar_h = mm_to_pt(2)
        half_h = bar_h / 2
        bar_x = footer_cx - total_bar_w / 2
        left_divs = 10
        right_divs = 5
        label_pad = mm_to_pt(3.5)
        desc_fs = 7
        # Description text
        c.setFillColor(HexColor('#333333'))
        c.setFont(FONT, desc_fs)
        c.drawCentredString(footer_cx, cur_y+mm_to_pt(1), f"1 сантиметрт {int(m_per_mm * 10)} метр багтана")
        cur_y -= mm_to_pt(6)
        # Labels
        c.setFillColor(black)
        c.setFont(FONT, desc_fs)
        c.drawString(bar_x - label_pad, cur_y + bar_h + 2, 'м1000')
        c.drawCentredString(bar_x + left_bar_px * 0.25, cur_y + bar_h + 2, '750')
        c.drawCentredString(bar_x + left_bar_px * 0.5, cur_y + bar_h + 2, '500')
        c.drawCentredString(bar_x + left_bar_px * 0.75, cur_y + bar_h + 2, '250')
        c.drawCentredString(bar_x + left_bar_px, cur_y + bar_h + 2, '0')
        c.drawRightString(bar_x + total_bar_w + label_pad, cur_y + bar_h + 2, '1км')
        # Left bar: bottom-half alternating black segments
        bar_top_y = cur_y
        c.setFillColor(black)
        c.setStrokeColor(black)
        c.setLineWidth(0.4)
        left_div_w = left_bar_px / left_divs
        for i in range(left_divs):
            if i % 2 == 0:
                c.rect(bar_x + i * left_div_w, bar_top_y, left_div_w, half_h, stroke=0, fill=1)
        # 3 horizontal lines
        c.line(bar_x, bar_top_y + bar_h, bar_x + left_bar_px, bar_top_y + bar_h)
        c.line(bar_x, bar_top_y + half_h, bar_x + left_bar_px, bar_top_y + half_h)
        c.line(bar_x, bar_top_y, bar_x + left_bar_px, bar_top_y)
        # Vertical ticks (дээш жаахан илүү гаргасан)
        tick_ext = mm_to_pt(1)
        for i in range(left_divs + 1):
            tx = bar_x + i * left_div_w
            c.line(tx, bar_top_y, tx, bar_top_y + bar_h + tick_ext)
        # Right bar: outlined + dividers
        c.rect(bar_x + left_bar_px, bar_top_y, right_bar_px, bar_h, stroke=1, fill=0)
        right_div_w = right_bar_px / right_divs
        for i in range(1, right_divs):
            tx = bar_x + left_bar_px + i * right_div_w
            c.line(tx, bar_top_y, tx, bar_top_y + bar_h)
        cur_y = bar_top_y - mm_to_pt(5)
    # Footer extra text
    extra_fs = 6.5
    c.setFillColor(black)
    c.setFont(FONT, extra_fs)
    line_gap = mm_to_pt(3.5)
    now = datetime.datetime.now()
    yr = now.year
    qtr = ['I', 'II', 'III', 'IV'][now.month // 4]
    # Төвийн footer тэмдэглэл — булангийн тексттэй давхцахаас зайлсхийж default унтраав
    if layout.get('showFooterLines', False):
        footer_lines = [
            'Хаялбарыг 10 метрээр татав',
            'Балтийн тэнгисийн өндрийн тогтолцоо',
            f'Байр зүйн зургийг {yr} оны сансрын зургийг ашиглан',
            f'{yr} оны {qtr} улиралд зохиов.',
        ]
        for i, line in enumerate(footer_lines):
            c.drawCentredString(footer_cx, cur_y - i * line_gap, line)

# ---------------------------------------------------------------------------
# Crop marks
# ---------------------------------------------------------------------------
def draw_crop_marks(c, page_w, page_h):
    cm_len = mm_to_pt(5)
    cm_perp = mm_to_pt(3)
    inset = mm_to_pt(5)  # Margin дотор (15мм захын зайн дунд)
    c.setStrokeColor(black)
    c.setLineWidth(0.8)
    cx = page_w / 2
    cy = page_h / 2
    # Top center
    c.line(cx - cm_len, page_h - inset, cx + cm_len, page_h - inset)
    c.line(cx, page_h - inset, cx, page_h - inset - cm_perp)
    # Bottom center
    c.line(cx - cm_len, inset, cx + cm_len, inset)
    c.line(cx, inset, cx, inset + cm_perp)
    # Left center
    c.line(inset, cy - cm_len, inset, cy + cm_len)
    c.line(inset, cy, inset + cm_perp, cy)
    # Right center
    c.line(page_w - inset, cy - cm_len, page_w - inset, cy + cm_len)
    c.line(page_w - inset, cy, page_w - inset - cm_perp, cy)


# ===================== pdf_renderer.py =====================

logger = logging.getLogger(__name__)

# (фонт бүртгэл дээд header-ийн _ensure_fonts-д) 


class MapPDFRenderer:
    """Generate a print-quality PDF map layout."""

    def __init__(self, params):
        _ensure_fonts()

        self.paper = params['paper']
        self.map_params = params['map']
        self.layers = params['layers']
        self.layout = params['layout']

        # Paper dimensions in points
        w_mm = self.paper['widthMM']
        h_mm = self.paper['heightMM']
        self.page_w = mm_to_pt(w_mm)
        self.page_h = mm_to_pt(h_mm)
        self.dpi = self.map_params['dpi']
        self.bbox = self.map_params['bbox']
        self.scale = self.map_params['scale']
        self.rotation = self.map_params.get('rotation', 0)
        self.show_legend = self.layout.get('showLegend', True)

        # Спец захын зай (дээд60/зүүн30/баруун30/доод40мм) → зургийн (хүрээ доторх)
        # талбай. Дүрсийг fit_layout-ийн bbox-оор ГОЛД нь төвлөрүүлсэн.
        self.map_x = mm_to_pt(RM_LEFT + RM_FRAME_MM)
        self.map_w = self.page_w - mm_to_pt(RM_LEFT + RM_RIGHT + 2 * RM_FRAME_MM)
        self.map_y = mm_to_pt(RM_BOT + RM_FRAME_MM)
        self.map_h = self.page_h - mm_to_pt(RM_TOP + RM_BOT + 2 * RM_FRAME_MM)

        # Гадна хүрээний ирмэг (гарчиг тэгшлэх + crop)
        outer_off = mm_to_pt(2) + mm_to_pt(0.4) + mm_to_pt(8)
        self.frame_l = self.map_x - outer_off
        self.frame_r = self.map_x + self.map_w + outer_off
        self.header_h = mm_to_pt(RM_TOP)
        self.margin = mm_to_pt(RM_LEFT)

    def render(self):
        """Generate PDF and return bytes."""
        buf = BytesIO()
        c = rl_canvas.Canvas(buf, pagesize=(self.page_w, self.page_h))
        c.setTitle('Map Print')

        # 1. White background
        c.setFillColorRGB(1, 1, 1)
        c.rect(0, 0, self.page_w, self.page_h, stroke=0, fill=1)

        # 2. Fetch and draw map image
        self._draw_map_image(c)

        # 2b. Сумын хил (boundary) — зургийн дээр
        draw_boundary(c, self.layout, self.bbox,
                      self.map_x, self.map_y, self.map_w, self.map_h)

        # 2c. Индексийн тор (баруун дээд булангаас, 10см/нүд)
        if self.layout.get('showIndexGrid', True) and self.bbox:
            draw_index_grid(c, self.layout, self.bbox, self.scale,
                            self.map_x, self.map_y, self.map_w, self.map_h)

        # 3. Grid frame
        if self.layout.get('showGrid', True) and self.bbox:
            draw_grid_frame(
                c, self.layout, self.bbox, self.scale,
                self.map_x, self.map_y, self.map_w, self.map_h,
            )
        else:
            # Simple border
            c.setStrokeColor(black)
            c.setLineWidth(1.5)
            c.rect(self.map_x, self.map_y, self.map_w, self.map_h, stroke=1, fill=0)

        # 4. Header (гарчиг дээд захын зайд)
        draw_header(
            c, self.layout, self.page_w, self.page_h,
            mm_to_pt(8), self.header_h, self.frame_l, self.frame_r,
        )

        # 5. Масштаб (хүрээний доор төвд) + булангийн текстүүд (15мм доош)
        draw_scale_bar_and_footer(
            c, self.layout, self.scale,
            self.map_x, self.map_y, self.map_w, self.map_h, True,
        )
        draw_corner_texts(c, self.layout, self.map_x, self.map_y, self.map_w)

        # 6. North arrow (хүрээн доторх баруун дээд)
        if self.layout.get('showNorthArrow', True):
            arrow_sz = mm_to_pt(8)
            draw_north_arrow(
                c,
                self.map_x + self.map_w - mm_to_pt(6),
                self.map_y + self.map_h - mm_to_pt(6) - arrow_sz / 2,
                arrow_sz,
                self.rotation,
            )

        # 7. Таних тэмдэг — зургийн хүрээ ДОТОР, хамгийн сул зайтай буланд
        if self.show_legend:
            draw_legend_inside(
                c, self.layers, self.layout, self.bbox,
                self.map_x, self.map_y, self.map_w, self.map_h,
            )

        # 8. Crop marks
        draw_crop_marks(c, self.page_w, self.page_h)

        c.save()
        buf.seek(0)
        return buf.read()

    def _draw_map_image(self, c):
        """Fetch composited map image from WMS/tiles and draw on canvas."""
        # Calculate pixel dimensions for map area at target DPI
        map_w_inch = self.map_w / 72.0
        map_h_inch = self.map_h / 72.0
        px_w = int(map_w_inch * self.dpi)
        px_h = int(map_h_inch * self.dpi)

        logger.info(
            "Fetching map image: %dx%d px at %d DPI, bbox=%s",
            px_w, px_h, self.dpi, self.bbox,
        )

        try:
            map_img = composite_layers(
                self.layers, self.bbox, px_w, px_h, self.dpi,
                scale=self.scale,
            )

            # Convert PIL Image to ReportLab ImageReader
            img_buf = BytesIO()
            map_img.save(img_buf, format='PNG')
            img_buf.seek(0)
            img_reader = ImageReader(img_buf)

            # Draw map image
            c.drawImage(
                img_reader,
                self.map_x, self.map_y,
                width=self.map_w, height=self.map_h,
                mask='auto',
            )
        except Exception as exc:
            logger.exception("Failed to fetch/draw map image: %s", exc)
            # Draw placeholder with error text
            c.setFillColorRGB(0.95, 0.95, 0.95)
            c.rect(self.map_x, self.map_y, self.map_w, self.map_h, stroke=0, fill=1)
            c.setFillColorRGB(0.5, 0.5, 0.5)
            c.setFont('DejaVuSans', 12)
            c.drawCentredString(
                self.map_x + self.map_w / 2,
                self.map_y + self.map_h / 2,
                f'Map image error: {exc}',
            )

        # Map border
        c.setStrokeColor(black)
        c.setLineWidth(1.5)
        c.rect(self.map_x, self.map_y, self.map_w, self.map_h, stroke=1, fill=0)


# ===================== geoname нэмэлт =====================

def _draw_rings(c, rings, bbox, map_x, map_y, map_w, map_h):
    for ring in rings:
        if len(ring) < 2:
            continue
        path = c.beginPath()
        for i, (lon, lat) in enumerate(ring):
            x = _lon_to_x(lon, bbox, map_x, map_w)
            y = _lat_to_y_top_down(lat, bbox, map_y, map_h)
            if i == 0:
                path.moveTo(x, y)
            else:
                path.lineTo(x, y)
        path.close()
        c.drawPath(path, stroke=1, fill=0)


def draw_boundary(c, layout, bbox, map_x, map_y, map_w, map_h):
    """Сонгосон сумын хил (ТОД нил ягаан) + хил залгаа сумдын хил (БҮДЭГ зураас) +
    хил залгаа сумын нэрийг сонгосон ХИЛИЙН ШУГАМЫН ДАГУУ (зургийн дотор) бичнэ.
    Гадна хүрээнд сумын нэр ТАВИХГҮЙ (тэнд нэрлэвэр)."""
    sel = layout.get('boundary') or []
    neighbors = layout.get('neighbors') or []
    if not bbox or (not sel and not neighbors):
        return
    c.saveState()
    p = c.beginPath()
    p.rect(map_x, map_y, map_w, map_h)
    c.clipPath(p, stroke=0)
    c.setLineJoin(1)

    # 1) Хөрш сумдын хилийн дагуу БҮДЭГ ягаан зурвас (тодруулга — сонгосноос бүдэг)
    for nb in neighbors:
        nband = nb.get('band') or []
        if not nband:
            continue
        c.setFillColor(Color(0.85, 0.45, 0.78, 0.15))
        npath = c.beginPath()
        for ring in nband:
            if len(ring) < 3:
                continue
            for i, (lon, lat) in enumerate(ring):
                x = _lon_to_x(lon, bbox, map_x, map_w)
                y = _lat_to_y_top_down(lat, bbox, map_y, map_h)
                if i == 0:
                    npath.moveTo(x, y)
                else:
                    npath.lineTo(x, y)
            npath.close()
        c.drawPath(npath, stroke=0, fill=1)

    # 1a) Хил залгаа сумдын хил — бүдэг тасархай
    c.setStrokeColor(Color(0.5, 0.5, 0.5, 0.7))
    c.setLineWidth(0.7)
    c.setDash(mm_to_pt(1.2), mm_to_pt(1.0))
    for nb in neighbors:
        _draw_rings(c, nb.get('rings') or [], bbox, map_x, map_y, map_w, map_h)
    c.setDash()

    # 1b) Хилийн ШУГАМААС 2 тийш 500м зурвас — цайвар ягаан дүүргэлт (line buffer band)
    band = layout.get('buffer') or []
    if band:
        c.setFillColor(Color(0.85, 0.45, 0.78, 0.34))
        path = c.beginPath()
        for ring in band:
            if len(ring) < 3:
                continue
            for i, (lon, lat) in enumerate(ring):
                x = _lon_to_x(lon, bbox, map_x, map_w)
                y = _lat_to_y_top_down(lat, bbox, map_y, map_h)
                if i == 0:
                    path.moveTo(x, y)
                else:
                    path.lineTo(x, y)
            path.close()
        c.drawPath(path, stroke=0, fill=1)  # nonzero winding → анулус band дүүрнэ

    # 2) Сонгосон сумын хил — ХАР DASH шугам (-·-·) ягаан band-ийн голд
    c.setStrokeColor(Color(0.1, 0.1, 0.1, 0.95))
    c.setLineWidth(1.5)
    c.setDash(mm_to_pt(3), mm_to_pt(1.6))
    _draw_rings(c, sel, bbox, map_x, map_y, map_w, map_h)
    c.setDash()

    # 4) Хил залгаа сумын нэрийг ХУВААЛЦАХ хилийн ШУГАМЫН ДАГУУ, ГАДНА талд зай
    #    аван, бүх уртад тэнцүүлж сунгаж (letter-spacing) бичнэ.
    fs = 14
    gap_out = mm_to_pt(11.0)   # хилийн шугамнаас гадагш зай
    # Сонгосон хилийн ойролцоо төв (canvas) — ГАДАГШ чиглэлийг үүнээс тодорхойлно
    _sx = _sy = 0.0
    _sn = 0
    for ring in sel:
        for lon, lat in ring:
            _sx += _lon_to_x(lon, bbox, map_x, map_w)
            _sy += _lat_to_y_top_down(lat, bbox, map_y, map_h)
            _sn += 1
    scx = _sx / _sn if _sn else (map_x + map_w / 2)
    scy = _sy / _sn if _sn else (map_y + map_h / 2)
    for nb in neighbors:
        name = nb.get('name')
        border = nb.get('border') or []
        if not name or len(border) < 2:
            continue
        pts = [(_lon_to_x(lon, bbox, map_x, map_w),
                _lat_to_y_top_down(lat, bbox, map_y, map_h))
               for lon, lat in border]
        seglen, total = [], 0.0
        for i in range(len(pts) - 1):
            d = math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1])
            seglen.append(d)
            total += d
        if total < fs * 1.5:
            continue

        def _at(dist):
            acc = 0.0
            for i in range(len(seglen)):
                if acc + seglen[i] >= dist:
                    t = (dist - acc) / (seglen[i] or 1e-6)
                    x = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t
                    y = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t
                    return (x, y, pts[i + 1][0] - pts[i][0],
                            pts[i + 1][1] - pts[i][1])
                acc += seglen[i]
            return (pts[-1][0], pts[-1][1], pts[-1][0] - pts[-2][0],
                    pts[-1][1] - pts[-2][1])

        n = len(name)
        f0, f1 = 0.20, 0.80   # хилийн дунд 60%-д голлуулна (хэт сунжрахгүй)
        c.setFont(FONT_BOLD, fs)
        lon0, lat0, lon1, lat1 = bbox
        tdelta = max(fs * 4.0, total * 0.16)  # тангенсыг ИЛҮҮ гөлийлгөх цонх
        # 1) Тэмдэгт бүрийн БАЙРЛАЛ + (а) ГӨЛГӨР тангенс текстийн өнцөгт,
        #    (б) ЛОКАЛ тангенс — ГАДАГШ талыг тодорхойлоход (хэт smoothing талыг
        #    буруулдаг тул тусдаа жижиг span ашиглана).
        ldelta = max(mm_to_pt(2.5), total * 0.02)
        slots = []
        for idx in range(n):
            frac = (f0 + (f1 - f0) * ((idx + 0.5) / n)) if n > 1 else 0.5
            d_c = frac * total
            x, y, _, _ = _at(d_c)
            xa, ya, _, _ = _at(max(0.0, d_c - tdelta))
            xb2, yb2, _, _ = _at(min(total, d_c + tdelta))
            stx, sty = (xb2 - xa), (yb2 - ya)
            sl = math.hypot(stx, sty) or 1.0
            ang = math.degrees(math.atan2(sty / sl, stx / sl))
            lxa, lya, _, _ = _at(max(0.0, d_c - ldelta))
            lxb, lyb, _, _ = _at(min(total, d_c + ldelta))
            ltx, lty = (lxb - lxa), (lyb - lya)
            ll = math.hypot(ltx, lty) or 1.0
            slots.append([x, y, ang, ltx / ll, lty / ll])
        # 2) Өнцгийг UNWRAP — залгаа тэмдэгт огцом эргэхгүй (тасралтгүй)
        for i in range(1, n):
            while slots[i][2] - slots[i - 1][2] > 180:
                slots[i][2] -= 360
            while slots[i][2] - slots[i - 1][2] < -180:
                slots[i][2] += 360
        # 3) Үгийн дундаж чиглэл — зүүн/доош харвал БҮХ үгийг эргүүлж (180) reverse
        m = ((sum(s[2] for s in slots) / n) + 180.0) % 360.0 - 180.0
        mr = math.radians(m)
        flip_word = (math.cos(mr) < -1e-6
                     or (abs(math.cos(mr)) <= 1e-6 and math.sin(mr) < 0))
        chars = name[::-1] if flip_word else name

        def _pt_inside(px, py):
            return _point_in_rings(
                lon0 + (px - map_x) / map_w * (lon1 - lon0),
                lat0 + (py - map_y) / map_h * (lat1 - lat0), sel)

        def _canvas_perp(sx, sy, sltx, slty):
            # ЛОКАЛ тангенс → ГАЗАРЫН (cos-corrected) перпендикуляр → CANVAS нэгж.
            # north = өндөр y тул lat урвуу нь lat0 + (...).
            sblat = lat0 + (sy - map_y) / map_h * (lat1 - lat0)
            sc = math.cos(math.radians(sblat)) or 1e-6
            gtx = (sltx * (lon1 - lon0) / map_w) * sc
            gty = slty * (lat1 - lat0) / map_h
            gpx, gpy = -gty, gtx
            cnx = (gpx / sc) * (map_w / (lon1 - lon0))
            cny = gpy * (map_h / (lat1 - lat0))
            cl = math.hypot(cnx, cny) or 1.0
            return cnx / cl, cny / cl

        # ГАДАГШ ТАЛЫГ хазайлгасан перпендикулярт бус — тал бүрийн эргэн тойронд
        # 24 чиглэл, өсөн радиусаар сканердаж, ХИЛ ДОТОР БИШ цэгүүдээс перпендикулярт
        # хамгийн ойрыг сонгоно (гадна талд байх БАТАЛГАА + цэвэрхэн байрлал).
        _dirs = [(math.cos(math.radians(a)), math.sin(math.radians(a)))
                 for a in range(0, 360, 15)]
        _radii = [gap_out, gap_out * 1.5, gap_out * 2.2, gap_out * 3.2]

        c.setFillColor(HexColor('#7a004b'))  # дэвсгэргүй (halo арилгасан)
        for k in range(n):
            x, y, ang, ltx, lty = slots[k]
            if flip_word:
                ang += 180.0
            cnx, cny = _canvas_perp(x, y, ltx, lty)  # перпендикуляр тэнхлэг
            best = None
            for radius in _radii:
                for dx, dy in _dirs:
                    if _pt_inside(x + dx * radius, y + dy * radius):
                        continue
                    score = abs(dx * cnx + dy * cny)  # перпендикулярт ойр нь дээр
                    if best is None or score > best[0]:
                        best = (score, x + dx * radius, y + dy * radius)
                if best:
                    break
            if best:
                xo, yo = best[1], best[2]
            else:
                xo, yo = x + cnx * gap_out, y + cny * gap_out
            c.saveState()
            c.translate(xo, yo)
            c.rotate(ang)
            c.drawCentredString(0, 0, chars[k])
            c.restoreState()
    c.restoreState()


_MN_INDEX_LETTERS = list(
    'АБВГДЕЁЖЗИЙКЛМНОӨПРСТУҮФХЦЧШЩЪЫЬЭЮЯ')


def draw_index_grid(c, layout, bbox, scale, map_x, map_y, map_w, map_h):
    """Нэрийн индексийн тор — DEM-г БАГТААСАН ТЭГШ ӨНЦӨГТ дотор.
    Эгцлэл: сонгосон сумын баруун дээд булан, 1 нүд = 10см (цаасан дээр).
    Шугам: DEM ДОТОР alpha 0.7 хар; DEM-ийн ГАДНА (тэгш өнцөгт дотор) бүдэг хар.
    Шошго: багана 1,2,3.. (зүүн→баруун) дээд/доод; мөр А,Б,В.. (дээш→доош)
    зүүн/баруун — тэгш өнцөгтийн гадна, зургийн ХҮРЭЭ ДОТОР."""
    rings = layout.get('boundary') or []
    if not rings or not bbox:
        return
    lons = [pt[0] for ring in rings for pt in ring if len(pt) >= 2]
    lats = [pt[1] for ring in rings for pt in ring if len(pt) >= 2]
    if not lons or not lats:
        return
    clip_polys = layout.get('indexClip') or []
    # DEM-г багтаасан тэгш өнцөгт (canvas) — indexClip (union+5км) extent
    cxs, cys = [], []
    if clip_polys:
        for poly in clip_polys:
            for lon, lat in poly.get('exterior') or []:
                cxs.append(_lon_to_x(lon, bbox, map_x, map_w))
                cys.append(_lat_to_y_top_down(lat, bbox, map_y, map_h))
    if not cxs:
        for ring in rings:
            for lon, lat in ring:
                cxs.append(_lon_to_x(lon, bbox, map_x, map_w))
                cys.append(_lat_to_y_top_down(lat, bbox, map_y, map_h))
    if not cxs:
        return
    dem_l, dem_r = min(cxs), max(cxs)
    dem_b, dem_t = min(cys), max(cys)
    # эгцлэл — сумын баруун дээд булан
    ox = _lon_to_x(max(lons), bbox, map_x, map_w)
    oy = _lat_to_y_top_down(max(lats), bbox, map_y, map_h)
    cell = mm_to_pt(100)
    # БҮТЭН нүд гаргахаар тэгш өнцөгтийн ирмэгийг торны шугам руу СУНГАНА (таллахгүй)
    ol = ox - math.ceil((ox - dem_l) / cell) * cell
    orr = ox - math.floor((ox - dem_r) / cell) * cell
    ot = oy - math.floor((oy - dem_t) / cell) * cell
    ob = oy - math.ceil((oy - dem_b) / cell) * cell
    if orr - ol < 1 or ot - ob < 1:
        return
    i0 = int(round((ox - orr) / cell))
    i1 = int(round((ox - ol) / cell))
    vx = sorted(ox - i * cell for i in range(i0, i1 + 1))   # зүүн→баруун
    j0 = int(round((oy - ot) / cell))
    j1 = int(round((oy - ob) / cell))
    hy = sorted((oy - j * cell for j in range(j0, j1 + 1)), reverse=True)  # дээш→доош

    # DEM полигон (canvas) — нүд DEM-тэй огтлолцож буй эсэхийг шалгах + шошго
    dem_xy = []
    for poly in clip_polys:
        ext = poly.get('exterior') or []
        if len(ext) >= 3:
            dem_xy.append([(_lon_to_x(lon, bbox, map_x, map_w),
                            _lat_to_y_top_down(lat, bbox, map_y, map_h))
                           for lon, lat in ext])

    def _vert_extremes(cx):
        ys = []
        for ring in dem_xy:
            for i in range(len(ring) - 1):
                x1, y1 = ring[i]
                x2, y2 = ring[i + 1]
                if x1 == x2:
                    continue
                if (x1 <= cx <= x2) or (x2 <= cx <= x1):
                    ys.append(y1 + (y2 - y1) * (cx - x1) / (x2 - x1))
        return (max(ys), min(ys)) if ys else (None, None)

    def _horiz_extremes(cy):
        xs = []
        for ring in dem_xy:
            for i in range(len(ring) - 1):
                x1, y1 = ring[i]
                x2, y2 = ring[i + 1]
                if y1 == y2:
                    continue
                if (y1 <= cy <= y2) or (y2 <= cy <= y1):
                    xs.append(x1 + (x2 - x1) * (cy - y1) / (y2 - y1))
        return (min(xs), max(xs)) if xs else (None, None)

    def _in_dem(px, py):
        inside = False
        for ring in dem_xy:
            nn = len(ring)
            jj = nn - 1
            for ii in range(nn):
                xi, yi = ring[ii]
                xj, yj = ring[jj]
                if ((yi > py) != (yj > py)) and \
                   (px < (xj - xi) * (py - yi) / ((yj - yi) or 1e-9) + xi):
                    inside = not inside
                jj = ii
        return inside

    # DEM-тэй огтлолцох нүднүүдийг тогтооно (төв + булан + ирмэгийн дунд цэгээр)
    cells = set()
    for i in range(len(vx) - 1):
        x1, x2 = vx[i], vx[i + 1]
        cxm = (x1 + x2) / 2
        for j in range(len(hy) - 1):
            yt, yb = hy[j], hy[j + 1]
            cym = (yt + yb) / 2
            probe = ((cxm, cym), (x1, yt), (x2, yt), (x1, yb), (x2, yb),
                     (cxm, yt), (cxm, yb), (x1, cym), (x2, cym))
            if any(_in_dem(px, py) for px, py in probe):
                cells.add((i, j))
    # БҮТЭН нүднүүдийг (цагаан хэсэг хүртэл) МАШ БҮДЭГ зурна — давхар зураалтгүй
    c.saveState()
    rp = c.beginPath()
    rp.rect(map_x, map_y, map_w, map_h)
    c.clipPath(rp, stroke=0)
    c.setStrokeColor(Color(0, 0, 0, 0.16))   # МАШ бүдэг
    c.setLineWidth(0.5)
    c.setDash()
    for i in range(len(vx)):                 # босоо сегментүүд
        for j in range(len(hy) - 1):
            if (i - 1, j) in cells or (i, j) in cells:
                c.line(vx[i], hy[j], vx[i], hy[j + 1])
    for j in range(len(hy)):                 # хэвтээ сегментүүд
        for i in range(len(vx) - 1):
            if (i, j - 1) in cells or (i, j) in cells:
                c.line(vx[i], hy[j], vx[i + 1], hy[j])
    c.restoreState()

    # Шошго — ТОО багана бүрийн ХАРАГДАЖ БУЙ нүднүүдийн дээд/доод ирмэгт, ҮСЭГ мөр
    # бүрийн зүүн/баруун ирмэгт (хоосон зайд биш, торон дээр). DEM-тэй огтлолцох
    # багана/мөрийг 1,2,3.. / А,Б,В.. дугаарлана.
    cols_with = sorted({i for (i, _j) in cells})   # зүүн→баруун
    rows_with = sorted({j for (_i, j) in cells})   # дээш→доош (j өсөх = доош)
    col_top, col_bot, row_lft, row_rgt = {}, {}, {}, {}
    for (i, j) in cells:
        if i not in col_top or j < col_top[i]:
            col_top[i] = j
        if i not in col_bot or j > col_bot[i]:
            col_bot[i] = j
        if j not in row_lft or i < row_lft[j]:
            row_lft[j] = i
        if j not in row_rgt or i > row_rgt[j]:
            row_rgt[j] = i
    fs = 18
    c.setFillColor(black)
    c.setFont(FONT_BOLD, fs)
    for n_i, i in enumerate(cols_with):
        cx = (vx[i] + vx[i + 1]) / 2
        yt = hy[col_top[i]]          # тухайн баганын хамгийн ДЭЭД нүдний дээд ирмэг
        yb = hy[col_bot[i] + 1]      # хамгийн ДООД нүдний доод ирмэг
        c.drawCentredString(cx, yt + mm_to_pt(3.5), str(n_i + 1))
        c.drawCentredString(cx, yb - mm_to_pt(6.5), str(n_i + 1))
    for n_j, j in enumerate(rows_with):
        if n_j >= len(_MN_INDEX_LETTERS):
            break
        cy = (hy[j] + hy[j + 1]) / 2 - fs * 0.35
        xl = vx[row_lft[j]]          # тухайн мөрийн хамгийн ЗҮҮН нүдний зүүн ирмэг
        xr = vx[row_rgt[j] + 1]      # хамгийн БАРУУН нүдний баруун ирмэг
        ch = _MN_INDEX_LETTERS[n_j]
        c.drawCentredString(xl - mm_to_pt(6), cy, ch)
        c.drawCentredString(xr + mm_to_pt(6), cy, ch)


def draw_corner_texts(c, layout, map_x, map_y, map_w):
    """Хүрээний доод ирмэгээс 15мм доош зүүн доод (3 мөр) ба баруун доод текст."""
    outer_off = mm_to_pt(2) + mm_to_pt(0.4) + mm_to_pt(8)
    frame_bottom = map_y - outer_off
    start_y = frame_bottom - mm_to_pt(15)
    # Байрыг сольсон: гүйцэтгэгч/огноо ЗҮҮН доод, гэрчилгээ/газарчин БАРУУН доод
    left = layout.get('cornerLeft') or [
        'Гүйцэтгэгч байгууллага', 'Огноо',
    ]
    right = layout.get('cornerRight') or [
        'Газар зүйн нэрийг ........ онд /гүйцэтгэгчийн нэр/ тодруулан тогтоов.',
        'Газарчин /нэр/',
        'Зураг хянасан ........ Зураг зүйн Зөвлөх инженер',
    ]
    c.setFillColor(black)
    c.setFont(FONT, 11)
    gap = mm_to_pt(5)
    for i, ln in enumerate(left):
        c.drawString(map_x, start_y - i * gap, ln)
    for i, ln in enumerate(right):
        c.drawRightString(map_x + map_w, start_y - i * gap, ln)


def _point_in_rings(lon, lat, rings):
    """Цэг олон өнцөгт (rings) дотор эсэх (ray casting, гадаад цагираг)."""
    inside = False
    for ring in rings:
        n = len(ring)
        j = n - 1
        for i in range(n):
            xi, yi = ring[i][0], ring[i][1]
            xj, yj = ring[j][0], ring[j][1]
            if ((yi > lat) != (yj > lat)) and \
               (lon < (xj - xi) * (lat - yi) / ((yj - yi) or 1e-12) + xi):
                inside = not inside
            j = i
    return inside


def draw_legend_inside(c, layers, layout, bbox, map_x, map_y, map_w, map_h):
    """Таних тэмдгийг зургийн хүрээ ДОТОР, дүрсэд хучигдаагүй хамгийн сул буланд."""
    rings = layout.get('boundary') or []
    lw = mm_to_pt(78)   # 14pt бичиглэлд тааруулсан өргөн
    lh = mm_to_pt(42)
    pad = mm_to_pt(5)
    # 4 булангаас дүрсэд (rings) хучигдаагүйг эрэмбэлж сонгоно
    corners = [
        (map_x + pad, map_y + map_h - pad - lh),            # дээд-зүүн
        (map_x + map_w - pad - lw, map_y + map_h - pad - lh),  # дээд-баруун
        (map_x + pad, map_y + pad),                          # доод-зүүн
        (map_x + map_w - pad - lw, map_y + pad),             # доод-баруун
    ]

    def covered(bx, by):
        # хайрцгийн төвийг lon/lat-д буцаагаад дүрс дотор эсэхийг шалгана
        cx = bx + lw / 2
        cy = by + lh / 2
        lon = bbox[0] + (cx - map_x) / map_w * (bbox[2] - bbox[0])
        lat = bbox[1] + (cy - map_y) / map_h * (bbox[3] - bbox[1])
        return _point_in_rings(lon, lat, rings)

    spot = next((c0 for c0 in corners if not covered(*c0)), corners[1])
    bx, by = spot

    c.saveState()
    c.setFillColor(white)
    c.setStrokeColor(black)
    c.setLineWidth(0.8)
    c.rect(bx, by, lw, lh, stroke=1, fill=1)
    c.setFillColor(black)
    c.setFont(FONT_BOLD, 20)  # спец: Таних тэмдэг TNR 20
    c.drawString(bx + pad, by + lh - mm_to_pt(8), 'Таних тэмдэг')
    rows = [
        ('line', HexColor('#c71585'), 'Сумын хил'),
        ('line', HexColor('#888888'), 'Хил залгаа сумын хил'),
        ('point', HexColor('#c0392b'), 'Газар зүйн нэр'),
    ]
    ry = by + lh - mm_to_pt(16)
    c.setFont(FONT, 14)  # спец: давхаргын бичиглэл TNR 14
    for kind, col, label in rows:
        c.setStrokeColor(col)
        c.setFillColor(col)
        ix = bx + pad
        if kind == 'line':
            c.setLineWidth(2.5)
            c.line(ix, ry + 4, ix + mm_to_pt(9), ry + 4)
        else:
            c.circle(ix + mm_to_pt(4.5), ry + 4, mm_to_pt(1.6), stroke=0, fill=1)
        c.setFillColor(black)
        c.drawString(ix + mm_to_pt(12), ry, label)
        ry -= mm_to_pt(8)
    c.restoreState()


# ── A0 формат + спец захын зай. Зураг хуудасны голд, масштаб авто. ──
A0_LONG_MM = 1189.0
A0_SHORT_MM = 841.0
# Спец: цаасны захаас зургийн ХҮРЭЭ хүртэлх зай (мм)
RM_TOP, RM_LEFT, RM_RIGHT, RM_BOT = 60.0, 30.0, 30.0, 40.0
RM_FRAME_MM = 13.0  # хүрээний чимэглэл (зебра+label zone)-ийн өргөн


def _nice_scale(s):
    """Дээш дугуйруулна. >100000 бол 10000‑р, <=100000 бол 5000‑р, <=25000 бол
    1000‑р интервалтай (ж: 615000 → 620000)."""
    s = float(s)
    if s > 100000:
        step = 10000
    elif s > 25000:
        step = 5000
    else:
        step = 1000
    return int(math.ceil(s / step) * step)


def _map_area_mm(pw, ph):
    """A0 цаасны зургийн (хүрээ доторх) талбайн хэмжээ (мм)."""
    maw = pw - RM_LEFT - RM_RIGHT - 2 * RM_FRAME_MM
    mah = ph - RM_TOP - RM_BOT - 2 * RM_FRAME_MM
    return maw, mah


def fit_layout(bbox, **_):
    """bbox (4326) → {scale, widthMM, heightMM, orientation, bbox}. A0 (хэвтээ/босоо)
    форматыг сонгож, масштабыг дүрс багтахаар авто тооцоод, дүрсийг зургийн талбайн
    ГОЛД төвлөрүүлсэн (letterbox) шинэ bbox гаргана."""
    latc = (bbox[1] + bbox[3]) / 2.0
    cosl = max(0.15, math.cos(math.radians(latc)))
    gw = max(1.0, (bbox[2] - bbox[0]) * 111320.0 * cosl)  # газрын өргөн (м)
    gh = max(1.0, (bbox[3] - bbox[1]) * 110540.0)         # газрын өндөр (м)

    best = None
    for pw, ph, orient in ((A0_LONG_MM, A0_SHORT_MM, 'landscape'),
                           (A0_SHORT_MM, A0_LONG_MM, 'portrait')):
        maw, mah = _map_area_mm(pw, ph)
        need = max(gw * 1000.0 / maw, gh * 1000.0 / mah)
        if best is None or need < best[0]:
            best = (need, pw, ph, orient, maw, mah)
    need, pw, ph, orient, maw, mah = best
    scale = _nice_scale(need)

    # Дүрсийг зургийн талбайн ГОЛД төвлөрүүлж, талбайг бүтэн хамрах bbox
    cx = (bbox[0] + bbox[2]) / 2.0
    cy = (bbox[1] + bbox[3]) / 2.0
    cov_w_m = maw / 1000.0 * scale  # талбайн хамрах газрын өргөн (м)
    cov_h_m = mah / 1000.0 * scale
    dlon = (cov_w_m / (111320.0 * cosl)) / 2.0
    dlat = (cov_h_m / 110540.0) / 2.0
    cbbox = [cx - dlon, cy - dlat, cx + dlon, cy + dlat]
    return {
        'scale': int(scale),
        'widthMM': pw, 'heightMM': ph, 'orientation': orient,
        'bbox': cbbox,
    }


def render(params):
    """Validated params (paper/map/layers/layout) → PDF bytes."""
    return MapPDFRenderer(params).render()
