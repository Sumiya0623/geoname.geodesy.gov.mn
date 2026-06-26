# -*- coding: utf-8 -*-
"""Газар зүйн нэрийн өөрчлөх хүсэлтийн (RequestName) А4 маягтыг PDF болгон үүсгэнэ.
HTML → wkhtmltopdf (pdfkit). Кирилл фонт: DejaVu Sans (системд суусан)."""

import html
import base64

import pdfkit
from django.contrib.contenttypes.models import ContentType

from core.models import Photo


# ---------- туслахууд ----------

def _e(v):
    """HTML escape; None/хоосон → ''."""
    if v is None:
        return ""
    s = str(v)
    return html.escape(s)


def _img_data_uri(file_field):
    """FileField/ImageField → base64 data URI (wkhtmltopdf‑д найдвартай)."""
    try:
        file_field.open("rb")
        data = file_field.read()
        file_field.close()
        name = (getattr(file_field, "name", "") or "").lower()
        mime = "image/png" if name.endswith(".png") else "image/jpeg"
        return f"data:{mime};base64,{base64.b64encode(data).decode()}"
    except Exception:
        return None


def _fmt_date(d):
    if not d:
        return ""
    try:
        return f"{d.year} оны {d.month} сарын {d.day} өдөр"
    except Exception:
        return str(d)


def _cell(label):
    return f'<td class="lbl">{label}</td>'


# ---------- өгөгдөл цуглуулах ----------

def _collect(req):
    name = req.name  # GeoName (батлагдсан газар зүйн нэр)
    user = req.user

    # Эрх зүйн баримт (хамгийн сүүлийн тогтоол)
    order = None
    if name:
        order = name.orders.all().order_by("-order_date").first()

    # Засаг захиргааны нэгжүүд
    units = []
    if name:
        units = [u.unit for u in name.unit.all() if u.unit]

    # Нэрлэвэр (1:100000 г.м)
    nomeks = []
    if name:
        nomeks = [n.nomek for n in name.nomek.all() if n.nomek]

    # Санал болгож буй нэрс (NameOption)
    options = list(req.option.all())

    # Шалтгаан / зорилго (REQUEST_PURPOSES)
    purposes = [p.name for p in req.purpose.all() if p.name]

    # Гэрэл зураг (Photo, generic)
    ct = ContentType.objects.get_for_model(req.__class__)
    photos = Photo.objects.filter(content_type=ct, object_id=req.id)

    # Холбоо барих (хүсэлтийн эхний namecontact)
    contact = req.namecontacts.all().first()

    return {
        "name": name,
        "user": user,
        "order": order,
        "units": units,
        "nomeks": nomeks,
        "options": options,
        "purposes": purposes,
        "photos": photos,
        "contact": contact,
    }


# ---------- HTML мөрүүд ----------

def _row_applicant(req, d):
    u = d["user"]
    full = u.full_name if u else ""
    reg = getattr(u, "register", "") if u else ""
    phone = getattr(u, "phone", "") if u else ""
    email = getattr(u, "email", "") if u else ""
    attach_count = d["photos"].count()
    val = f"""
      <div><b>Овог, нэр:</b> {_e(full)}</div>
      <div><b>РД:</b> {_e(reg)}</div>
      <div><b>Оршин суугаа хаяг:</b> </div>
      <div><b>Утас:</b> {_e(phone)} &nbsp; <b>Факс:</b> </div>
      <div><b>И-мэйл:</b> {_e(email)}</div>
      <div><b>Гарын үсэг:</b> </div>
      <div><b>Хавсаргах баримтын хуудасны тоо:</b> {attach_count}</div>
      <div><b>Огноо:</b> {_e(_fmt_date(getattr(req, 'created_date', None)))}</div>
    """
    lbl = ("Хүсэлт /өргөдөл/ гаргагчийн мэдээлэл (Иргэн, Аж ахуйн нэгж, "
           "Төрийн байгууллага, Төрийн бус байгууллага болон бусад)")
    return lbl, val


