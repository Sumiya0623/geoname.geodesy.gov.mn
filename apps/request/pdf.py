# -*- coding: utf-8 -*-
"""Газар зүйн нэрийн өөрчлөх хүсэлтийн (RequestName) А4 маягтыг PDF болгон үүсгэнэ.
HTML → wkhtmltopdf (pdfkit). Кирилл фонт: DejaVu Sans (системд суусан)."""

import os
import math
import html
import base64
import logging
from io import BytesIO

import pdfkit
from pypdf import PdfReader, PdfWriter
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas as rl_canvas
from reportlab.lib.units import mm as RL_MM
from django.contrib.contenttypes.models import ContentType
from django.contrib.gis.geos import Point
from django.contrib.gis.db.models.functions import Distance as GeoDistance

from core.models import Photo, AdminUnit, Constant, Nomek
from apps.geoname import name_index

logger = logging.getLogger(__name__)


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
        order = name.legalorders.all().order_by("-order_date").first()

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

    # Зураг (Photo, generic). Хүсэлтийн UI нь ЗОВХИС (desc)‑той хээрийн
    # зургийг ГАЗАР ЗҮЙН НЭР дээр хадгалдаг тул зөвхөн RequestName‑ийг уншвал
    # маягт зурагггүй хоосон гардаг байсан — хоёуланг нь цуглуулна.
    ct = ContentType.objects.get_for_model(req.__class__)
    photos = list(Photo.objects.filter(content_type=ct, object_id=req.id))
    if name is not None:
        gct = ContentType.objects.get_for_model(name.__class__)
        photos = list(
            Photo.objects.filter(content_type=gct, object_id=name.id)
        ) + photos

    # ХЭРЭГЛЭГЧИЙН оруулсан бүх зураг «Гэрэл зураг» мөрд орно. «Байршлын
    # зураг» мөр нь хэрэглэгчийн зураг БИШ — системээс үүсэх нэрийн индексийн
    # схем (name_index.svg) тул энд ялгах шаардлагагүй.
    field_photos = list(photos)

    # Холбоо барих (хүсэлтийн эхний namecontact)
    contact = req.namecontacts.select_related('person').first()

    return {
        "name": name,
        "user": user,
        "order": order,
        "units": units,
        "nomeks": nomeks,
        "options": options,
        "purposes": purposes,
        "photos": photos,
        "field_photos": field_photos,
        "contact": contact,
        # Байршил — хүсэлтийн солбицол, эс бөгөөс холбоотой нэрийнх. Аймаг/сум,
        # алслалт, нэрлэвэр зэрэг тооцоо бүгд эндээс гарна.
        "pt": _geo_point(req, name),
    }


# ---------- HTML мөрүүд ----------

def _row_applicant(req, d):
    u = d["user"]
    full = u.full_name if u else ""
    reg = getattr(u, "register", "") if u else ""
    phone = getattr(u, "phone", "") if u else ""
    email = getattr(u, "email", "") if u else ""
    attach_count = len(d["photos"])
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


# Түвшний БҮТЭН нэр → товчлол. Жагсаалтад байхгүйг том үсгээр эхэлсэн
# үгсийн эхний үсгээр товчилно («Улсын Их Хурал» → «УИХ»).
_GOVLEVEL_ABBR = {
    "Улсын Их Хурал": "УИХ",
    "Засгийн газар": "ЗГ",
}


def _abbr(text):
    t = (text or "").strip()
    if not t:
        return ""
    if t in _GOVLEVEL_ABBR:
        return _GOVLEVEL_ABBR[t]
    letters = [w[0] for w in t.split() if w and w[0].isupper()]
    return "".join(letters) if len(letters) >= 2 else t


