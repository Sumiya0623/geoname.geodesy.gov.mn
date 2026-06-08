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
  * {{ font-family: 'DejaVu Sans', sans-serif; }}
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