def _row_value(d):
    """Мөр бүрийн (label, value) жагсаалт."""
    name = d["name"]
    order = d["order"]
    options = d["options"]

    proper = name.name if name else ""
    generic = name.type.name if (name and name.type) else ""

    rows = []
    # 2
    rows.append((
        "Батлагдсан газар зүйн нэр",
        f"<div><b>оноосон нэр:</b> {_e(proper)}</div>"
        f"<div><b>дэвсгэр нэр:</b> {_e(generic)}</div>",
    ))
    # 3
    rows.append((
        "Батлагдсан огноо",
        _e(_fmt_date(order.order_date)) if order else "",
    ))
    # 4
    rows.append((
        "Батлагдсан тогтоол, шийдвэрийн дугаар",
        _e(order.order_number) if order else "",
    ))
    # 5
    rows.append((
        "Баталсан этгээдийн нэр",
        _e((order.type.name if order.type else None) or order.signer) if order else "",
    ))
    # 6 — is_border (GeoName) утгаар идэвхтэйг хараар, нөгөөг саарал
    is_border = bool(name.is_border) if name else False
    inner_on = not is_border
    rows.append((
        "Батлагдсан газар зүйн нэрийн байршил",
        f'<div style="color:{"#000" if inner_on else "#999"}">'
        f'{"☑" if inner_on else "☐"} ЗЗНДН-ийн дотор байршил</div>'
        f'<div style="color:{"#000" if is_border else "#999"}">'
        f'{"☑" if is_border else "☐"} Хилийн заагт</div>',
    ))
    # 7 — шалтгаан/тайлбар + зорилго (purpose)
    purposes = d.get("purposes", [])
    purpose_html = ""
    if purposes:
        purpose_html = "<div style='margin-top:3px'><b>Зорилго:</b> " + _e(
            ", ".join(purposes)) + "</div>"
    rows.append((
        "Газар зүйн нэрийн өөрчлөх буй шалтгаан /тайлбар бичих/",
        f"<div>{_e(req_description(d))}</div>{purpose_html}",
    ))
    # 8 — нэг NameOption дотор Санал1 (name) ба Санал2 (name2)
    opt = options[0] if options else None
    n1 = opt.name if opt else ""
    n2 = getattr(opt, "name2", "") if opt else ""
    rows.append((
        "Санал болгож буй нэр",
        f"<div><b>1 дэх нэр:</b> {_e(n1)}</div>"
        f"<div><b>2 дахь нэр:</b> {_e(n2)}</div>",
    ))
    # 9
    desc = opt.desc if opt else ""
    rows.append((
        "Нэрийн гарал үүсэл, утга, хэл, ямар нэрнээс үүсэлтэй талаарх тэмдэглэл",
        f"<div>{_e(desc)}</div>",
    ))
    # 10
    rows.append((
        "Аймаг, нийслэл, сум, дүүрэг, баг, хорооны нэр, дугаар",
        _e(", ".join(d["units"])),
    ))
    # 11
    rows.append((
        "Хамгийн ойр орших хот, суурин газраас алслагдах зай, чиглэл, "
        "1:100000-ны масштабтай байрын зургийн нэрийн зурлага",
        _e(", ".join(d["nomeks"])),
    ))
    return rows


def req_description(d):
    return d.get("_description", "")


def _to_dms(value, pos, neg):
    """Аравтын градусыг градус°минут'секунд" (секунд таслалын 3 орон) болгоно."""
    if value is None or value == "":
        return ""
    try:
        v = float(value)
    except (TypeError, ValueError):
        return str(value)
    hemi = pos if v >= 0 else neg
    v = abs(v)
    d = int(v)
    m_full = (v - d) * 60
    m = int(m_full)
    s = (m_full - m) * 60
    return f"{d}° {m}' {s:.3f}\" {hemi}"


def _row_coord(req):
    lat = "" if req.lat is None else req.lat
    lon = "" if req.lon is None else req.lon
    return (
        "Газар зүйн нэрийн солбицол /градус, минут, секунд/",
        f"<div><b>Өргөрөг:</b> {_e(_to_dms(lat, 'N', 'S'))}</div>"
        f"<div><b>Уртраг:</b> {_e(_to_dms(lon, 'E', 'W'))}</div>",
    )


def _row_contact(d):
    c = d["contact"]
    u = d["user"]
    if c:
        person, reg, address, phone, email = (
            c.person, c.register, c.address, c.phone, c.email,
        )
    elif u:
        person, reg, address, phone, email = (
            u.full_name, getattr(u, "register", ""), "",
            getattr(u, "phone", ""), getattr(u, "email", ""),
        )
    else:
        person = reg = address = phone = email = ""
    return (
        "Нэрийн санал гаргасан, мэдээлэл хадгалагч иргэн, хуулийн этгээдийн мэдээлэл",
        f"<div><b>Овог, нэр:</b> {_e(person)}</div>"
        f"<div><b>Регистрийн дугаар:</b> {_e(reg)}</div>"
        f"<div><b>Хаяг:</b> {_e(address)}</div>"
        f"<div><b>Утас:</b> {_e(phone)}</div>"
        f"<div><b>И-мэйл:</b> {_e(email)}</div>",
    )


