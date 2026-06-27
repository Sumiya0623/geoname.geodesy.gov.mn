# -*- coding: utf-8 -*-
"""Локал Tesseract OCR — толийн скан хуудсыг 2 баганаар уншиж бүтэцлэнэ (API-гүй).

render → 2 багана тус бүрийг tesseract(mon) → мөрүүд → items[] (vision-тэй ижил схем:
kind=header|entry, name, aimag, sum, uncertain). Нэг хуудсыг 1,1-р нь уншина.

Шаардлага (систем): tesseract-ocr + tesseract-ocr-mon (Кирилл монгол).
  sudo apt-get install -y tesseract-ocr tesseract-ocr-mon
"""
import io


def _is_cyr(c):
    return 'Ѐ' <= c <= 'ӿ'


def _lines_from_data(data):
    """image_to_data DICT → [(text, conf)] мөрөөр (block/par/line-ээр бүлэглэнэ)."""
    groups = {}
    order = []
    n = len(data['text'])
    for i in range(n):
        txt = (data['text'][i] or '').strip()
        if not txt:
            continue
        key = (data['block_num'][i], data['par_num'][i], data['line_num'][i])
        if key not in groups:
            groups[key] = {'words': [], 'confs': []}
            order.append(key)
        g = groups[key]
        g['words'].append(txt)
        try:
            c = float(data['conf'][i])
        except (ValueError, TypeError):
            c = -1
        if c >= 0:
            g['confs'].append(c)
    out = []
    for key in order:
        g = groups[key]
        text = ' '.join(g['words'])
        conf = (sum(g['confs']) / len(g['confs']) / 100.0) if g['confs'] else 0.0
        out.append((text, round(conf, 3)))
    return out


def _ocr_column(pil_img, lang, psm):
    import pytesseract
    data = pytesseract.image_to_data(
        pil_img, lang=lang, config=f'--oem 1 --psm {psm}',
        output_type=pytesseract.Output.DICT)
    return _lines_from_data(data)


def ocr_page_lines(pdf_path, page, dpi=300, lang='mon', psm=6):
    """Хуудсыг 2 баганаар OCR хийж, мөрүүдийг уншсан дарааллаар: [(text, conf)]."""
    cols = ocr_page_columns(pdf_path, page, dpi=dpi, lang=lang, psm=psm)
    lines = []
    for _blob, _conf, col_lines in cols:
        lines += col_lines
    return lines


def ocr_page_columns(pdf_path, page, dpi=300, lang='mon', psm=6):
    """Хуудсыг 2 баганад хувааж тус бүрийг OCR хийнэ.
    → [(blob_text, mean_conf, [(line, conf)...]), ...] (зүүн, баруун)."""
    from PIL import Image
    from .render import render_page_png
    png = render_page_png(pdf_path, page, dpi=dpi)
    img = Image.open(io.BytesIO(png))
    w, h = img.size
    mid = w // 2
    crops = [img.crop((0, 0, mid + 15, h)), img.crop((mid - 15, 0, w, h))]
    out = []
    for crop in crops:
        col_lines = _ocr_column(crop, lang, psm)
        blob = ' '.join(t for t, _c in col_lines)
        confs = [c for _t, c in col_lines if c > 0]
        mean = round(sum(confs) / len(confs), 3) if confs else 0.0
        out.append((blob, mean, col_lines))
    return out


# ----------------------------- Парс (мөр → item) -----------------------------

def _cyr_name_prefix(s):
    """Мөрийн ЭХНИЙ кирилл үгс = нэр. Эхний кирилл бус (дугаар/латин/шуугиан)-ыг
    алгасаад, кириллээр эхэлж, латин/дугаарт хүрэхэд зогсоно.
    '00011 Долоон борзон Doloon...' → 'Долоон борзон'."""
    out = []
    for t in s.split():
        cyr = sum(1 for c in t if _is_cyr(c))
        lat = sum(1 for c in t if c.isascii() and c.isalpha())
        if not out:
            if cyr == 0:            # эхний кирилл бус токен → алгасна
                continue
            out.append(t)
            continue
        if lat > cyr or cyr == 0:   # латин/дугаар эхэлсэн → нэр дууссан
            break
        out.append(t)
    return ' '.join(out).strip()


def _is_header(text):
    """Болд ТОМ үсэгт type гарчиг уу (БОРЗОН, БОСГО...) — голдуу 1-3 үг, таслалгүй."""
    letters = [c for c in text if c.isalpha()]
    if not letters or ',' in text:
        return False
    cyr_up = sum(1 for c in letters if _is_cyr(c) and c.isupper())
    return cyr_up / len(letters) > 0.8 and len(text.split()) <= 3


def parse_lines(lines):
    """[(text, conf)] → items[] (vision-тэй ижил: kind/header/name/aimag/sum/uncertain).
    Бичлэг бүр: <кирилл нэр> <латин галиг>, <аймаг>, <сум>. Латиныг хаяна."""
    items = []
    for text, conf in lines:
        text = text.strip().strip('|·•').strip()
        if len(text) < 2:
            continue
        if _is_header(text):
            items.append({'kind': 'header', 'header': text, 'ocr_conf': conf})
            continue
        parts = [p.strip(' .') for p in text.split(',')]
        if len(parts) < 2:
            continue  # нэр/аймаг/сум ялгагдахгүй — алгасна
        name = _cyr_name_prefix(parts[0])
        if not name:
            continue
        items.append({
            'kind': 'entry',
            'name': name,
            'aimag': parts[1] if len(parts) > 1 else '',
            'sum': parts[2] if len(parts) > 2 else '',
            'uncertain': conf < 0.60,
            'ocr_conf': conf,
        })
    return items