def _order_text(order):
    """«УИХ-ын тогтоол, №46, 2003.09.30» — батлагдсан шийдвэрийг нэг мөрөөр."""
    if not order:
        return ""
    lvl = _abbr(order.govlevel.name if order.govlevel_id else "")
    kind = ((order.type.name if order.type_id else "") or "шийдвэр").lower()
    bits = [f"{lvl}-ын {kind}" if lvl else kind]
    if order.order_number:
        bits.append(f"№{order.order_number}")
    if order.order_date:
        bits.append(order.order_date.strftime("%Y.%m.%d"))
    return ", ".join(bits)


def _geo_point(req, name):
    """Хүсэлтийн солбицол → зурсан дүрсийн төв → холбоотой нэрийн байршил."""
    pt = name_index.point_from(req.lat, req.lon)
    if pt is None and getattr(req, "geoloc", None):
        g = req.geoloc
        pt = g if g.geom_type == "Point" else g.centroid
    if pt is None and name is not None and getattr(name, "geoloc", None):
        g = name.geoloc
        pt = g if g.geom_type == "Point" else g.centroid
    return pt


def _nomek_100k(pt):
    """1:100000-ны байр зүйн зургийн нэрлэвэр (зурлага) — цэгээр орон зайгаар."""
    if pt is None:
        return ""
    scale = Constant.objects.filter(
        key="MAPSCALES", name__icontains="100000").first()
    qs = Nomek.objects.filter(geom__contains=pt)
    if scale:
        qs = qs.filter(scale_id=scale.id)
    n = qs.only("nomek").first()
    return n.nomek if n else ""


