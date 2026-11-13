"""Нуур / тойром / цөөрмийн талбайг НЭГ ТОВШИЛТООР зурах (хэрэглэгч 2026-11-13: «нуурын голд хатгахад өнгөөр нь
мэдрээд хилийг нь үүсгэ»). 1970 оны 1:100k зурагт усны гадаргуу цайвар цэнхэр дүүргэлттэй (nameqc/areaseg.py-тэй
ижил HSV муж). Товшсон цэгээс ижил дүүргэлттэй холбогдсон хэсгийг олж, хилийг полигон болгоно.

  pts = lake_at(x, y)      # EPSG:3857 → [[x, y], …] (EPSG:3857) эсвэл None

Зөвхөн numpy + Pillow (прод орчинд OpenCV/scipy байхгүй).
"""
from io import BytesIO

import numpy as np
import requests
from django.conf import settings
from PIL import Image, ImageDraw, ImageFilter

SIZE = 800                # px — WMS зургийн хэмжээ
HALF = 1000.0             # м (EPSG:3857) — эхний цонхны хагас (≈2.5 м/px); хүрээнд хүрвэл 2 дахин тэлнэ
# OpenCV H 92–118 (0–180) → Pillow H (0–255)
H_LO, H_HI = 130, 168
S_LO, S_HI = 14, 60
V_LO, V_HI = 140, 235


def _wms(bbox, size=SIZE):
    base = (settings.GEOSERVER_URL or '').rstrip('/')
    params = {'service': 'WMS', 'version': '1.1.1', 'request': 'GetMap', 'layers': 'raster:1970', 'styles': '',
              'srs': 'EPSG:3857', 'bbox': ','.join(f'{v:.2f}' for v in bbox), 'width': size, 'height': size,
              'format': 'image/png'}
    auth = (settings.GEOSERVER_USER, settings.GEOSERVER_PASSWORD) if getattr(settings, 'GEOSERVER_USER', None) else None
    r = requests.get(f'{base}/raster/wms', params=params, auth=auth, timeout=30)
    if r.status_code != 200 or 'image' not in r.headers.get('content-type', ''):
        raise RuntimeError(f'WMS алдаа: {r.status_code} {r.text[:200]}')
    return Image.open(BytesIO(r.content)).convert('RGB')


def _mask(img, seed):
    hsv = np.asarray(img.convert('HSV')).astype(np.int16)
    h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    sx, sy = seed
    win = hsv[max(0, sy - 4):sy + 5, max(0, sx - 4):sx + 5].reshape(-1, 3)
    h0, s0, v0 = np.median(win, 0)
    if s0 < 22 and v0 > 215:
        return None                                  # цагаан цаас дээр товшсон — нуурын дотор биш
    water = (h >= H_LO) & (h <= H_HI) & (s >= S_LO) & (s <= S_HI) & (v >= V_LO) & (v <= V_HI)
    if not (H_LO <= h0 <= H_HI and S_LO <= s0 <= S_HI and V_LO <= v0 <= V_HI):
        # товшсон цэгийн өнгө стандарт усны мужид биш (бараан/өөр өнгийн дүүргэлт) → тухайн өнгөнд ойрыг авна
        dh = np.minimum(np.abs(h - h0), 256 - np.abs(h - h0))
        water = (dh <= 14) & (np.abs(s - s0) <= 35) & (np.abs(v - v0) <= 40)
    # НЯГТ: 15×15 орчны цэнхэр пикселийн хувь. Нуурын торлог/цэгэн дүүргэлт ≥ 50%, намгийн босоо зураас, үсэг
    # (нимгэн) ~30% → тасарна (хэрэглэгч 2026-11-13: «хүрээ хэт мэдрэмтгий»). Нягтын зураг гөлгөр тул хил ч гөлгөр.
    m = Image.fromarray((water * 255).astype(np.uint8)).filter(ImageFilter.BoxBlur(7))
    m = Image.fromarray(((np.asarray(m) >= 128) * 255).astype(np.uint8))
    m = m.filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.MinFilter(9))      # бичвэр/шугамын цоорхой нөхөх
    return m


def _component(m, seed, search=30):
    a = np.asarray(m)
    sx, sy = seed
    if a[sy, sx] < 128:
        ys, xs = np.nonzero(a[max(0, sy - search):sy + search + 1, max(0, sx - search):sx + search + 1] >= 128)
        if not len(xs):
            return None
        k = np.argmin((xs + max(0, sx - search) - sx) ** 2 + (ys + max(0, sy - search) - sy) ** 2)
        sx, sy = int(xs[k] + max(0, sx - search)), int(ys[k] + max(0, sy - search))
    m2 = m.copy()
    ImageDraw.floodfill(m2, (sx, sy), 77)
    comp = np.asarray(m2) == 77
    return comp if comp.sum() >= 200 else None