def _row_photos(d):
    imgs = ""
    for p in d["photos"][:8]:
        uri = _img_data_uri(p.file)
        if uri:
            imgs += f'<img class="photo" src="{uri}" alt="" width="120px" height="120px" />'
    note = ("<div class='note'>Тайлбар: 1-8 ширхэг гэрэл зураг оруулах "
            "/зураг дарсан зүг, чиг бичих/.</div>")
    return (
        "Гэрэл зураг /зураг дарсан зүг, чиг/",
        (imgs or "") + note,
    )


# ---------- үндсэн ----------

def _build_html(req):
    d = _collect(req)
    d["_description"] = req.description or ""

    body_rows = []
    n = 1

    lbl, val = _row_applicant(req, d)
    body_rows.append((n, lbl, val)); n += 1

    for lbl, val in _row_value(d):
        body_rows.append((n, lbl, val)); n += 1

    lbl, val = _row_coord(req)
    body_rows.append((n, lbl, val)); n += 1

    lbl, val = _row_contact(d)
    body_rows.append((n, lbl, val)); n += 1

    body_rows.append((
        n,
        "Эрх бүхий байгууллага болон орон нутгийн зөвлөлийн зөвлөмж",
        "<div>1. Аймаг, нийслэл, сум, дүүргийн ЗДТГ</div>",
    )); n += 1

    lbl, val = _row_photos(d)
    body_rows.append((n, lbl, val)); n += 1

    body_rows.append((
        n,
        "Байршлын зураг",
        "<div class='note'>Газар зүйн нэрийн зураг болон сумын схем зураг "
        "дээр харагдах байдал.</div>",
    ))

    trs = ""
    for idx, lbl, val in body_rows:
        trs += (
            f'<tr><td class="no">{idx}.</td>'
            f'<td class="lbl">{lbl}</td>'
            f'<td class="val">{val}</td></tr>'
        )

    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  * {{ font-family: 'Arial', sans-serif; }}
  body {{ font-size: 11px; color: #000; margin: 0; }}
  .head {{ text-align: center; font-size: 14px; font-weight: bold; margin-bottom: 2px; }}
  .sub {{ text-align: right; font-style: italic; font-size: 10px; margin-bottom: 6px; }}
  table {{ width: 100%; border-collapse: collapse; table-layout: fixed; }}
  td {{ border: 1px solid #000; padding: 4px 6px; vertical-align: top; }}
  td.no {{ width: 24px; text-align: center; }}
  td.lbl {{ width: 38%; }}
  td.val {{ width: auto; }}
  td.val div {{ margin: 1px 0; }}
  .note {{ font-style: italic; color: #333; margin-top: 4px; }}
  img.photo {{ max-width: 31%; max-height: 120px; margin: 2px; border: 1px solid #999; }}
</style></head><body>
  <div class="head">Газар зүйн нэрийг өөрчлөх хүсэлтийн маягт /өргөдөл/</div>
  <div class="sub">Зөвхөн албан хэрэгцээнд</div>
  <table><tbody>{trs}</tbody></table>
</body></html>"""


def build_request_pdf(req):
    """RequestName → PDF (bytes)."""
    html_str = _build_html(req)
    options = {
        "page-size": "A4",
        "margin-top": "12mm",
        "margin-bottom": "12mm",
        "margin-left": "12mm",
        "margin-right": "12mm",
        "encoding": "UTF-8",
        "enable-local-file-access": None,
        "quiet": "",
    }
    return pdfkit.from_string(html_str, False, options=options)


# ====================== Маягт (Хавсралт 1, 2) PDF ======================

_MAYAGT_CSS = """
* { font-family: 'Arial', sans-serif; }
body { font-size: 11px; color:#000; margin:0; }
.app { text-align:right; font-size:11px; margin-bottom:6px; }
.title { text-align:center; font-size:13px; font-weight:bold; margin:0 8px 10px; }
.units { text-align:center; font-size:11px; margin-bottom:10px; }
table { width:100%; border-collapse:collapse; }
th,td { border:1px solid #000; padding:4px 5px; font-size:10px; vertical-align:middle; }
th { text-align:center; font-weight:bold; }
td.c { text-align:center; }
.sign { margin-top:14px; font-size:11px; }
.sigline { border-bottom:1px dashed #000; height:18px; margin:6px 0 2px; }
.sigcap { text-align:center; font-style:italic; font-size:10px; }
"""


def _dots(v):
    return _e(v) if v else "&nbsp;"


def _empty_rows(ncols, n=15):
    """д/д дугаартай хоосон мөрүүд (дотроо гүйцээгээгүй маягтад)."""
    cells = ''.join('<td>&nbsp;</td>' for _ in range(ncols - 1))
    return ''.join(f'<tr><td class="c">{i}</td>{cells}</tr>' for i in range(1, n + 1))


# Гарын үсгийн блокууд
_FOOTER_STD = ('<div class="sign">Газар зүйн нэрийг тодотгох судалгаа хийсэн:</div>'
               '<div class="sigline"></div>'
               '<div class="sigcap">(овог нэр, байгууллага, албан тушаал)</div>')
_FOOTER_DATE = (_FOOTER_STD +
                '<div class="sigcap" style="margin-top:6px">'
                '......... он ..... сар ..... өдөр</div>')
_FOOTER_F9 = ('<div class="sign">Газар зүйн нэрийг тодруулах ажлыг гүйцэтгэгч:</div>'
              '<div class="sigline"></div><div class="sigcap">(Байгууллагын нэр, тамга)</div>'
              '<div class="sigline" style="margin-top:10px"></div>'
              '<div class="sigcap">(Албан тушаал, овог нэр, гарын үсэг, огноо)</div>'
              '<div class="sigline" style="margin-top:10px"></div>'
              '<div class="sigcap">(Албан тушаал, овог нэр, гарын үсэг, огноо)</div>')


def build_mayagt_pdf(form_no, rows, aimag='', sum=''):
    """Маягт 1/2 (Хавсралт 1/2) — харьцуулсан судалгааны А4 PDF (bytes).

    rows: [{i, name, draft, lat, lon, nomek_25k, nomek_100k}, ...]
    """
    def _blank(pad=60):
        return f'<span style="border-bottom:1px solid #000;padding:0 {pad}px">&nbsp;</span>'

    units = (f'<span style="border-bottom:1px solid #000;padding:0 60px">{_e(aimag)}</span> '
             f'аймаг (нийслэл) '
             f'<span style="border-bottom:1px solid #000;padding:0 60px">{_e(sum)}</span> '
             f'сум (дүүрэг)')
    footer = _FOOTER_STD

    if str(form_no) == '2':
        title = 'Улсын Их Хурлаар батлагдаагүй (уламжлалт) газар зүйн нэрийн жагсаалт'
        app = 'Хавсралт 2'
        head = (
            '<tr>'
            '<th rowspan="2" style="width:36px">д/д</th>'
            '<th rowspan="2">Улсын Их Хурлаар батлагдаагүй уламжлалт<br>'
            'газар зүйн нэрийн жагсаалт</th>'
            '<th rowspan="2">1:100000-ны масштабтай байр<br>зүйн зургийн нэрэлбэр</th>'
            '<th colspan="2">Солбицол</th>'
            '</tr>'
            '<tr><th>өргөрөг</th><th>уртраг</th></tr>'
        )
        body = ''.join(
            f'<tr><td class="c">{r["i"]}</td>'
            f'<td>{_dots(r.get("draft") or r.get("name"))}</td>'
            f'<td class="c">{_dots(r.get("nomek_100k"))}</td>'
            f'<td class="c">{_dots(r.get("lat"))}</td>'
            f'<td class="c">{_dots(r.get("lon"))}</td></tr>'
            for r in rows)
    elif str(form_no) == '3':
        title = ('Улсын Их Хурлаар зөрүүтэй, өөр нэрээр, үг үсгийн алдаатай батлагдсан '
                 'газар зүйн нэрийн жагсаалт')
        app = 'Хавсралт 3'
        head = (
            '<tr>'
            '<th rowspan="2" style="width:36px">д/д</th>'
            '<th rowspan="2">Улсын Их хурлаар өөрчлөн батлуулах<br>'
            'газар зүйн нэрийн жагсаалт</th>'
            '<th rowspan="2">Улсын Их хурлаар батлагдсан<br>'
            'газар зүйн нэрийн жагсаалт</th>'
            '<th rowspan="2">1:100000-ны масштабтай байр<br>'
            'зүйн зургийн нэрэлбэр (1980-1984)</th>'
            '<th colspan="2">Солбицол</th>'
            '<th rowspan="2">Тайлбар</th>'
            '</tr>'
            '<tr><th>өргөрөг</th><th>уртраг</th></tr>'
        )
        body = ''.join(
            f'<tr><td class="c">{r["i"]}</td>'
            f'<td>{_dots(r.get("draft"))}</td>'
            f'<td>{_dots(r.get("name"))}</td>'
            f'<td class="c">{_dots(r.get("nomek_100k"))}</td>'
            f'<td class="c">{_dots(r.get("lat"))}</td>'
            f'<td class="c">{_dots(r.get("lon"))}</td>'
            f'<td>&nbsp;</td></tr>'
            for r in rows)
    elif str(form_no) == '4':
        title = ('Улсын Их Хурлаар батлагдсан нэрийн тодруулалт хийсэн суурь зурагт '
                 'байршлаараа буруу тэмдэглэгдсэн газар зүйн нэрийн судалгаа')
        app = 'Хавсралт 4'
        head = (
            '<tr>'
            '<th rowspan="2" style="width:36px">д/д</th>'
            '<th rowspan="2">Улсын Их Хурлаар батлагдсан<br>газар зүйн нэр</th>'
            '<th rowspan="2">1:25000-ны масштабтай байр<br>зүйн зургийн нэрэлбэр</th>'
            '<th colspan="2">суурь зураг дахь солбицол</th>'
            '<th colspan="2">зөв байршлын солбицол</th>'
            '</tr>'
            '<tr><th>өргөрөг</th><th>уртраг</th><th>өргөрөг</th><th>уртраг</th></tr>'
        )
        body = ''.join(
            f'<tr><td class="c">{r["i"]}</td>'
            f'<td>{_dots(r.get("name"))}</td>'
            f'<td class="c">{_dots(r.get("nomek_25k"))}</td>'
            f'<td class="c">{_dots(r.get("lat"))}</td>'
            f'<td class="c">{_dots(r.get("lon"))}</td>'
            f'<td>&nbsp;</td><td>&nbsp;</td></tr>'
            for r in rows)
    elif str(form_no) == '5':
        title = 'Зөрүүтэй нэрлэж буй газар зүйн нэрийн жагсаалт'
        app = 'Хавсралт 5'
        units = (f'<span style="border-bottom:1px solid #000;padding:0 40px">{_e(aimag)}</span> '
                 f'аймгийн {_blank(40)} сумын хил заагт байгаа газар зүйн нэр зэргэлдээх, '
                 f'{_blank(40)} аймгийн {_blank(40)} сумын газар зүйн нэрийн зөрүүтэй '
                 f'байдлын талаарх мэдээлэл')
        head = (
            '<tr>'
            '<th rowspan="2" style="width:36px">д/д</th>'
            '<th rowspan="2">Газар зүйн нэр</th>'
            '<th rowspan="2">Зэргэлдээх суманд нэрлэж<br>буй газар зүйн нэр</th>'
            '<th colspan="2">Солбицол</th>'
            '<th rowspan="2">Хэрхэн шийдвэрлэсэн<br>(тайлбар)</th>'
            '</tr>'
            '<tr><th>өргөрөг</th><th>уртраг</th></tr>'
        )
        body = _empty_rows(6)
    elif str(form_no) == '6':
        title = 'Шинээр буй болсон газар зүйн объектуудын нэрийг тодотгосон судалгаа'
        app = 'Хавсралт 6'
        footer = _FOOTER_DATE
        head = (
            '<tr>'
            '<th rowspan="2" style="width:36px">д/д</th>'
            '<th rowspan="2">Шинээр бий болсон объект<br>газар зүйн нэр</th>'
            '<th rowspan="2">Газар зүйн<br>дэвсгэр нэр</th>'
            '<th rowspan="2">1:25000-ны масштабтай байр<br>зүйн зургийн нэрэлбэр</th>'
            '<th colspan="2">Солбицол</th>'
            '</tr>'
            '<tr><th>өргөрөг</th><th>уртраг</th></tr>'
        )
        body = ''.join(
            f'<tr><td class="c">{r["i"]}</td>'
            f'<td>{_dots(r.get("draft") or r.get("name"))}</td>'
            f'<td>{_dots(r.get("gtype"))}</td>'
            f'<td class="c">{_dots(r.get("nomek_25k"))}</td>'
            f'<td class="c">{_dots(r.get("lat"))}</td>'
            f'<td class="c">{_dots(r.get("lon"))}</td></tr>'
            for r in rows) or _empty_rows(6)
    elif str(form_no) == '8':
        title = 'Улсын Их Хурлаар батлуулах газар зүйн нэр'
        app = 'Хавсралт 8'
        footer = _FOOTER_DATE
        units = (f'<span style="border-bottom:1px solid #000;padding:0 40px">{_e(aimag)}</span> '
                 f'аймгийн {_blank(40)} сумын газар зүйн нэрийн судалгаа, '
                 f'нэрийн мэдээллийн сан бүрдүүлэх')
        head = (
            '<tr>'
            '<th rowspan="2" style="width:36px">д/д</th>'
            '<th rowspan="2">УИХ-аар шинээр батлагдах<br>газар зүйн нэр</th>'
            '<th rowspan="2">1:25000-ны масштабтай байр<br>зүйн зургийн нэрэлбэр</th>'
            '<th colspan="2">Солбицол</th>'
            '</tr>'
            '<tr><th>өргөрөг</th><th>уртраг</th></tr>'
        )
        body = _empty_rows(5)
    elif str(form_no) == '9':
        title = ('Газар зүйн нэрийн хээрийн тодотголын ажилд газарчнаар ажилласан '
                 'иргэний нотолгоо')
        app = 'Хавсралт 9'
        footer = _FOOTER_F9
        head = (
            '<tr>'
            '<th style="width:36px">д/д</th>'
            '<th>Иргэний овог, нэр</th>'
            '<th>Регистрийн дугаар</th>'
            '<th>Утасны дугаар</th>'
            '<th>Гарын үсэг</th>'
            '</tr>'
        )
        body = _empty_rows(5, n=8)
    else:
        title = ('Улсын Их Хурлаар батлагдсан газар зүйн нэр 1:25000-1:100000-ны '
                 'масштабтай байр зүйн зураг дээр бичигдсэн нэртэй харьцуулсан судалгаа')
        app = 'Хавсралт 1'
        head = (
            '<tr>'
            '<th rowspan="2" style="width:36px">д/д</th>'
            '<th rowspan="2">Газар нутгийн нэрийн<br>зураг дээрх нэрийн жагсаалт</th>'
            '<th rowspan="2">УИХ-аар батлагдсан<br>газар зүйн нэр</th>'
            '<th colspan="2">1980-1984 онд хээрийн тодруулалт хийсэн<br>'
            '1:100000-ны масштабтай байр зүйн суурь зураг</th>'
            '<th colspan="2">1:25000-ны масштабтай<br>байр зүйн зураг</th>'
            '</tr>'
            '<tr><th>Нэрэлбэр</th><th>Газар зүйн нэрийн жагсаалт</th>'
            '<th>Нэрэлбэр</th><th>Газар зүйн нэрийн жагсаалт</th></tr>'
        )
        body = ''.join(
            f'<tr><td class="c">{r["i"]}</td>'
            f'<td>{_dots(r.get("draft"))}</td>'
            f'<td>{_dots(r.get("name"))}</td>'
            f'<td class="c">{_dots(r.get("nomek_100k"))}</td>'
            f'<td>{_dots(r.get("name"))}</td>'
            f'<td class="c">{_dots(r.get("nomek_25k"))}</td>'
            f'<td>{_dots(r.get("name"))}</td></tr>'
            for r in rows)

    html_str = f"""<!DOCTYPE html><html><head><meta charset="utf-8">
<style>{_MAYAGT_CSS}</style></head><body>
<div class="app">{app}</div>
<div class="title">{title}</div>
<div class="units">{units}</div>
<table><thead>{head}</thead><tbody>{body or '<tr><td colspan="9">&nbsp;</td></tr>'}</tbody></table>
{footer}
</body></html>"""

    options = {
        "page-size": "A4",
        "orientation": "Portrait",
        "margin-top": "20mm", "margin-bottom": "20mm",
        "margin-left": "30mm", "margin-right": "15mm",
        "encoding": "UTF-8", "enable-local-file-access": None, "quiet": "",
    }
    return pdfkit.from_string(html_str, False, options=options)