def ocr_page_items(pdf_path, page, dpi=300, lang='mon', psm=6):
    """Хуудас → items[] (энгийн мөр-парс; blob-парсыг resolve үед хийнэ)."""
    return parse_lines(ocr_page_lines(pdf_path, page, dpi=dpi, lang=lang, psm=psm))


# ------------------- blob парс (аймгаар зангуудсан, DB-тэй) -------------------
# Бичлэг бүр: <нэр(сүүл=type)>, <латин галиг>, <аймаг>, <сум><дараагийн нэр>...
# Мөр таслагдсан тул баганыг нэг blob болгож, АЙМГИЙГ зангуу болгон таслана.

def _all_caps_cyr(tok):
    letters = [c for c in tok if c.isalpha()]
    return bool(letters) and all(_is_cyr(c) and c.isupper() for c in letters) \
        and len(letters) >= 3


def _norm(s):
    return (s or '').strip().lower().replace('ё', 'е')


def _is_page_header(s):
    """Хуудасны давтагдах толгой ('Монгол газар нутгийн нэрийн зүйлчилсэн толь')-ийг
    OCR-ийн янз бүрийн уншилттай нь (Монгоп/тазар/зү...) fuzzy таньж хаяна."""
    import difflib
    n = _norm(s)
    if not n:
        return False
    for kw in ('газар нутгийн', 'нутгийн нэр', 'нэрийн зүйлч', 'зүйлчилсэн'):
        if kw in n:
            return True
    w = n.split()
    if len(w) >= 2 and difflib.get_close_matches(w[0], ['монгол'], n=1, cutoff=0.72) \
            and difflib.get_close_matches(w[1], ['газар'], n=1, cutoff=0.7):
        return True
    return False


def parse_blob(blob, resolver, header=None):
    """Баганын blob-ийг аймгаар зангуудан бичлэг болгож хуваана.

    resolver: aimags/sums кэштэй Resolver. header: эхний идэвхтэй type гарчиг.
    → items[] (kind='entry', name/aimag/sum/header/uncertain) + гарчиг солих item-ууд.
    """
    import difflib
    import re
    aimset = resolver.aimags
    # Хуудасны давтагдах толгой ("Монгол газар нутгийн... ТОЛЬ") болон хуудасны
    # дугаарыг арилгана (нэр болж орохоос сэргийлнэ).
    blob = re.sub(r'Монгол\s+газар\s+нутгийн[^,]*?[Тт][Оо][Лл][Ьь]\S*', ' ', blob)
    parts = [p.strip(' .·•|') for p in blob.split(',')]
    parts = [p for p in parts if p]

    def _after_last_header(s):
        """Сүүлийн ТОМ үсэгт type гарчгийн ДАРААХ кирилл нэрийг авна."""
        toks = s.split()
        last = -1
        for i, t in enumerate(toks):
            if _all_caps_cyr(t) and resolver.resolve_type(t):
                last = i
        return _cyr_name_prefix(' '.join(toks[last + 1:]))

    def match_aimag(p):
        n = _norm(p)
        if n in aimset:
            return aimset[n]
        m = difflib.get_close_matches(n, list(aimset), n=1, cutoff=0.82)
        return aimset[m[0]] if m else None

    # Аймаг тохирох comma-хэсгүүдийн индекс — эдгээр нь бичлэгийн зангуу
    anchors = [(i, match_aimag(p)) for i, p in enumerate(parts)]
    anchors = [(i, a) for i, a in anchors if a]
    if not anchors:
        return []

    cur_header = header

    def take_header(s):
        """ТОМ үсэгт type гарчгийг салгаж, идэвхтэй гарчгийг шинэчилнэ; үлдсэн текст."""
        nonlocal cur_header
        keep = []
        for t in s.split():
            if _all_caps_cyr(t):
                if resolver.resolve_type(t):
                    cur_header = t
            else:
                keep.append(t)
        return ' '.join(keep)

    def split_sum_name(text, aimag_unit):
        """'<сум> <дараагийн нэр>' → (сум, дараагийн нэрийн эхлэл). Сумыг DB-ээр тааруулна."""
        text = take_header(text)
        toks = text.split()
        if not toks:
            return '', ''
        cand = {_norm(s.unit): s for s in resolver.sums
                if aimag_unit and s.parent_id == aimag_unit.id}
        best_k = 0
        for k in range(min(3, len(toks)), 0, -1):
            phrase = _norm(' '.join(toks[:k]))
            if phrase in cand or (cand and difflib.get_close_matches(
                    phrase, list(cand), n=1, cutoff=0.84)):
                best_k = k
                break
        if not best_k:
            best_k = 1  # тааралгүй бол эхний үгийг сум гэж тааварлана
        return ' '.join(toks[:best_k]), ' '.join(toks[best_k:])

    items = []
    # Эхний нэр: эхний аймгийн өмнөх хэсэг → сүүлийн type гарчгийн ДАРААХ кирилл нэр
    first_i = anchors[0][0]
    pre = ' '.join(parts[:first_i])
    take_header(pre)  # идэвхтэй гарчгийг тогтооно
    name = _after_last_header(pre)

    for idx, (ai, aimag_unit) in enumerate(anchors):
        aimag_text = parts[ai]
        # аймгийн дараах хэсэг = '<сум> <дараагийн нэр>'
        after = parts[ai + 1] if ai + 1 < len(parts) else ''
        sm, next_name = split_sum_name(after, aimag_unit)
        if name and not _is_page_header(name):
            items.append({
                'kind': 'entry', 'name': name, 'aimag': aimag_text, 'sum': sm,
                'header': cur_header, 'uncertain': False,
            })
        # дараагийн нэр = next_name + (next anchor хүртэлх латины өмнөх кирилл)
        name = _cyr_name_prefix(take_header(next_name))
    return items