def _trace(comp):
    """Бүрэлдэхүүний гадна хилийг Moore хөршийн аргаар (цагийн зүүний дагуу) мөрдөнө → [(x, y)] px."""
    a = np.pad(comp, 1)
    ys, xs = np.nonzero(a)
    i = np.lexsort((xs, ys))[0]
    start = (int(xs[i]), int(ys[i]))
    nb = [(-1, 0), (-1, -1), (0, -1), (1, -1), (1, 0), (1, 1), (0, 1), (-1, 1)]
    pts, cur, back = [start], start, 0           # back: өмнөх (хоосон) хөршийн индекс — эхэнд зүүн тал
    for _ in range(4 * a.size):
        found = False
        for k in range(8):
            d = (back + 1 + k) % 8
            nx, ny = cur[0] + nb[d][0], cur[1] + nb[d][1]
            if a[ny, nx]:
                back = (d + 4) % 8
                cur = (nx, ny)
                found = True
                break
        if not found:
            break
        if cur == start and len(pts) > 2:
            break
        pts.append(cur)
    return [(x - 1, y - 1) for x, y in pts]


def _rdp(pts, eps):
    if len(pts) < 3:
        return pts
    p = np.asarray(pts, float)
    a, b = p[0], p[-1]
    ab = b - a
    n = np.hypot(*ab)
    d = np.abs(np.cross(ab, p - a)) / n if n > 0 else np.hypot(*(p - a).T)
    i = int(np.argmax(d))
    if d[i] > eps:
        return _rdp(pts[:i + 1], eps)[:-1] + _rdp(pts[i:], eps)
    return [pts[0], pts[-1]]


def _chaikin(pts, it=2):
    """Хаалттай цагирагийн булангуудыг мохоожуулна (Chaikin) — арзгар хилийг гөлгөр болгоно."""
    p = np.asarray(pts, float)
    for _ in range(it):
        q = np.roll(p, -1, 0)
        p = np.stack([0.75 * p + 0.25 * q, 0.25 * p + 0.75 * q], 1).reshape(-1, 2)
    return [tuple(v) for v in p]


def lake_at(x, y):
    """(x, y) EPSG:3857 — нуурын дотор товшсон цэг. Буцаах: [[x, y], …] EPSG:3857 эсвэл None."""
    half = HALF
    for _ in range(3):
        bbox = (x - half, y - half, x + half, y + half)
        img = _wms(bbox)
        res = 2 * half / SIZE
        seed = (SIZE // 2, SIZE // 2)
        m = _mask(img, seed)
        comp = None
        if m is not None:
            # нууртай залгаа нарийн цухуйлт (намгийн зураас) тасална; жижиг нуур алга болвол нээлтгүйг авна
            mo = m.filter(ImageFilter.MinFilter(13)).filter(ImageFilter.MaxFilter(13))
            comp = _component(mo, seed, search=12)
            if comp is None:
                comp = _component(m, seed)
        if comp is None or comp.mean() > 0.6:      # бараг бүх цонх — дэвсгэр дүүрсэн, нуур биш
            return None
        touches = comp[0].any() or comp[-1].any() or comp[:, 0].any() or comp[:, -1].any()
        if touches and half < 4 * HALF:
            half *= 2                               # нуур цонхноос том — цонхыг тэлж дахин
            continue
        break
    # арзгар хил (хэрэглэгч 2026-11-13): маскийг Гауссаар зөөлрүүлж → мөрдөх → хялбаршуулах → Chaikin
    sm = Image.fromarray((comp * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(4))
    sm = np.asarray(sm) >= 128
    if sm.sum() >= 200:
        comp = sm
    ring = _trace(comp)
    if len(ring) < 3:
        return None
    # хаалттай цагираг: эхний цэгийг төгсгөлд нэмж хялбаршуулна (RDP хоёр үзүүр хадгалдаг)
    simp = _rdp(ring + [ring[0]], 2.0)[:-1]
    if len(simp) < 3:
        return None
    simp = _rdp(_chaikin(simp, 2) + [_chaikin(simp, 2)[0]], 0.6)[:-1]
    x0, y1 = bbox[0], bbox[3]
    return [[round(float(x0 + (px + 0.5) * res), 2), round(float(y1 - (py + 0.5) * res), 2)] for px, py in simp]