def _row_value(d, merge_order=False):
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
    if merge_order:
        # «Хүчингүй болгох» маягт — огноо/дугаар/баталсан этгээдийг НЭГ мөрөнд
        rows.append(("Батлагдсан шийдвэр", _e(_order_text(order))))
    else:
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
            _e((order.type.name if order.type else None) or order.signer)
            if order else "",
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
    # 10 — нэр дээрх M2M байвал түүнийг, эс бөгөөс БАЙРШЛААР нь тодорхойлно
    pt = d.get("pt")
    units = d["units"] or [u.unit for u in _unit_chain(pt) if u.unit]
    rows.append((
        "Аймаг, нийслэл, сум, дүүрэг, баг, хорооны нэр, дугаар",
        _e(", ".join(units)),
    ))
    # 11 — алслалт/чиглэл ба 1:100000-ны нэрлэвэр (хоёулаа цэгээс тооцогдоно)
    far = _nearest_settlement(pt)
    nomek = ", ".join(d["nomeks"]) or _nomek_100k(pt)
    parts = []
    if far:
        parts.append(f"<div>{_e(far)}</div>")
    if nomek:
        parts.append(f"<div><b>1:100000 нэрлэвэр:</b> {_e(nomek)}</div>")
    rows.append((
        "Хамгийн ойр орших хот, суурин газраас алслагдах зай, чиглэл, "
        "1:100000-ны масштабтай байрын зургийн нэрийн зурлага",
        "".join(parts),
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
        # Холбоо барих хүний мэдээлэл — RemoteUser (person) дээрээс
        cp = c.person
        person, reg, address, phone, email = (
            (cp.full_name if cp else ''), (cp.register if cp else ''),
            c.address, (cp.phone if cp else ''), (cp.email if cp else ''),
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


def _photo_grid(photos, per_row=4, cell_mm=28):
    """Зургуудыг нэг мөрөнд `per_row` ширхэгээр байрлуулна.

    wkhtmltopdf нь float/inline-block-ийг тогтворгүй боловсруулдаг тул
    хүснэгтээр байрлуулав — мөр бүр цэвэр таслагдаж, сүүлийн дутуу мөр нь
    хоосон нүдээр гүйцээгдэнэ (зураг сунахгүй). Өндрийг ММ-ЭЭР хязгаарлаж
    маягт нэг хуудсанд багтахыг баталгаажуулна.
    """
    cells = []
    for p in photos:
        uri = _img_data_uri(p.file)
        if not uri:
            continue
        cap = _e((getattr(p, "desc", "") or "").strip())
        cells.append(
            f'<img class="photo" src="{uri}" alt="" '
            f'style="max-height:{cell_mm}mm" />'
            + (f'<div class="cap">{cap}</div>' if cap else "")
        )
    if not cells:
        return ""
    trs = ""
    for i in range(0, len(cells), per_row):
        row = cells[i:i + per_row]
        row += [""] * (per_row - len(row))
        trs += "<tr>" + "".join(
            f'<td class="pcell">{c}</td>' for c in row) + "</tr>"
    return f'<table class="pgrid"><tbody>{trs}</tbody></table>'


def _row_photos(d):
    """Гэрэл зураг — бүтэн өргөнтэй (шошго/утгын багана нэгтгэсэн) мөр.
    Зургийн ТООНООС хамааруулж өндрийг тааруулна — 8 зураг ч нэг хуудсанд
    багтана."""
    shots = d["field_photos"][:8]
    # 1 мөр (≤4) → өндөр, 2 мөр (>4) → нам
    cell_mm = 36 if len(shots) <= 4 else 20
    imgs = _photo_grid(shots, per_row=4, cell_mm=cell_mm)
    note = ("<div class='note'>Тайлбар: 1-8 ширхэг гэрэл зураг оруулах "
            "/зураг дарсан зүг, чиг бичих/.</div>")
    body = ('<div class="locblock">'
            '<div class="secthead">Гэрэл зураг /зураг дарсан зүг, чиг/</div>'
            f"{imgs}{note}</div>")
    return "Гэрэл зураг /зураг дарсан зүг, чиг/", body, True


_LOC_CAPTION = ("(Газар зүйн нэрийн зураг болон сумын бүдүүвч зурагт "
                "үзүүлэгдсэн байдал)")


def _row_location(req, d):
    """Байршлын зураг — СИСТЕМЭЭС үүснэ, нэг мөрөнд ХОЁР зураг зэрэгцээ:
      1) байр зүйн зураг (raster:1970, zoom 12-ийн хүрээ) дээр нэрийг ОНЦГОЙ
         өнгөөр тэмдэглэсэн,
      2) сумын хилээр тооцсон нэрийн ИНДЕКСИЙН бүдүүвч.
    Хэрэглэгчийн оруулсан зураг энд БИШ, «Гэрэл зураг» мөрд харагдана.
    Мөр нь шошго/утгын хоёр баганыг НЭГТГЭЖ бүтэн өргөнөөр гарна (3 дахь
    элемент True — _build_html colspan хийнэ).
    """
    def wrap(inner):
        # Гарчиг/зураг/тайлбарыг НЭГ блокт хийнэ — эс бөгөөс wkhtmltopdf нь
        # мөрийг хуудас хооронд таллаж, гарчиг нь өмнөх хуудсанд хоцордог.
        return (
            '<div class="locblock">'
            '<div class="secthead">Байршлын зураг</div>'
            f"{inner}"
            f'<div class="imgcap">{_e(_LOC_CAPTION)}</div>'
            "</div>"
        )

    pt = name_index.point_from(req.lat, req.lon)
    if pt is None:
        return ("Байршлын зураг",
                wrap("<div class='note'>Солбицол оруулаагүй тул байршлын "
                     "зураг үүсгэх боломжгүй.</div>"), True)

    # Онцлох нэр — санал болгосон нэр, эс бөгөөс холбоотой батлагдсан нэр
    opt = (d["options"] or [None])[0]
    label = (getattr(opt, "name", "") or ""
             or (d["name"].name if d["name"] else "")) or ""

    idx = name_index.compute(pt)
    note = ""
    if idx:
        note = f"{idx['unit'].unit} сум · индекс {idx['label'] or '—'}"

    topo = name_index.topo_svg(pt, label=label,
                               geom=getattr(req, "geoloc", None))
    scheme = name_index.svg(pt, note=note)
    if not (topo or scheme):
        return ("Байршлын зураг",
                wrap("<div class='note'>Байршлын зураг үүсгэж чадсангүй "
                     "(сум олдсонгүй эсвэл зургийн сан хүрэлцэхгүй).</div>"),
                True)

    pair = ('<table class="imgpair"><tbody><tr>'
            f'<td>{topo}</td><td>{scheme}</td>'
            "</tr></tbody></table>")
    return "Байршлын зураг", wrap(pair), True


# ---------- үндсэн ----------

# ---------- Хавсралт 11 — «Шинээр» хүсэлтийн маягт ----------
#
# Төлөв бүр өөр маягттай:
#   Шинээр  → Хавсралт 11 «Шинээр бий болсон газар зүйн объектод нэр өгөх»
#   Өөрчлөх / Хүчингүй → одоо байгаа (нэр өөрчлөх) бүтэц, гарчиг нь төлвөөр
# Төлвийг Constant(REQUEST_STATUS).name-ээр таньна (DB дээр нэр өөрчлөгдвөл
# ЗӨВХӨН доорх таних үгийг засна).

# Маягтын гарчиг — төлвийн нэрэнд агуулагдах үгээр
_TITLE_BY_STATUS = (
    ("Шинээр", "Шинээр бий болсон газар зүйн объектод нэр өгөх хүсэлт"),
    ("Хүчингүй", "Газар зүйн нэрийг хүчингүй болгох хүсэлт"),
    ("Өөрчл", "Газар зүйн нэрийг өөрчлөх хүсэлт"),
)

# 9-р мөр — эрх бүхий байгууллага, орон нутгийн зөвлөмжийн жагсаалт
_ADVICE_STEPS = (
    "Сумын ГЗНЗ-ийн хурлын шийдвэр",
    "Сумын ИТХ-ын тогтоол",
    "Аймгийн ГЗНЗ-ийн хурлын шийдвэр",
    "Аймгийн ИТХ-ын тогтоол",
    "ГЗБГЗЗГ-ын ГЗНЗ-ийн хурлын шийдвэр",
    "Газар зүйн нэрийн Үндэсний зөвлөлийн зөвлөмж",
    "Засгийн газрын тогтоол",
    "Үндэсний аюулгүй байдлын зөвлөлийн зөвлөмж",
    "Улсын Их Хурлын тогтоол",
)

# Азимут → зовхис. Frontend-ийн utils/geoDirection.js-тэй ЯГ ижил хуваалт
# (кардинал 60°, завсрын 30°); зүүн = East (монгол зургийн уламжлал).
def _azimuth_word(deg):
    a = (float(deg) % 360 + 360) % 360
    if a >= 330 or a < 30:
        return "хойд"
    if a < 60:
        return "зүүн хойд"
    if a < 120:
        return "зүүн"
    if a < 150:
        return "зүүн урд"
    if a < 210:
        return "урд"
    if a < 240:
        return "баруун урд"
    if a < 300:
        return "баруун"
    return "баруун хойд"


def _req_point(req):
    if req.lat is None or req.lon is None:
        return None
    try:
        return Point(float(req.lon), float(req.lat), srid=4326)
    except (TypeError, ValueError):
        return None


def _unit_chain(pt):
    """Цэгээр аймаг → сум → баг шатлалыг олно (RequestName-д ЗЗ нэгжийн
    талбар байхгүй тул орон зайгаар тодорхойлно)."""
    if pt is None:
        return []
    node = (AdminUnit.objects.filter(level__name="Баг/Хороо", geom__contains=pt)
            .select_related("parent", "level").first())
    if node is None:
        node = (AdminUnit.objects.filter(level__name="Сум/Дүүрэг",
                                         geom__contains=pt)
                .select_related("parent", "level").first())
    chain, cur, guard = [], node, 0
    while cur is not None and guard < 5:
        chain.append(cur)
        cur = cur.parent
        guard += 1
    return list(reversed(chain))


def _nearest_settlement(pt):
    """Хамгийн ойрын хот/суурин: 'Луус сумын төвөөс зүүн урагш 13.2 км' маягаар.

    Суурин (AdminUnit level='Суурин') байхгүй бол цэгийг агуулах сумын төвөөс
    хэмжинэ. Зай нь том тойргийн (haversine) км, чиглэл нь эхний азимут.
    """
    if pt is None:
        return ""
    cand = (AdminUnit.objects.filter(level__name="Суурин")
            .exclude(geom__isnull=True)
            .annotate(dist=GeoDistance("geom", pt)).order_by("dist").first())
    suffix = "суурингаас"
    if cand is None:
        cand = (AdminUnit.objects.filter(level__name="Сум/Дүүрэг",
                                         geom__contains=pt)
                .exclude(geom__isnull=True).first())
        suffix = "сумын төвөөс"
    if cand is None:
        return ""
    c = cand.geom.centroid
    lat1, lon1 = math.radians(c.y), math.radians(c.x)
    lat2, lon2 = math.radians(pt.y), math.radians(pt.x)
    dlon = lon2 - lon1
    a = (math.sin((lat2 - lat1) / 2) ** 2
         + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2)
    km = 6371.0088 * 2 * math.asin(min(1.0, math.sqrt(a)))
    brg = math.degrees(math.atan2(
        math.sin(dlon) * math.cos(lat2),
        math.cos(lat1) * math.sin(lat2)
        - math.sin(lat1) * math.cos(lat2) * math.cos(dlon)))
    return (f"{cand.unit} {suffix} {_azimuth_word(brg)} "
            f"{km:.1f} км")


def _radio(on, text):
    """◉/○ сонголт — идэвхтэйг хараар, бусдыг сааралаар."""
    return (f'<div style="color:{"#000" if on else "#666"}">'
            f'{"◉" if on else "○"} {_e(text)}</div>')


def _rows_appendix11(req, d):
    """Хавсралт 11-ийн 1..11 мөр (дугаартай)."""
    opt = (d["options"] or [None])[0]
    pt = _req_point(req)
    age_name = (req.age.name if req.age_id else "") or ""
    # Мөр 2 — нэрийн гарал үүсэл. Тусдаа талбар байхгүй тул НАСААР тодорхойлов:
    # «10 хүртэл жил (шинэ)» → шинээр бий болсон, бусад → уламжлалт нэр.
    is_new_object = "шинэ" in age_name.lower()
    is_traditional = bool(age_name) and not is_new_object

    rows = [
        ("Санал болгож буй газар зүйн нэр",
         f'<div><b>1 дэх нэр:</b> {_e(opt.name if opt else "")}</div>'
         f'<div><b>2 дахь нэр:</b> '
         f'{_e(getattr(opt, "name2", "") if opt else "")}</div>'),
        # Саналын ДАРАА — тайлбар (гарал үүсэл, утга, хэл г.м.)
        ("Нэрийн гарал үүсэл, утга, хэл, ямар нэрнээс үүсэлтэй талаарх "
         "тэмдэглэл",
         f'<div>{_e((opt.desc if opt else "") or "")}</div>'
         + (f'<div>{_e(req_description(d))}</div>'
            if req_description(d) else "")),
        # Энэ мөр нь ЗӨВХӨН сонголт — тайлбар дээрх мөрд орно
        ("Нэрийн гарал үүсэл",
         _radio(is_new_object, "Шинээр бий болсон газар зүйн объект")
         + _radio(is_traditional, "Газар зүйн уламжлалт нэр")),
        ("Дэвсгэр нэр (ам, булаг, гол, нуур, уул ... гэх мэт)",
         _e(req.type.name if req.type_id else "")),
        ("Аймаг, сум, нийслэл, дүүрэг, баг, хорооны нэр, дугаар",
         _e(", ".join(u.unit for u in _unit_chain(pt) if u.unit))),
        ("Хамгийн ойр орших хот, суурин газраас алслагдах зай, километрээр "
         "(аль зүгт байрлахыг тодорхой бичих)",
         _e(_nearest_settlement(pt))),
        ("Шинээр бий болсон газар зүйн нэрийн солбицол "
         "(градус, минут, секунд)",
         f'<div><b>Өргөрөг:</b> {_e(_to_dms(req.lat, "N", "S"))}</div>'
         f'<div><b>Уртраг:</b> {_e(_to_dms(req.lon, "E", "W"))}</div>'),
        ("Шинээр бий болсон газар зүйн объектод өгөх нэр, уламжлалт газар "
         "зүйн нэрийн хэрэглэгдэж буй хугацаа (жилээр)",
         "".join(_radio(a.name == age_name, a.name)
                 for a in Constant.objects.filter(
                     key="GEONAME_AGES").order_by("id"))),
        ("Нэрийн талаар мэдээллээр хангагч иргэн, хуулийн этгээдийн мэдээлэл",
         _row_contact(d)[1]),
        ("Эрх бүхий байгууллага болон орон нутгийн зөвлөмж",
         "".join(f"<div>{i}. {_e(t)}</div>"
                 for i, t in enumerate(_ADVICE_STEPS, 1))),
    ]
    rows.append(_row_photos(d))
    rows.append(_row_location(req, d))
    return rows


def _status_name(req):
    return (req.status.name if req.status_id else "") or ""


def _form_title(req):
    """Маягтын гарчиг — төлвөөр нь, хүсэлтийн ДУГААРТАЙ."""
    sname = _status_name(req)
    base = "Газар зүйн нэрийн хүсэлтийн маягт (өргөдөл)"
    for key, title in _TITLE_BY_STATUS:
        if key in sname:
            base = title
            break
    return f"{base} № {req.pk}"


def _build_html(req):
    d = _collect(req)
    d["_description"] = req.description or ""
    is_new = "Шинээр" in _status_name(req)

    # Хүсэлт гаргагчийн блок — дугааргүй, маягт бүрд нийтлэг (Хавсралт 11-д
    # дугаарлалт «Санал болгож буй нэр»-ээс 1-ээр эхэлдэг).
    lbl, val = _row_applicant(req, d)
    body_rows = [(None, lbl, val, False)]

    if is_new:
        numbered = _rows_appendix11(req, d)
    else:
        numbered = list(_row_value(d, merge_order="Хүчингүй" in _status_name(req)))
        numbered.append(_row_coord(req))
        numbered.append(_row_contact(d))
        numbered.append((
            "Эрх бүхий байгууллага болон орон нутгийн зөвлөлийн зөвлөмж",
            "".join(f"<div>{i}. {_e(t)}</div>"
                    for i, t in enumerate(_ADVICE_STEPS, 1)),
        ))
        numbered.append(_row_photos(d))
        numbered.append(_row_location(req, d))

    for i, row in enumerate(numbered, 1):
        # (label, value) эсвэл (label, value, full) — full=True үед шошго/утгын
        # хоёр баганыг нэгтгэж бүтэн өргөнөөр гаргана.
        body_rows.append((i, row[0], row[1], len(row) > 2 and bool(row[2])))

    trs = ""
    for idx, lbl, val, full in body_rows:
        no = f"{idx}." if idx is not None else ""
        cell = (f'<td class="wide" colspan="2">{val}</td>' if full else
                f'<td class="lbl">{lbl}</td><td class="val">{val}</td>')
        trs += f'<tr><td class="no">{no}</td>{cell}</tr>'

    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  * {{ font-family: 'Arial', sans-serif; }}
  body {{ font-size: 11px; color: #000; margin: 0; }}
  .apx {{ text-align: right; font-size: 11px; margin-bottom: 4px; }}
  .head {{ text-align: center; font-size: 13px; font-weight: bold; margin-bottom: 2px; }}
  .sub {{ text-align: right; font-style: italic; font-size: 10px; margin-bottom: 6px; }}
  table {{ width: 100%; border-collapse: collapse; table-layout: fixed; }}
  td {{ border: 1px solid #000; padding: 5px 6px; vertical-align: top; }}
  td.no {{ width: 24px; text-align: center; }}
  td.lbl {{ width: 38%; }}
  td.val {{ width: auto; }}
  td.val div {{ margin: 1px 0; }}
  .note {{ font-style: italic; color: #333; margin-top: 4px; }}
  .cap {{ font-size: 9px; color: #333; margin-top: 1px; }}
  /* Гэрэл зураг — мөрөнд 2‑оор (1x2). Гадна хүснэгтийн хүрээг өвлөхгүй. */
  table.pgrid {{ width: 100%; border-collapse: collapse; table-layout: fixed;
                margin: 2px 0; }}
  table.pgrid td.pcell {{ border: 0; padding: 2px; width: 25%;
                         text-align: center; vertical-align: top; }}
  img.photo {{ max-width: 100%; border: 1px solid #999; }}
  /* Байршлын зураг — индекс тус бүр өөрийн мөрөнд, бүтэн өргөнөөр */
  .locrow {{ text-align: center; margin: 4px 0; page-break-inside: avoid; }}
  /* Системээс үүссэн SVG нь тогтмол өргөнтэй тул нүднээс халихгүйгээр
     багасгана (wkhtmltopdf нь width/height атрибутыг өөрөө жижигрүүлдэггүй). */
  .locrow svg {{ max-width: 100%; height: auto; }}
  /* Бүтэн өргөнтэй мөр — гарчиг голлож, доор нь 2 зураг зэрэгцээ */
  td.wide {{ text-align: center; }}
  .locblock {{ page-break-inside: avoid; }}
  .secthead {{ font-weight: bold; font-size: 12px; text-align: center;
              border-bottom: 1px solid #000; padding-bottom: 2px;
              margin: -4px -6px 4px -6px; }}
  .imgcap {{ text-align: center; font-size: 10px; margin-top: 3px; }}
  table.imgpair {{ width: 100%; border-collapse: collapse;
                  table-layout: fixed; }}
  table.imgpair td {{ border: 0; padding: 3px; width: 50%;
                     text-align: center; vertical-align: top; }}
  table.imgpair svg {{ max-width: 100%; height: auto; }}
  img.locimg {{ max-width: 100%; max-height: 260px; border: 1px solid #999; }}
  tr {{ page-break-inside: avoid; }}
</style></head><body>
  <div class="head">{_e(_form_title(req))}</div>
  <div class="sub">Зөвхөн албан хэрэгцээнд:</div>
  <table><tbody>{trs}</tbody></table>
</body></html>"""


# ---------- хөл / толгой ----------
#
# Энэ серверийн wkhtmltopdf 0.12.6 нь patch хийгээгүй Qt дээр угсарсан
# ("Reduced Functionality") тул --header-html / --footer-html сонголт БОЛОН
# `position: fixed`-ийн хуудас бүрийн давталт аль аль нь ажиллахгүй. Иймд
# бэлэн PDF дээр reportlab-аар давхарлаж (overlay) буулгав — энэ нь
# wkhtmltopdf-ийн угсралтаас хамаарахгүй, хуудас бүрт баталгаатай орно.

_PAGE = {
    "left": 30 * RL_MM,          # захын хэмжээтэй тааруулсан
    "right": 15 * RL_MM,
    "head_text": 13 * RL_MM,     # цаасны ДЭЭД ирмэгээс
    "head_rule": 15 * RL_MM,
    "foot_rule": 15 * RL_MM,     # цаасны ДООД ирмэгээс
    "foot_text": 10 * RL_MM,
    "size": 8,
}

_FONT_CANDIDATES = [
    ("GeoSans", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
]
_font_ready = None


def _hf_font():
    """Кирилл дэмжсэн TTF-ийг нэг удаа бүртгэнэ. Олдохгүй бол Helvetica."""
    global _font_ready
    if _font_ready is None:
        _font_ready = "Helvetica"
        for name, path in _FONT_CANDIDATES:
            if os.path.exists(path):
                try:
                    pdfmetrics.registerFont(TTFont(name, path))
                    _font_ready = name
                    break
                except Exception:
                    pass
    return _font_ready


def _stamp_header_footer(pdf_bytes, head_l, head_r, foot_l, foot_r):
    """Хуудас БҮРД толгой (зүүн/баруун) ба хөл (зүүн/баруун) нэмнэ."""
    try:
        reader = PdfReader(BytesIO(pdf_bytes))
        writer = PdfWriter()
        font = _hf_font()
        for page in reader.pages:
            w = float(page.mediabox.width)
            h = float(page.mediabox.height)
            buf = BytesIO()
            c = rl_canvas.Canvas(buf, pagesize=(w, h))
            c.setFont(font, _PAGE["size"])
            left = _PAGE["left"]
            right = w - _PAGE["right"]
            c.drawString(left, h - _PAGE["head_text"], head_l)
            c.drawRightString(right, h - _PAGE["head_text"], head_r)
            c.drawString(left, _PAGE["foot_text"], foot_l)
            c.drawRightString(right, _PAGE["foot_text"], foot_r)
            c.setLineWidth(0.5)
            c.line(left, h - _PAGE["head_rule"], right, h - _PAGE["head_rule"])
            c.line(left, _PAGE["foot_rule"], right, _PAGE["foot_rule"])
            c.save()
            buf.seek(0)
            page.merge_page(PdfReader(buf).pages[0])
            writer.add_page(page)
        out = BytesIO()
        writer.write(out)
        return out.getvalue()
    except Exception:
        # Давхарлалт бүтэлгүйтвэл маягт өөрөө алдагдах ёсгүй
        logger.exception("Хөл/толгой давхарлаж чадсангүй")
        return pdf_bytes


def build_request_pdf(req):
    """RequestName → PDF (bytes)."""
    html_str = _build_html(req)
    options = {
        "page-size": "A4",
        # Стандарт захын хэмжээ (хөл/толгой нь энэ зайд багтана)
        "margin-top": "20mm",
        "margin-bottom": "20mm",
        "margin-left": "30mm",
        "margin-right": "15mm",
        "encoding": "UTF-8",
        "enable-local-file-access": None,
        "quiet": "",
    }
    pdf_bytes = pdfkit.from_string(html_str, False, options=options)

    u = getattr(req, "user", None)
    applicant = (getattr(u, "full_name", "") if u else "") or ""
    return _stamp_header_footer(
        pdf_bytes,
        "Газар зүйн нэрийн дэд систем",
        f"Огноо: {_fmt_date(getattr(req, 'created_date', None))}",
        f"Хүсэлт гаргасан: {applicant}",
        f"Дугаар: №{req.pk}",
    )


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


def _empty_rows(ncols, n=15, start=1):
    """д/д дугаартай хоосон мөрүүд (дотроо гүйцээгээгүй маягтад).

    start — дугаарлалт хаанаас эхлэх (дүүргэсэн мөрийн дараа гүйцээхэд).
    """
    cells = ''.join('<td>&nbsp;</td>' for _ in range(ncols - 1))
    return ''.join(f'<tr><td class="c">{i}</td>{cells}</tr>'
                   for i in range(start, start + n))


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
        # Багийн бүрэлдэхүүн (ProjectMember)‑ээс бөглөнө; дор хаяж 5 мөр байлгана
        body = ''.join(
            f'<tr><td class="c">{r["i"]}</td>'
            f'<td>{_dots(r.get("name"))}</td>'
            f'<td class="c">{_dots(r.get("register"))}</td>'
            f'<td class="c">{_dots(r.get("phone"))}</td>'
            f'<td>&nbsp;</td></tr>'
            for r in rows)
        if len(rows) < 5:
            body += _empty_rows(5, n=5 - len(rows), start=len(rows) + 1)
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
