import re
import shutil,os
import requests
from requests.auth import HTTPBasicAuth
from pathlib import Path
from collections import defaultdict
from notifications.signals import notify
from django.db import transaction, connection
from django.core.files.base import ContentFile
from django.db import transaction
from rest_framework import viewsets
from core.filters import GlobalFilter
from rest_framework.permissions import IsAuthenticated
from core.mixin import PublicListMixin
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters,status
from django.conf import settings
from rest_framework.parsers import MultiPartParser, FormParser,JSONParser
from django.db.models import Prefetch, Count
from portal.auth import function_permission
from collections import OrderedDict
from rest_framework.decorators import action
from portal.utils.rulestyle import update_rule_in_sld_xml_safe,delete_rule_in_sld_xml, _strip_geometry_symbolizers

from geo.Geoserver import Geoserver
geo = Geoserver(f'{settings.GEOSERVER_URL}', username=settings.GEOSERVER_USER, password=settings.GEOSERVER_PASSWORD)
# from geoserver.catalog import Catalog
# cat = Catalog(f'http://local.nextgis.mn:8080/geoserver/rest/', username=settings.GEOSERVER_USER, password=settings.GEOSERVER_PASSWORD)
from .default_style import create_default_style_and_assign ,_safe_read_text,_normalize_filters_for_sld, _first_eq_field_value

from core.models import (
	Constant,
	StyleRule,
	LayerGroupItem,
	LayerGroup,
)

from core.userapiview import (
	ConstantSerializer,
)
from .serializer import (
	WorkspaceSerializer,
	StoreSerializer,
	StyleRuleSerializer,
	LayerGroupSerializer,
	LayerGroupItemSerializer
)

def _filters_as_list(filters_qs_or_list):
    if isinstance(filters_qs_or_list, list):
        return filters_qs_or_list
    try:
        return [
            {"field": f.field, "operator": f.operator, "value": f.value}
            for f in filters_qs_or_list.all()
        ]
    except Exception as exc:
        import logging
        logging.getLogger(__name__).warning("_filters_as_list failed", exc_info=exc)
        return []


# ======================================================================
# GEONAME_TYPES дэд ангилал ↔ GeoServer view (layer) автомат синк.
# Дэд ангилал (геометртэй навч) нэмэх/засахад тухайн ангиллын геонэрүүдийг
# шүүсэн PG view үүсч, geoname workspace‑ийн geoname_pg store‑д нийтлэгдэнэ.
# View нэр = ангиллын замын кодуудыг нийлүүлж "_view" залгасан.
# ======================================================================

GEONAME_WS = 'geoname'
GEONAME_STORE = 'wms'
# GEOM_TYPES нэр → стиль geom_type
GEOM_STYLE = {'Цэг': 'point', 'Шугам': 'line', 'Талбай': 'polygon'}


def _gs_rest_auth():
    from django.conf import settings as _st
    return f"{_st.GEOSERVER_URL}/rest", HTTPBasicAuth(_st.GEOSERVER_USER, _st.GEOSERVER_PASSWORD)


# ======================================================================
# SLD style‑ийг GeoServer REST (HTTP)‑ээр унших/бичих. GeoServer тусдаа сервер
# дээр (алсын) байж болох тул локал GEOSERVER_DATA_DIR файл системд хандахгүй.
# ======================================================================

def _gs_style_read_sld(ws, style_name):
    """Workspace‑scoped style‑ийн SLD XML‑ийг REST‑ээр уншина."""
    rest, auth = _gs_rest_auth()
    r = requests.get(f"{rest}/workspaces/{ws}/styles/{style_name}.sld",
                     auth=auth, timeout=30)
    r.raise_for_status()
    return r.text


def _gs_style_write_sld(ws, style_name, sld_xml):
    """Засагдсан SLD XML‑ийг GeoServer‑т REST‑ээр PUT хийж шинэчилнэ (reload шаардахгүй)."""
    rest, auth = _gs_rest_auth()
    r = requests.put(
        f"{rest}/workspaces/{ws}/styles/{style_name}",
        data=sld_xml.encode("utf-8"),
        headers={"Content-Type": "application/vnd.ogc.sld+xml"},
        auth=auth, timeout=30,
    )
    r.raise_for_status()
    return r


def _gs_upload_style_symbol(ws, basename, src_path):
    """Icon (external graphic) файлыг GeoServer‑ийн styles/symbols/ дотор REST
    resource API‑ээр байршуулна. SLD доторх href нь 'symbols/<basename>'
    (style‑ийн байрлалд харьцангуй) болж буцна."""
    rest, auth = _gs_rest_auth()
    with open(src_path, "rb") as f:
        data = f.read()
    r = requests.put(
        f"{rest}/resource/workspaces/{ws}/styles/symbols/{basename}",
        data=data, auth=auth, timeout=60,
    )
    r.raise_for_status()
    return f"symbols/{basename}"


def _gs_upload_symbol_bytes(ws, basename, data):
    """_gs_upload_style_symbol‑ийн bytes хувилбар (түр файлгүйгээр)."""
    rest, auth = _gs_rest_auth()
    r = requests.put(
        f"{rest}/resource/workspaces/{ws}/styles/symbols/{basename}",
        data=data, auth=auth, timeout=60,
    )
    r.raise_for_status()
    return f"symbols/{basename}"


# SLD доторх symbol href‑ийг GeoServer‑т (relative, локал файл) ба GeoStyler editor‑т
# (absolute media URL, browser preview) тохируулан хөрвүүлэх. GeoServer нь remote URL
# татаж чаддаггүй тул rendering‑д локал symbols/<нэр> заавал хэрэгтэй.
import re as _re
_MEDIA_SYM_RE = _re.compile(r'https?://[^"\'<>]*?/api/media/geoname_symbols/([^"\'<>/]+)')
_REL_SYM_RE = _re.compile(r'href="symbols/([^"\'<>]+)"')


def _localize_sld_symbols(sld):
    """SLD доторх absolute media symbol URL бүрийг GeoServer‑ийн локал
    styles/symbols/ рүү REST‑ээр байршуулж, href‑ийг relative 'symbols/<нэр>'
    болгож rewrite хийнэ. GeoServer‑ийн рендерт ашиглах хувилбар."""
    import os
    from django.conf import settings as _st
    for basename in set(_MEDIA_SYM_RE.findall(sld)):
        src = os.path.join(_st.MEDIA_ROOT, 'geoname_symbols', basename)
        if os.path.exists(src):
            try:
                with open(src, 'rb') as fh:
                    _gs_upload_symbol_bytes(GEONAME_WS, basename, fh.read())
            except requests.RequestException:
                pass
    return _MEDIA_SYM_RE.sub(lambda m: f'symbols/{m.group(1)}', sld)


def _absolutize_sld_symbols(sld, request):
    """GeoServer‑ээс уншсан SLD доторх relative 'symbols/<нэр>' href‑ийг absolute
    media URL болгоно — GeoStyler editor/PreviewMap (browser) ачаалж чадахаар."""
    from django.conf import settings as _st
    media = _st.MEDIA_URL.rstrip('/') + '/geoname_symbols/'

    def repl(m):
        return f'href="{request.build_absolute_uri(media + m.group(1))}"'

    return _REL_SYM_RE.sub(repl, sld)


# GWC seed зориулсан тогтмолууд — газрын зураг WMTS(6‑14)‑ийг WebMercatorQuad
# (EPSG:3857) gridset, image/png‑ээр cache хийдэг. Style засагдах бүрд config+
# truncate+seed хийнэ. Metatiling 1×1 — жижиг extent дээрх GWC "/ by zero"‑г шийднэ.
GWC_GRIDSET = 'WebMercatorQuad'
GWC_ZOOM_START = 6
# gridSubset нь zoom 6‑14 хүртэл tile үйлчилнэ (WMTS энэ хүртэл харагдана).
GWC_ZOOM_STOP = 14
# Pre‑seed нь зөвхөн 6‑11 (хэт олон tile болохоос сэргийлэх). 12‑14 нь хэрэгцээгээр
# (GetTile дуудагдахад) lazy‑cache хийгдэнэ.
GWC_SEED_STOP = 11
# Web mercator (EPSG:3857) бүтэн дэлхийн хязгаар — gridSubset‑ийн extent. Бүх tile
# in‑range байж, газрын зургийн захын tile 400 (TileOutOfRange) өгөхгүй.
GWC_WORLD = 20037508.342789244
# Монголын web mercator bbox — ЗӨВХӨН seed хийх хүрээ (бүх дэлхийг seed хийхгүй).
GWC_MN_EXTENT = (9600000.0, 4900000.0, 13400000.0, 6900000.0)


def _gwc_configure(layer_full):
    """Layer‑ийн GWC tile caching‑ийг тохируулна: metatiling 1×1, WebMercatorQuad
    (zoom 6‑10), бүтэн дэлхийн extent, image/png. Metatiling 1×1 нь GWC seed‑ийн
    '/ by zero'‑г, бүтэн extent нь захын tile‑ийн 400‑г зайлуулна."""
    from django.conf import settings as _st
    auth = HTTPBasicAuth(_st.GEOSERVER_USER, _st.GEOSERVER_PASSWORD)
    w = GWC_WORLD
    cfg = (
        f"<GeoServerLayer><name>{layer_full}</name><enabled>true</enabled>"
        "<metaWidthHeight><int>1</int><int>1</int></metaWidthHeight>"
        "<mimeFormats><string>image/png</string></mimeFormats>"
        "<gridSubsets><gridSubset>"
        f"<gridSetName>{GWC_GRIDSET}</gridSetName>"
        f"<extent><coords><double>{-w}</double><double>{-w}</double>"
        f"<double>{w}</double><double>{w}</double></coords></extent>"
        f"<zoomStart>{GWC_ZOOM_START}</zoomStart><zoomStop>{GWC_ZOOM_STOP}</zoomStop>"
        "</gridSubset></gridSubsets></GeoServerLayer>"
    )
    requests.put(f"{_st.GEOSERVER_URL}/gwc/rest/layers/{layer_full}.xml",
                 data=cfg, auth=auth, headers={"Content-Type": "text/xml"}, timeout=15)


def _gwc_seed(layer_full, *, do_seed=True):
    """Layer‑ийн GWC‑г тохируулж (metatiling 1×1 г.м.), truncate (+ seed) хийнэ —
    zoom 6‑10, WebMercatorQuad, image/png. Style засагдах бүрд дуудна (хуучин tile
    устаж, шинэ style‑тай дахин cache). seed POST нь geoserver‑т дэвсгэр ажил болж
    дараалдаг тул save‑ийг удаан блоклохгүй."""
    from django.conf import settings as _st
    url = f"{_st.GEOSERVER_URL}/gwc/rest/seed/{layer_full}.xml"
    auth = HTTPBasicAuth(_st.GEOSERVER_USER, _st.GEOSERVER_PASSWORD)

    x1, y1, x2, y2 = GWC_MN_EXTENT

    def _post(op):
        # truncate бол бүх zoom (6‑14) цэвэрлэнэ; seed бол зөвхөн 6‑11 Монголд.
        zstop = GWC_ZOOM_STOP if op == "truncate" else GWC_SEED_STOP
        bounds = "" if op == "truncate" else (
            "<bounds><coords>"
            f"<double>{x1}</double><double>{y1}</double>"
            f"<double>{x2}</double><double>{y2}</double>"
            "</coords></bounds>"
        )
        body = (
            "<seedRequest>"
            f"<name>{layer_full}</name>"
            f"{bounds}"
            f"<gridSetId>{GWC_GRIDSET}</gridSetId>"
            f"<zoomStart>{GWC_ZOOM_START}</zoomStart>"
            f"<zoomStop>{zstop}</zoomStop>"
            "<format>image/png</format>"
            f"<type>{op}</type><threadCount>1</threadCount>"
            "</seedRequest>"
        )
        return requests.post(url, data=body, auth=auth,
                             headers={"Content-Type": "text/xml"}, timeout=20)

    try:
        _gwc_configure(layer_full)   # metatiling 1×1 + gridset/extent
        _post("truncate")            # хуучин cache цэвэрлэх (6‑14)
        if do_seed:
            _post("seed")            # 6‑11 Монголд дахин cache
        return True
    except requests.RequestException:
        import logging
        logging.getLogger(__name__).warning("GWC seed failed: %s", layer_full, exc_info=True)
        return False


def geoname_type_view_name(const):
    """Ангиллын замын (root→leaf) .code‑уудыг нийлүүлж '_view' залгана.
    Жишээ: top.code + level2.code + level3.code + '_view' → 'B0101_view'.
    Код байхгүй бол type id‑д суурилсан нэр."""
    chain, c, seen = [], const, set()
    while c and c.id not in seen:
        seen.add(c.id)
        chain.append(c)
        c = Constant.objects.filter(id=c.parent_id).first() if c.parent_id else None
    chain.reverse()
    raw = ''.join((x.code or '') for x in chain)
    raw = re.sub(r'[^a-zA-Z0-9_]', '', raw)
    return f"{raw}_view" if raw else f"t{const.id}_view"


def _geoname_type_select(type_ids):
    # type_ids — нэг view‑д хамаарах бүх ангиллын id (ижил кодтой синонимууд)
    ids = ','.join(str(int(i)) for i in type_ids) or '0'
    return (
        "SELECT g.id, g.name, g.number, g.is_approved, g.geoloc,\n"
        "    g.type_id, t.parent_id AS type_l2, t2.parent_id AS type_l1,\n"
        "    json_build_array(t.parent_id, g.type_id) AS type,\n"
        "    COALESCE((SELECT json_agg(gn.nomek_id ORDER BY gn.nomek_id)\n"
        "              FROM core_geoname_nomek gn WHERE gn.geoname_id = g.id), '[]'::json) AS nomek,\n"
        "    COALESCE((SELECT json_agg(go.legalorder_id ORDER BY go.legalorder_id)\n"
        "              FROM core_legalorder_names go WHERE go.geoname_id = g.id), '[]'::json) AS orders\n"
        "FROM core_geoname g\n"
        "LEFT JOIN core_constant t  ON t.id = g.type_id\n"
        "LEFT JOIN core_constant t2 ON t2.id = t.parent_id\n"
        f"WHERE g.geoloc IS NOT NULL AND g.type_id IN ({ids})"
    )


def _leaf_view_groups():
    """{view_name: [type_id,...]} — бүх 3‑р түвшний навчийг код‑замаар бүлэглэнэ.
    Ижил кодтой синонимууд (нэг view нэр) нэг бүлэгт орно. Нэг query."""
    allt = list(Constant.objects.filter(key='GEONAME_TYPES'))
    by_id = {c.id: c for c in allt}
    ids = set(by_id)
    has_child = {c.parent_id for c in allt if c.parent_id in ids}

    def depth3(c):
        p = by_id.get(c.parent_id)
        return bool(p and p.parent_id)

    def vname(c):
        ch, x, seen = [], c, set()
        while x and x.id not in seen:
            seen.add(x.id)
            ch.append(x)
            x = by_id.get(x.parent_id)
        ch.reverse()
        raw = re.sub(r'[^a-zA-Z0-9_]', '', ''.join((y.code or '') for y in ch))
        return f"{raw}_view" if raw else f"t{c.id}_view"

    groups = {}
    for c in allt:
        if c.id not in has_child and depth3(c):
            groups.setdefault(vname(c), []).append(c.id)
    return groups


def _ensure_geoname_store():
    """geoname workspace‑д geoname_pg PostGIS store байхгүй бол үүсгэнэ."""
    from django.conf import settings as _st
    base, auth = _gs_rest_auth()
    r = requests.get(f"{base}/workspaces/{GEONAME_WS}/datastores/{GEONAME_STORE}.json",
                     auth=auth, timeout=10)
    if r.status_code == 200:
        return
    d = _st.DATABASES['default']
    geo.create_featurestore(
        store_name=GEONAME_STORE, workspace=GEONAME_WS, db=d['NAME'],
        host=d.get('HOST') or 'localhost', port=int(d.get('PORT') or 5432),
        pg_user=d['USER'], pg_password=d.get('PASSWORD') or '',
        schema='public', overwrite=False,
    )


GEONAME_SEARCH_VIEW = 'geoname_view'
# Хайлт/филтерийн нэгдсэн view — core_geoname‑аас ШУУД (per‑type view‑уудыг
# union хийдэггүй; views виртуал тул ачаалал нэмэхгүй). type_l1/l2/id, unit_ids,
# nomek_codes баганууд CQL‑д зориулагдсан.
_GEONAME_SEARCH_SQL = """SELECT g.id, g.name, g.number, g.is_approved, g.geoloc,
    COALESCE(g.is_border, false) AS is_border,
    g.type_id, t.parent_id AS type_l2, t2.parent_id AS type_l1,
    json_build_array(t.parent_id, g.type_id) AS type,
    COALESCE(' '||(SELECT string_agg(gu.adminunit_id::text,' ') FROM core_geoname_unit gu WHERE gu.geoname_id=g.id)||' ','') AS unit_ids,
    COALESCE((SELECT string_agg(n.nomek,' ') FROM core_geoname_nomek gn JOIN core_nomek n ON n.id=gn.nomek_id WHERE gn.geoname_id=g.id),'') AS nomek_codes,
    COALESCE((SELECT json_agg(gn.nomek_id) FROM core_geoname_nomek gn WHERE gn.geoname_id=g.id),'[]'::json) AS nomek,
    COALESCE((SELECT json_agg(ln.legalorder_id) FROM core_legalorder_names ln WHERE ln.geoname_id=g.id),'[]'::json) AS orders
FROM core_geoname g
LEFT JOIN core_constant t  ON t.id = g.type_id
LEFT JOIN core_constant t2 ON t2.id = t.parent_id
WHERE g.geoloc IS NOT NULL"""


def ensure_geoname_search_view():
    """geoname_view (хайлтын нэгдсэн view) байхгүй бол үүсгэж нийтэлнэ — өөрөө сэргэнэ."""
    try:
        with connection.cursor() as c:
            c.execute("SELECT to_regclass('public.geoname_view')")
            if c.fetchone()[0]:
                return
            c.execute('CREATE VIEW public."%s" AS %s' % (GEONAME_SEARCH_VIEW, _GEONAME_SEARCH_SQL))
        _ensure_geoname_store()
        _publish_or_recalc(GEONAME_SEARCH_VIEW, 'Газар зүйн нэр (хайлт)')
    except Exception:
        import logging
        logging.getLogger(__name__).warning("ensure_geoname_search_view failed", exc_info=True)


RECOUNT_VIEW = 'recount_view'
# Дахин тооллого (ReCount.loc) — геонэрийн type‑той join хийсэн view. geoname_view‑тэй
# ижил баганатай (type, type_l1/l2) тул ижил style (type symbol)‑оор зурагдана.
# project_id баганаар CQL‑ээр тухайн төслөөр шүүнэ.
_RECOUNT_VIEW_SQL = """SELECT r.id, r.project_id, r.status_id, r.draft,
    COALESCE(r.loc, g.geoloc) AS geoloc,
    g.type_id, t.parent_id AS type_l2, t2.parent_id AS type_l1,
    json_build_array(t.parent_id, g.type_id) AS type,
    COALESCE(g.name, r.draft) AS name
FROM core_recount r
LEFT JOIN core_geoname g  ON g.id = r.name_id
LEFT JOIN core_constant t  ON t.id = g.type_id
LEFT JOIN core_constant t2 ON t2.id = t.parent_id
WHERE COALESCE(r.loc, g.geoloc) IS NOT NULL"""


def _build_recount_type_sld():
    """Type бүрийн view style‑ийн дүрмүүдийг (symbolizer) уншиж, type_id filter‑тэй
    нэгтгэн recount_view‑д зориулсан combined SLD (1.0) болгож буцаана."""
    import xml.etree.ElementTree as ET
    SLD = 'http://www.opengis.net/sld'
    OGC = 'http://www.opengis.net/ogc'
    XLINK = 'http://www.w3.org/1999/xlink'
    ET.register_namespace('sld', SLD)
    ET.register_namespace('ogc', OGC)
    ET.register_namespace('xlink', XLINK)

    groups = _leaf_view_groups()  # {view_name: [type_id,...]}
    rules = []
    for vname, type_ids in groups.items():
        try:
            root = ET.fromstring(_gs_style_read_sld(GEONAME_WS, vname))
        except Exception:
            continue
        for rule in list(root.iter(f'{{{SLD}}}Rule')):
            # type_id filter (нэг буюу хэд хэдэн id) — OR
            flt = ET.Element(f'{{{OGC}}}Filter')
            host = flt
            if len(type_ids) > 1:
                host = ET.SubElement(flt, f'{{{OGC}}}Or')
            for tid in type_ids:
                eq = ET.SubElement(host, f'{{{OGC}}}PropertyIsEqualTo')
                ET.SubElement(eq, f'{{{OGC}}}PropertyName').text = 'type_id'
                ET.SubElement(eq, f'{{{OGC}}}Literal').text = str(tid)
            for ex in rule.findall(f'{{{OGC}}}Filter'):
                rule.remove(ex)
            rule.insert(0, flt)
            rules.append(rule)
    if not rules:
        return None
    sld = ET.Element(f'{{{SLD}}}StyledLayerDescriptor', {'version': '1.0.0'})
    nl = ET.SubElement(sld, f'{{{SLD}}}NamedLayer')
    ET.SubElement(nl, f'{{{SLD}}}Name').text = RECOUNT_VIEW
    us = ET.SubElement(nl, f'{{{SLD}}}UserStyle')
    ET.SubElement(us, f'{{{SLD}}}Name').text = RECOUNT_VIEW
    fts = ET.SubElement(us, f'{{{SLD}}}FeatureTypeStyle')
    for r in rules:
        fts.append(r)
    return ET.tostring(sld, encoding='unicode')


_GEONAME_TYPE_STYLE = 'geoname_types'
_geoname_type_style_done = False


def ensure_geoname_type_style():
    """geoname_view‑д type symbol бүхий combined NAMED style (geoname_types) үүсгэж,
    нэрийг буцаана (default болгохгүй — print дэх STYLES param-д ашиглана). Нэг удаа."""
    global _geoname_type_style_done
    name = _GEONAME_TYPE_STYLE
    if _geoname_type_style_done:
        return name
    try:
        sld = _build_recount_type_sld()  # type_id-д суурилсан тул geoname_view-д хүчинтэй
        if not sld:
            return ''
        sld = sld.replace(f'>{RECOUNT_VIEW}<', f'>{GEONAME_SEARCH_VIEW}<')  # NamedLayer
        base, auth = _gs_rest_auth()
        chk = requests.get(f"{base}/workspaces/{GEONAME_WS}/styles/{name}.json",
                           auth=auth, timeout=10)
        if chk.status_code != 200:
            requests.post(f"{base}/workspaces/{GEONAME_WS}/styles",
                          json={"style": {"name": name, "filename": f"{name}.sld"}},
                          auth=auth, timeout=10)
        _gs_style_write_sld(GEONAME_WS, name, sld)
        _geoname_type_style_done = True
        return name
    except Exception:
        import logging
        logging.getLogger(__name__).warning("ensure_geoname_type_style failed", exc_info=True)
        return ''


def _assign_recount_type_style():
    """recount_view‑д type symbol бүхий combined style үүсгэж, default болгоно."""
    sld = _build_recount_type_sld()
    if not sld:
        return
    base, auth = _gs_rest_auth()
    # style объект байхгүй бол үүсгэнэ
    chk = requests.get(f"{base}/workspaces/{GEONAME_WS}/styles/{RECOUNT_VIEW}.json",
                       auth=auth, timeout=10)
    if chk.status_code != 200:
        requests.post(f"{base}/workspaces/{GEONAME_WS}/styles",
                      json={"style": {"name": RECOUNT_VIEW, "filename": f"{RECOUNT_VIEW}.sld"}},
                      auth=auth, timeout=10)
    _gs_style_write_sld(GEONAME_WS, RECOUNT_VIEW, sld)
    requests.put(
        f"{base}/layers/{GEONAME_WS}:{RECOUNT_VIEW}",
        data=f'<layer><defaultStyle><name>{RECOUNT_VIEW}</name>'
             f'<workspace>{GEONAME_WS}</workspace></defaultStyle></layer>',
        auth=auth, headers={"Content-Type": "text/xml"}, timeout=10)


def ensure_recount_view():
    """recount_view (төслийн дахин тооллогын view) — байхгүй бол үүсгэж нийтэлнэ,
    type symbol бүхий combined style ононо."""
    try:
        with connection.cursor() as c:
            c.execute("SELECT to_regclass('public.recount_view')")
            if not c.fetchone()[0]:
                c.execute('CREATE VIEW public."%s" AS %s' % (RECOUNT_VIEW, _RECOUNT_VIEW_SQL))
        _ensure_geoname_store()
        _publish_or_recalc(RECOUNT_VIEW, 'Дахин тооллого')
        try:
            _assign_recount_type_style()
        except Exception:
            import logging
            logging.getLogger(__name__).warning("recount style failed", exc_info=True)
    except Exception:
        import logging
        logging.getLogger(__name__).warning("ensure_recount_view failed", exc_info=True)


def _publish_or_recalc(name, title):
    base, auth = _gs_rest_auth()
    body = {"featureType": {"name": name, "nativeName": name, "title": title, "srs": "EPSG:4326"}}
    r = requests.post(f"{base}/workspaces/{GEONAME_WS}/datastores/{GEONAME_STORE}/featuretypes",
                      json=body, auth=auth, timeout=20)
    if r.status_code not in (200, 201):
        requests.put(
            f"{base}/workspaces/{GEONAME_WS}/datastores/{GEONAME_STORE}/featuretypes/{name}",
            params={'recalculate': 'nativebbox,latlonbbox'},
            json={"featureType": {"name": name, "title": title, "srs": "EPSG:4326"}},
            auth=auth, timeout=20)
    _ensure_default_style(name)


def _ensure_default_style(view_name):
    """View‑д ХҮЧИНТЭЙ default style байгаа эсэхийг шалгана. Байхгүй ЭСВЭЛ зааж буй
    SLD нь бодитоор оршихгүй (эвдэрсэн reference) бол built‑in 'point' онооно —
    LayerGroup бүх layer‑д хүчинтэй default style шаарддаг (NoDefaultStyle‑аас
    сэргийлнэ). Хэрэглэгчийн тохируулсан хүчинтэй style‑г хөндөхгүй."""
    base, auth = _gs_rest_auth()
    try:
        r = requests.get(f"{base}/layers/{GEONAME_WS}:{view_name}.json", auth=auth, timeout=10)
        ds = (r.json().get('layer', {}) or {}).get('defaultStyle') if r.status_code == 200 else None
        if ds and ds.get('href'):
            # Зааж буй style‑ийн SLD бодитоор байгаа эсэх (эвдэрсэн бол солино)
            sr = requests.get(ds['href'], auth=auth, timeout=10)
            if sr.status_code == 200:
                return
        requests.put(
            f"{base}/layers/{GEONAME_WS}:{view_name}",
            data='<layer><defaultStyle><name>point</name></defaultStyle></layer>',
            auth=auth, headers={"Content-Type": "text/xml"}, timeout=10)
    except requests.RequestException:
        pass


def _drop_featuretype_and_view(name):
    base, auth = _gs_rest_auth()
    try:
        requests.delete(
            f"{base}/workspaces/{GEONAME_WS}/datastores/{GEONAME_STORE}/featuretypes/{name}",
            params={'recurse': 'true'}, auth=auth, timeout=20)
    except requests.RequestException:
        pass
    if re.match(r'^[a-zA-Z0-9_]+$', name or ''):
        with connection.cursor() as cur:
            cur.execute(f'DROP VIEW IF EXISTS public."{name}" CASCADE')
    ensure_names_layergroup()  # нэрийн нэгдсэн давхаргыг синк


NAMES_LAYERGROUP = 'names'


def ensure_names_layergroup():
    """Бүх per-type view‑г нэгтгэсэн 'geoname:names' LayerGroup‑г одоогийн view‑ийн
    жагсаалтаар дахин барина — нэр бүр өөрийн тохируулсан таних тэмдгээрээ нэг WMS
    давхаргаар гарна. View нэмэгдэх/устах бүрд дуудагдаж автоматаар синк байна."""
    try:
        base, auth = _gs_rest_auth()
        r = requests.get(
            f"{base}/workspaces/{GEONAME_WS}/datastores/{GEONAME_STORE}/featuretypes.json",
            auth=auth, timeout=15)
        if r.status_code != 200:
            return
        fts = [f['name'] for f in (r.json().get('featureTypes', {}) or {}).get('featureType', [])]
        views = [v for v in fts if v.endswith('_view') and v != GEONAME_SEARCH_VIEW]
        # ЗӨВХӨН ИДЭВХТЭЙ (PostGIS‑д бодитоор оршиж буй) view — эвдэрсэн/устсан
        # view group‑ийг унагахаас сэргийлнэ.
        with connection.cursor() as cur:
            cur.execute(
                "SELECT table_name FROM information_schema.views "
                "WHERE table_schema='public' AND table_name ~ '_view$'")
            pg_views = {row[0] for row in cur.fetchall()}
        views = sorted(v for v in views if v in pg_views)
        # Group‑ийн layer бүрд default style баталгаажуулна (NoDefaultStyle‑аас)
        for v in views:
            _ensure_default_style(v)
        pub = "".join(
            f'<published type="layer">{GEONAME_WS}:{v}</published>' for v in views)
        sty = "".join('<style/>' for _ in views)
        xml = (
            f'<layerGroup><name>{NAMES_LAYERGROUP}</name><mode>SINGLE</mode>'
            f'<title>Газар зүйн нэр (таних тэмдэгтэй)</title>'
            f'<publishables>{pub}</publishables><styles>{sty}</styles>'
            f'<bounds><minx>87</minx><maxx>120</maxx><miny>41</miny>'
            f'<maxy>52</maxy><crs>EPSG:4326</crs></bounds></layerGroup>'
        )
        if not views:
            # View үлдээгүй бол layergroup‑г устга
            requests.delete(
                f"{base}/workspaces/{GEONAME_WS}/layergroups/{NAMES_LAYERGROUP}",
                auth=auth, timeout=15)
            return
        # Үргэлж цэвэр дахин барина (хуучин stale style reference‑ээс сэргийлэх)
        requests.delete(
            f"{base}/workspaces/{GEONAME_WS}/layergroups/{NAMES_LAYERGROUP}?purge=true",
            auth=auth, timeout=15)
        requests.post(
            f"{base}/workspaces/{GEONAME_WS}/layergroups",
            data=xml, auth=auth, headers={"Content-Type": "text/xml"}, timeout=30)
    except requests.RequestException:
        import logging
        logging.getLogger(__name__).warning('ensure_names_layergroup failed', exc_info=True)


def is_geoname_leaf(const):
    """GEONAME_TYPES 3‑р түвшний зангилаа эсэх — хүүхэдгүй БА өвөгтэй
    (parent.parent байгаа). Зөвхөн ийм зангилаад view үүснэ; level1/level2‑т үгүй."""
    if const.key != 'GEONAME_TYPES':
        return False
    if Constant.objects.filter(parent_id=const.id).exists():
        return False  # хүүхэдтэй → view үүсэхгүй
    parent = (Constant.objects.filter(id=const.parent_id).first()
              if const.parent_id else None)
    return bool(parent and parent.parent_id)  # өвөг байх ёстой = 3‑р түвшин


def sync_geoname_type_view(const):
    """Навч ангиллын view‑г үүсгэх/шинэчилж GeoServer‑т нийтэлнэ. Нэрийг буцаана."""
    if not is_geoname_leaf(const):
        return None
    name = geoname_type_view_name(const)
    # ижил кодтой (нэг view нэртэй) синонимуудын бүх type_id‑г нэгтгэнэ
    type_ids = _leaf_view_groups().get(name) or [const.id]
    _ensure_geoname_store()
    with connection.cursor() as cur:
        cur.execute(f'DROP VIEW IF EXISTS public."{name}" CASCADE')
        cur.execute(f'CREATE VIEW public."{name}" AS {_geoname_type_select(type_ids)}')
    _publish_or_recalc(name, const.name or name)
    geom = GEOM_STYLE.get((const.desc or '').strip(), '')
    if geom:
        try:
            create_default_style_and_assign(
                workspace=GEONAME_WS, layer_name=name, geom_type=geom)
        except Exception:
            pass
    ensure_names_layergroup()  # нэрийн нэгдсэн давхаргыг синк
    return name


def geoname_leaf_descendants(node):
    """node + бүх удмаас навч (хүүхэдгүй) GEONAME_TYPES‑уудыг буцаана."""
    result, frontier, seen = [], [node], set()
    while frontier:
        nxt = []
        for n in frontier:
            if n.id in seen:
                continue
            seen.add(n.id)
            kids = list(Constant.objects.filter(parent_id=n.id))
            if not kids and is_geoname_leaf(n):
                result.append(n)
            nxt.extend(kids)
        frontier = nxt
    return result

def _is_number_like(s):
    # тоон утга эсэхийг жоохон "уучирсан" шалгалтаар тодорхойлоё
    try:
        float(str(s))
        return True
    except (TypeError, ValueError):
        return False

def _build_cql_from_filters_json(filters: list[dict] | None, join_op: str = "AND") -> str | None:
    """
    filters = [
      {"field": "state_id", "operator": "gt", "value": "311"},
      {"field": "name",     "operator": "isnotnull", "value": None},
      {"field": "code",     "operator": "in", "value": ["A","B","C"]},
    ]
    """
    if not filters:
        return None

    def quote(v):
        # тоо бол шууд, бусад нь нэг ишлэлд
        if v is None:
            return "NULL"  # ихэнхдээ хэрэглэхгүй, доор тусгайгаар боловсруулна
        try:
            # int/float таних гэж оролдоно
            float(v)
            return str(v)
        except (TypeError, ValueError):
            s = str(v).replace("'", "''")
            return f"'{s}'"

    op_map = {
        "=": "=", "==": "=", "eq": "=",
        "!=": "<>", "<>": "<>", "neq": "<>",
        ">": ">", "gt": ">",
        ">=": ">=", "gte": ">=",
        "<": "<", "lt": "<",
        "<=": "<=", "lte": "<=",
        "like": "LIKE",
        "contains": "LIKE",
        "startswith": "LIKE",
        "endswith": "LIKE",
        "in": "IN",
        "isnull": "IS NULL",
        "isnotnull": "IS NOT NULL",
    }

    parts = []
    for f in filters:
        field = (f.get("field") or "").strip()
        op    = (f.get("operator") or "").lower()
        val   = f.get("value", None)
        if not field or not op:
            continue

        norm = op_map.get(op, op)

        # NULL checks
        if norm in ("IS NULL", "IS NOT NULL"):
            parts.append(f"{field} {norm}")
            continue

        # LIKE variants
        if norm == "LIKE":
            text = "" if val is None else str(val)
            if op in ("contains", "like"):
                pattern = f"%{text}%"
            elif op == "startswith":
                pattern = f"{text}%"
            else:  # endswith
                pattern = f"%{text}"
            s = pattern.replace("'", "''")
            parts.append(f"{field} LIKE '{s}'")
            continue

        # IN
        if norm == "IN":
            if isinstance(val, (list, tuple)):
                items = [quote(v) for v in val]
            elif isinstance(val, str) and "," in val:
                items = [quote(v.strip()) for v in val.split(",") if v.strip()]
            elif val is not None:
                items = [quote(val)]
            else:
                items = []
            if not items:
                continue
            parts.append(f"{field} IN ({', '.join(items)})")
            continue

        # compare
        if val is None:
            # NULL-тэй харьцуулахгүй
            continue
        parts.append(f"{field} {norm} {quote(val)}")

    if not parts:
        return None

    gate = " AND " if (join_op or "").upper() != "OR" else " OR "
    return gate.join(parts)

def _get_filters_as_list(rules_qs):
    out = []
    for r in rules_qs.order_by("order", "id"):
        out.append({
            "id": r.id,
            "name": f"{r.name}",
			"rulename": f"{r.style.id}_{r.id}",
            "join_op": getattr(r, "join_op", "AND"),
            "filters": r.filters or [],  # JSONField
        })
    return out

def persist_rule_styles_from_applied(layer, applied):
    id_list = [a.get("id") for a in applied if a.get("id")]
    if not id_list:
        return
    rules = {r.id: r for r in StyleRule.objects.filter(layer=layer, id__in=id_list)}
    to_update = []
    for a in applied:
        rid = a.get("id")
        r = rules.get(rid)
        if not r:
            continue
        color = a.get("color")
        geom_type = (a.get("geom_type") or layer.geom_type or "").lower()
        if geom_type == "line":
            r.stroke_color = color
            if a.get("stroke_size") and not r.stroke_width:
                r.stroke_width = a["stroke_size"]
        else:
            r.fill_color = color
            if a.get("stroke"):
                r.stroke_color = r.stroke_color or a["stroke"]
            if geom_type == "point":
                if a.get("size") and not r.size:
                    r.size = a["size"]
                if a.get("stroke_size") and not r.stroke_width:
                    r.stroke_width = a["stroke_size"]

        to_update.append(r)

    if to_update:
        # аль талбаруудыг шинэчилж байгаагаа жагсааж болно
        StyleRule.objects.bulk_update(
            to_update,
            ["fill_color", "stroke_color", "stroke_width", "size"],
        )

class WorkSpaceViewSet(PublicListMixin, viewsets.ModelViewSet):
	serializer_class =WorkspaceSerializer
	queryset=Constant.objects.filter(key='WORKSPACES')
	filterset_class = GlobalFilter
	permission_classes = [IsAuthenticated]
	filter_backends = [DjangoFilterBackend, filters.OrderingFilter, filters.SearchFilter]
	parser_classes = [JSONParser, MultiPartParser, FormParser]
	ordering_fields = [f.name for f in Constant._meta.fields]

	@action(detail=False, methods=['get'], url_path='tree')
	def tree(self, request):
		"""WORKSPACES мод — parent байвал дэд зангилаа, эс бөгөөс үндсэн
		workspace‑ууд (картууд). Мөр бүрт child_count. CRUD нь үндсэн route‑оор."""
		from django.db.models import Count
		parent = request.query_params.get('parent', None)
		qs = Constant.objects.annotate(child_count=Count('children', distinct=True))
		if parent:
			qs = qs.filter(parent_id=parent)
		else:
			qs = qs.filter(key='WORKSPACES', parent__isnull=True)
		qs = qs.order_by('code', 'id')
		# Үндсэн картуудад GeoServer холболт + view тоог нэмнэ
		gs_info = {}
		if not parent:
			base, auth = self._gs_rest(), self._gs_auth()
			for c in qs:
				exists, vcount = False, 0
				try:
					rr = requests.get(f"{base}/workspaces/{c.name}.json", auth=auth, timeout=8)
					exists = rr.status_code == 200
					if exists:
						fr = requests.get(
							f"{base}/workspaces/{c.name}/datastores/{GEONAME_STORE}/featuretypes.json",
							auth=auth, timeout=8)
						if fr.status_code == 200:
							vcount = len((fr.json().get('featureTypes') or {})
										 .get('featureType') or [])
				except requests.RequestException:
					pass
				gs_info[c.id] = {'gs_exists': exists, 'view_count': vcount}
		data = [{
			'id': c.id, 'name': c.name, 'key': c.key, 'code': c.code,
			'label': c.label, 'color': c.color, 'desc': c.desc,
			'parent': c.parent_id, 'child_count': c.child_count,
			**gs_info.get(c.id, {}),
		} for c in qs]
		return Response({'results': data}, status=200)

	# --- GeoServer‑тэй шууд холбогдож workspace + WMS/WFS/WMTS удирдах ---
	GS_SERVICES = ['wms', 'wfs', 'wmts']

	def _gs_auth(self):
		return HTTPBasicAuth(settings.GEOSERVER_USER, settings.GEOSERVER_PASSWORD)

	def _gs_rest(self):
		return f"{settings.GEOSERVER_URL}/rest"

	def _gs_service_state(self, ws, svc):
		"""Тухайн workspace дээрх үйлчилгээний идэвхтэй эсэх + хамрах хүрээ.
		workspace‑specific тохиргоо байхгүй бол global‑оор уншина."""
		base, auth = self._gs_rest(), self._gs_auth()
		try:
			r = requests.get(f"{base}/services/{svc}/workspaces/{ws}/settings.json",
							 auth=auth, timeout=10)
			if r.status_code == 200:
				return {'enabled': bool(r.json().get(svc, {}).get('enabled', False)),
						'scope': 'workspace'}
			if r.status_code == 404:
				g = requests.get(f"{base}/services/{svc}/settings.json", auth=auth, timeout=10)
				if g.status_code == 200:
					return {'enabled': bool(g.json().get(svc, {}).get('enabled', False)),
							'scope': 'global'}
			return {'enabled': None, 'scope': 'unavailable'}
		except requests.RequestException:
			return {'enabled': None, 'scope': 'error'}

	def _layer_disabled_services(self, ws_name, name):
		"""Тухайн featuretype дээр идэвхгүй болгосон үйлчилгээнүүд (WMS/WFS/WMTS)."""
		base, auth = self._gs_rest(), self._gs_auth()
		try:
			r = requests.get(
				f"{base}/workspaces/{ws_name}/datastores/{GEONAME_STORE}/featuretypes/{name}.json",
				auth=auth, timeout=8)
			if r.status_code == 200:
				ds = (r.json().get('featureType') or {}).get('disabledServices') or {}
				vals = ds.get('string')
				if isinstance(vals, str):
					vals = [vals]
				return [str(v).upper() for v in (vals or [])]
		except requests.RequestException:
			pass
		return []

	@action(detail=True, methods=['post'], url_path='gs-layer-service')
	def gs_layer_service(self, request, *args, **kwargs):
		"""Тухайн layer (featuretype)‑д үйлчилгээ (WMS/WFS/WMTS) идэвхжүүлэх/хаах."""
		ws = self.get_object()
		layer = (request.data.get('layer') or '').strip()
		svc = (request.data.get('service') or '').upper()
		enabled = bool(request.data.get('enabled'))
		if svc not in ('WMS', 'WFS', 'WMTS', 'WCS'):
			return Response({'detail': 'Үл мэдэгдэх үйлчилгээ'}, status=400)
		s = set(self._layer_disabled_services(ws.name, layer))
		if enabled:
			s.discard(svc)
		else:
			s.add(svc)
		base, auth = self._gs_rest(), self._gs_auth()
		body = {"featureType": {"serviceConfiguration": True,
								"disabledServices": {"string": sorted(s)}}}
		try:
			r = requests.put(
				f"{base}/workspaces/{ws.name}/datastores/{GEONAME_STORE}/featuretypes/{layer}",
				json=body, auth=auth, timeout=15)
			if r.status_code in (200, 201):
				return Response({'layer': layer, 'disabled': sorted(s)}, status=200)
			return Response({'detail': f'GeoServer алдаа ({r.status_code})',
							 'body': r.text[:200]}, status=400)
		except requests.RequestException as e:
			return Response({'detail': f'GeoServer холбогдсонгүй: {e}'}, status=502)

	@action(detail=True, methods=['get'], url_path='type-views')
	def type_views(self, request, *args, **kwargs):
		"""Тухайн workspace‑ийн wms store доторх view‑ууд. geoname бол ангиллын
		(GEONAME_TYPES навч) мэдээлэлтэй; бусад workspace бол featuretype жагсаалт."""
		ws = self.get_object()
		base, auth = self._gs_rest(), self._gs_auth()
		# Тухайн workspace‑ийн wms store доторх featuretype‑ууд (published)
		published = set()
		try:
			r = requests.get(
				f"{base}/workspaces/{ws.name}/datastores/{GEONAME_STORE}/featuretypes.json",
				auth=auth, timeout=10)
			if r.status_code == 200:
				published = {f['name'] for f in
							 (r.json().get('featureTypes') or {}).get('featureType') or []}
		except requests.RequestException:
			pass

		def svc_flags(nm):
			d = self._layer_disabled_services(ws.name, nm)
			return {'wms': 'WMS' not in d, 'wfs': 'WFS' not in d, 'wmts': 'WMTS' not in d}

		rows = []
		if ws.name == GEONAME_WS:
			# geoname: GEONAME_TYPES навч (3‑р түвшин) ангилал тус бүрээр
			allt = list(Constant.objects.filter(key='GEONAME_TYPES'))
			by_id = {c.id: c for c in allt}
			ids = set(by_id)
			has_child = {c.parent_id for c in allt if c.parent_id in ids}

			def is_depth3(c):
				p = by_id.get(c.parent_id)
				return bool(p and p.parent_id)

			leaves = [c for c in allt if c.id not in has_child and is_depth3(c)]

			def chain(c):
				ch, x, seen = [], c, set()
				while x and x.id not in seen:
					seen.add(x.id)
					ch.append(x)
					x = by_id.get(x.parent_id)
				return list(reversed(ch))

			def vname(ch):
				raw = re.sub(r'[^a-zA-Z0-9_]', '', ''.join((x.code or '') for x in ch))
				return f"{raw}_view" if raw else f"t{ch[-1].id}_view"

			for lf in leaves:
				ch = chain(lf)
				nm = vname(ch)
				if nm not in published:
					continue  # энэ workspace‑д нийтлэгдээгүй бол алгасна
				names = [x.name for x in ch]
				rows.append({
					'view': nm, 'type_id': lf.id, 'geom': (lf.desc or '').strip(),
					'level1': names[0] if len(names) > 0 else '',
					'level2': names[1] if len(names) > 1 else '',
					'level3': names[2] if len(names) > 2 else '',
					'published': True, **svc_flags(nm),
				})
			rows.sort(key=lambda r: (r['level1'], r['level2'], r['level3']))
		else:
			# бусад workspace: featuretype жагсаалт (ангилалгүй)
			for nm in sorted(published):
				rows.append({
					'view': nm, 'type_id': None, 'geom': '',
					'level1': '', 'level2': '', 'level3': '',
					'published': True, **svc_flags(nm),
				})
		return Response({'workspace': ws.name, 'store': GEONAME_STORE, 'results': rows}, status=200)

	@action(detail=True, methods=['get'], url_path='gs-status')
	def gs_status(self, request, *args, **kwargs):
		"""Workspace GeoServer дээр байгаа эсэх + WMS/WFS/WMTS төлөв."""
		ws = self.get_object()
		name = ws.name
		base, auth = self._gs_rest(), self._gs_auth()
		exists = False
		try:
			rr = requests.get(f"{base}/workspaces/{name}.json", auth=auth, timeout=10)
			exists = rr.status_code == 200
		except requests.RequestException:
			pass
		services = {svc: self._gs_service_state(name, svc) for svc in self.GS_SERVICES}
		return Response({'workspace': name, 'exists': exists, 'services': services}, status=200)

	@action(detail=True, methods=['post'], url_path='gs-sync')
	def gs_sync(self, request, *args, **kwargs):
		"""Workspace‑ийг GeoServer дээр үүсгэх (байхгүй бол)."""
		ws = self.get_object()
		try:
			geo.create_workspace(workspace=ws.name)
		except Exception as e:
			import logging
			logging.getLogger(__name__).warning("gs_sync failed", exc_info=e)
		return Response({'workspace': ws.name, 'synced': True}, status=200)

	@action(detail=True, methods=['post'], url_path='gs-service')
	def gs_service(self, request, *args, **kwargs):
		"""Workspace дээрх үйлчилгээг (WMS/WFS/WMTS) идэвхжүүлэх/идэвхгүйжүүлэх."""
		ws = self.get_object()
		name = ws.name
		svc = (request.data.get('service') or '').lower()
		enabled = bool(request.data.get('enabled'))
		if svc not in self.GS_SERVICES:
			return Response({'detail': 'Үл мэдэгдэх үйлчилгээ'}, status=400)
		base, auth = self._gs_rest(), self._gs_auth()
		# name талбар заавал (workspace‑specific settings шинээр үүсгэхэд GeoServer шаардана)
		body = {svc: {"name": svc.upper(), "enabled": enabled, "workspace": {"name": name}}}
		try:
			r = requests.put(f"{base}/services/{svc}/workspaces/{name}/settings",
							 json=body, auth=auth, timeout=15)
			if r.status_code in (200, 201):
				return Response({'service': svc, 'enabled': enabled,
								 'state': self._gs_service_state(name, svc)}, status=200)
			return Response({'detail': f'GeoServer алдаа ({r.status_code})',
							 'body': r.text[:300]}, status=400)
		except requests.RequestException as e:
			return Response({'detail': f'GeoServer холбогдсонгүй: {e}'}, status=502)

	# --- Store (PostGIS datastore) + Layer (PG view) удирдлага ---
	_IDENT_RE = re.compile(r'^[a-zA-Z_][a-zA-Z0-9_]*$')

	def _db_conf(self):
		from django.conf import settings as st
		d = st.DATABASES['default']
		return {
			'db': d['NAME'], 'host': d.get('HOST') or 'localhost',
			'port': int(d.get('PORT') or 5432),
			'user': d['USER'], 'password': d.get('PASSWORD') or '',
		}

	@action(detail=True, methods=['get'], url_path='gs-stores')
	def gs_stores(self, request, *args, **kwargs):
		"""Workspace доторх datastore (store)‑уудыг GeoServer‑ээс жагсаана."""
		ws = self.get_object()
		base, auth = self._gs_rest(), self._gs_auth()
		out = []
		try:
			r = requests.get(f"{base}/workspaces/{ws.name}/datastores.json", auth=auth, timeout=10)
			if r.status_code == 200:
				items = (r.json().get('dataStores') or {}).get('dataStore') or []
				out = [{'name': it['name']} for it in items]
		except requests.RequestException as e:
			return Response({'detail': f'GeoServer холбогдсонгүй: {e}'}, status=502)
		return Response({'workspace': ws.name, 'results': out}, status=200)

	@action(detail=True, methods=['post'], url_path='gs-create-store')
	def gs_create_store(self, request, *args, **kwargs):
		"""Workspace дотор geoname DB рүү холбогдсон PostGIS store үүсгэнэ."""
		ws = self.get_object()
		name = (request.data.get('name') or '').strip()
		if not self._IDENT_RE.match(name):
			return Response({'detail': 'Store нэр буруу (зөвхөн үсэг, тоо, _)'}, status=400)
		c = self._db_conf()
		try:
			geo.create_featurestore(
				store_name=name, workspace=ws.name, db=c['db'], host=c['host'],
				port=c['port'], pg_user=c['user'], pg_password=c['password'],
				schema='public', overwrite=False,
			)
		except Exception as e:
			return Response({'detail': f'Store үүсгэхэд алдаа: {e}'}, status=400)
		return Response({'name': name}, status=200)

	@action(detail=True, methods=['post'], url_path='gs-delete-store')
	def gs_delete_store(self, request, *args, **kwargs):
		"""Store‑ийг GeoServer‑ээс устгана (доторх layer‑тэйгээ хамт)."""
		ws = self.get_object()
		store = (request.data.get('store') or '').strip()
		base, auth = self._gs_rest(), self._gs_auth()
		try:
			requests.delete(f"{base}/workspaces/{ws.name}/datastores/{store}",
							params={'recurse': 'true'}, auth=auth, timeout=20)
		except requests.RequestException as e:
			return Response({'detail': f'GeoServer холбогдсонгүй: {e}'}, status=502)
		return Response(status=204)

	@action(detail=True, methods=['get'], url_path='gs-layers')
	def gs_layers(self, request, *args, **kwargs):
		"""Store доторх layer (featuretype)‑ууд + тус бүрийн PG view SQL."""
		ws = self.get_object()
		store = (request.query_params.get('store') or '').strip()
		base, auth = self._gs_rest(), self._gs_auth()
		names = []
		try:
			r = requests.get(f"{base}/workspaces/{ws.name}/datastores/{store}/featuretypes.json",
							 auth=auth, timeout=10)
			if r.status_code == 200:
				items = (r.json().get('featureTypes') or {}).get('featureType') or []
				names = [it['name'] for it in items]
		except requests.RequestException as e:
			return Response({'detail': f'GeoServer холбогдсонгүй: {e}'}, status=502)
		# PG view‑ийн SQL‑ийг DB‑ээс уншина (засварлахад хэрэгтэй)
		defs = {}
		if names:
			with connection.cursor() as cur:
				for n in names:
					try:
						cur.execute("SELECT pg_get_viewdef(to_regclass(%s), true)", [f'public."{n}"'])
						row = cur.fetchone()
						defs[n] = (row[0] or '').strip() if row else None
					except Exception:
						defs[n] = None
		results = [{'name': n, 'sql': defs.get(n), 'is_view': defs.get(n) is not None}
				   for n in names]
		return Response({'workspace': ws.name, 'store': store, 'results': results}, status=200)

	def _publish_featuretype(self, ws_name, store, name, title):
		base, auth = self._gs_rest(), self._gs_auth()
		body = {"featureType": {"name": name, "nativeName": name,
								"title": title or name, "srs": "EPSG:4326"}}
		return requests.post(
			f"{base}/workspaces/{ws_name}/datastores/{store}/featuretypes",
			json=body, auth=auth, timeout=20)

	@action(detail=True, methods=['post'], url_path='gs-create-layer')
	def gs_create_layer(self, request, *args, **kwargs):
		"""PG view үүсгээд (CREATE OR REPLACE) store дотор layer болгон нийтэлнэ."""
		ws = self.get_object()
		store = (request.data.get('store') or '').strip()
		name = (request.data.get('name') or '').strip()
		sql = (request.data.get('sql') or '').strip()
		title = (request.data.get('title') or name).strip()
		if not self._IDENT_RE.match(name):
			return Response({'detail': 'Layer/view нэр буруу (зөвхөн үсэг, тоо, _)'}, status=400)
		if not sql.lower().startswith('select'):
			return Response({'detail': 'SQL нь SELECT‑ээр эхлэх ёстой'}, status=400)
		# 1) PG view үүсгэх
		try:
			with connection.cursor() as cur:
				cur.execute(f'DROP VIEW IF EXISTS public."{name}" CASCADE')
				cur.execute(f'CREATE VIEW public."{name}" AS {sql}')
		except Exception as e:
			return Response({'detail': f'View үүсгэхэд алдаа: {e}'}, status=400)
		# 2) GeoServer дээр нийтлэх
		try:
			r = self._publish_featuretype(ws.name, store, name, title)
			if r.status_code not in (200, 201):
				return Response({'detail': f'Нийтлэхэд GeoServer алдаа ({r.status_code})',
								 'body': r.text[:300]}, status=400)
		except requests.RequestException as e:
			return Response({'detail': f'GeoServer холбогдсонгүй: {e}'}, status=502)
		# 3) Default style
		try:
			create_default_style_and_assign(workspace=ws.name, layer_name=name, geom_type='')
		except Exception:
			pass
		return Response({'name': name, 'store': store}, status=200)

	@action(detail=True, methods=['post'], url_path='gs-update-layer')
	def gs_update_layer(self, request, *args, **kwargs):
		"""PG view‑ийн SQL‑ийг шинэчилж, GeoServer featuretype‑ийг recalc хийнэ."""
		ws = self.get_object()
		store = (request.data.get('store') or '').strip()
		name = (request.data.get('name') or '').strip()
		sql = (request.data.get('sql') or '').strip()
		title = (request.data.get('title') or name).strip()
		if not self._IDENT_RE.match(name):
			return Response({'detail': 'Нэр буруу'}, status=400)
		if not sql.lower().startswith('select'):
			return Response({'detail': 'SQL нь SELECT‑ээр эхлэх ёстой'}, status=400)
		try:
			with connection.cursor() as cur:
				cur.execute(f'DROP VIEW IF EXISTS public."{name}" CASCADE')
				cur.execute(f'CREATE VIEW public."{name}" AS {sql}')
		except Exception as e:
			return Response({'detail': f'View шинэчлэхэд алдаа: {e}'}, status=400)
		base, auth = self._gs_rest(), self._gs_auth()
		body = {"featureType": {"name": name, "title": title, "srs": "EPSG:4326"}}
		try:
			r = requests.put(
				f"{base}/workspaces/{ws.name}/datastores/{store}/featuretypes/{name}",
				params={'recalculate': 'nativebbox,latlonbbox'},
				json=body, auth=auth, timeout=20)
			if r.status_code not in (200, 201):
				# featuretype байхгүй бол шинээр нийтэлнэ
				rp = self._publish_featuretype(ws.name, store, name, title)
				if rp.status_code not in (200, 201):
					return Response({'detail': f'Шинэчлэхэд алдаа ({r.status_code})',
									 'body': r.text[:300]}, status=400)
		except requests.RequestException as e:
			return Response({'detail': f'GeoServer холбогдсонгүй: {e}'}, status=502)
		return Response({'name': name}, status=200)

	@action(detail=True, methods=['post'], url_path='gs-delete-layer')
	def gs_delete_layer(self, request, *args, **kwargs):
		"""Layer‑ийг (featuretype) устгаад PG view‑г нь устгана."""
		ws = self.get_object()
		store = (request.data.get('store') or '').strip()
		name = (request.data.get('name') or '').strip()
		drop_view = request.data.get('drop_view', True)
		base, auth = self._gs_rest(), self._gs_auth()
		try:
			requests.delete(
				f"{base}/workspaces/{ws.name}/datastores/{store}/featuretypes/{name}",
				params={'recurse': 'true'}, auth=auth, timeout=20)
		except requests.RequestException as e:
			return Response({'detail': f'GeoServer холбогдсонгүй: {e}'}, status=502)
		if drop_view and self._IDENT_RE.match(name):
			try:
				with connection.cursor() as cur:
					cur.execute(f'DROP VIEW IF EXISTS public."{name}" CASCADE')
			except Exception as e:
				return Response({'detail': f'GeoServer‑ээс устсан ч view устсангүй: {e}'}, status=200)
		return Response(status=204)

	@transaction.atomic
	def create(self, request, *args, **kwargs):
		ser = self.get_serializer(data=request.data)
		ser.is_valid(raise_exception=True)
		instance = ser.save(key='WORKSPACES')
		# Зөвхөн үндсэн workspace (parent байхгүй) GeoServer дээр үүснэ
		if instance.parent_id is None:
			try:
				geo.create_workspace(workspace=instance.name)
			except Exception as e:
				import logging
				logging.getLogger(__name__).warning("Failed to create workspace in GeoServer", exc_info=e)
		return Response({'results': ser.data}, status=200)
	@transaction.atomic
	def destroy(self, request, *args, **kwargs):
		instance = self.get_object()
		try:
			geo.delete_workspace(workspace=instance.name)
		except Exception as e:
			import logging
			logging.getLogger(__name__).warning("Failed to delete workspace in GeoServer", exc_info=e)
		instance.delete()
		return Response(status=204)
	@action(detail=False, methods=['get'], url_path='layers',
			filter_backends=[], url_name='geoserver-layers')      # <= filter_backends хоосоллоо
	def layers(self, request):
		AUTH = HTTPBasicAuth(settings.GEOSERVER_USER, settings.GEOSERVER_PASSWORD)
		REST = "https://point.geodesy.gov.mn:8080/geoserver/rest"
		res = requests.get(f"{REST}/layers.json", auth=AUTH, timeout=10)
		res.raise_for_status()
		layers = res.json().get("layers", {}).get("layer", [])
		out = []
		for li in layers:
			layer_detail = requests.get(li["href"], auth=AUTH, timeout=10).json().get("layer", {})
			res_href = (layer_detail.get("resource") or {}).get("href")
			if not res_href:
				continue
			meta = requests.get(res_href, auth=AUTH, timeout=10).json()
			ft = meta.get("featureType")
			if ft:
				attrs = (ft.get("attributes") or {}).get("attribute") or []
				fields = [{"name": a.get("name")} for a in attrs]
			else:
				fields = None
			if (layer_detail.get("defaultStyle") or {}).get("workspace") == "point":
				out.append({
					"name": layer_detail.get("name"),
					"type": layer_detail.get("type"),
					"workspace": (layer_detail.get("defaultStyle") or {}).get("workspace"),
					"fields": fields,
				})
		page = self.paginate_queryset(out)
		if page is not None:
			return self.get_paginated_response(page)
		return Response(out)

class NameClassViewSet(PublicListMixin, viewsets.ModelViewSet):
	"""Дэвсгэр нэрийн ангилал (GEONAME_TYPES) удирдлага + GeoServer view автомат синк.

	Навч (3‑р түвшний: хүүхэдгүй БА өвөгтэй) ангилал нэмэх/засах/устгахад geoname
	workspace‑ийн geoname store дотор тухайн ангиллын геонэрүүдийг шүүсэн PG view
	үүсч/шинэчлэгдэж/устаж GeoServer‑т нийтлэгдэнэ. View ЗӨВХӨН навчид үүснэ;
	хүүхэдтэй (parent) зангилаанд үүсэхгүй. Логик нь node‑local: зөвхөн зассан/нэмсэн
	зангилаагаа л хөнддөг."""
	serializer_class = ConstantSerializer
	queryset = Constant.objects.filter(key='GEONAME_TYPES')
	filterset_class = GlobalFilter
	permission_classes = function_permission('nameclass')
	parser_classes = [JSONParser, MultiPartParser, FormParser]
	filter_backends = [DjangoFilterBackend, filters.OrderingFilter, filters.SearchFilter]
	ordering_fields = [f.name for f in Constant._meta.fields] + ['parent']

	@action(detail=True, methods=['get', 'put'], url_path='sld')
	def sld(self, request, *args, **kwargs):
		"""GeoStyler‑т зориулсан raw SLD унших/бичих. GET → тухайн навчийн view‑ийн
		одоогийн SLD‑г GeoServer‑ээс. PUT → засагдсан SLD‑г GeoServer‑т (REST)."""
		leaf = self.get_object()
		if not is_geoname_leaf(leaf):
			return Response({'detail': 'Зөвхөн 3‑р түвшний навчид style байна'}, status=400)
		ws = GEONAME_WS
		style_name = geoname_type_view_name(leaf)
		if request.method == 'GET':
			try:
				sld = _gs_style_read_sld(ws, style_name)
			except requests.RequestException as e:
				return Response({'detail': f'GeoServer SLD уншиж чадсангүй: {e}'}, status=502)
			# Локал symbols/<нэр> href‑ийг absolute media URL болгож editor/preview‑д
			sld = _absolutize_sld_symbols(sld, request)
			return Response({'sld': sld, 'style_name': style_name, 'ws': ws}, status=200)
		# PUT
		sld = request.data.get('sld')
		if not sld:
			return Response({'detail': 'sld хоосон'}, status=400)
		# Media symbol URL‑ийг GeoServer локал файл (relative href) болгож localize —
		# GeoServer remote URL татаж чаддаггүй тул заавал.
		sld = _localize_sld_symbols(sld)
		try:
			_gs_style_write_sld(ws, style_name, sld)
		except requests.RequestException as e:
			return Response({'detail': f'GeoServer‑т SLD хадгалж чадсангүй: {e}',
							 'body': getattr(e, 'response', None) and e.response.text}, status=502)
		# Style засагдсан тул GWC cache‑ийг truncate + seed (zoom 6‑10) — газрын
		# зураг шинэ style‑тай шинэ tile авна. Дэвсгэрт ажиллана, save‑ийг блоклохгүй.
		try:
			_gwc_seed(f"{ws}:{style_name}")
		except Exception:
			pass
		return Response({'style_name': style_name, 'ws': ws, 'saved': True}, status=200)

	@action(detail=True, methods=['post'], url_path='upload-symbol')
	def upload_symbol(self, request, *args, **kwargs):
		"""GeoStyler Icon source‑д зориулсан SVG upload. SVG‑г хэвээр: (1) backend
		media‑д хадгалж (GeoStyler PreviewMap browser‑д ачаална), (2) GeoServer‑ийн
		styles/symbols/ дотор REST resource API‑ээр байршуулна (бодит газрын зураг
		локал файлаар рендерлэнэ — GeoServer remote URL татаж чаддаггүй). Absolute
		media URL буцаана.

		Анхаар: GeoServer (Batik) нь зөвхөн ЦЭВЭР ВЕКТОР SVG‑г рендерлэнэ. Дотроо
		raster (PNG) base64‑ээр шигтгэсэн SVG рендерлэгдэхгүй."""
		import os
		import uuid
		from django.core.files.storage import default_storage
		from django.core.files.base import ContentFile

		f = request.FILES.get('file')
		if not f:
			return Response({'detail': 'Файл алга'}, status=400)
		ext = os.path.splitext(f.name)[1].lower()
		if ext != '.svg':
			return Response({'detail': 'Зөвхөн SVG файл оруулна'}, status=400)
		if f.size > 2 * 1024 * 1024:
			return Response({'detail': 'Файл 2MB‑аас их байна'}, status=400)

		data = f.read()
		basename = f"{uuid.uuid4().hex}.svg"
		saved = default_storage.save(f"geoname_symbols/{basename}", ContentFile(data))
		# GeoServer‑т нэн даруй REST‑ээр (рендерт бэлэн). Алдвал SLD хадгалах үед
		# _localize_sld_symbols дахин оролдоно.
		try:
			_gs_upload_symbol_bytes(GEONAME_WS, basename, data)
		except requests.RequestException:
			pass

		abs_url = request.build_absolute_uri(default_storage.url(saved))
		return Response({'url': abs_url, 'path': saved}, status=201)

	@action(detail=False, methods=['get'], url_path='style-fields')
	def style_fields(self, request):
		"""Style/rule филтерт ашиглах талбарууд — тухайн навч (layerId)‑ийн view‑ийн
		баганууд. PG view‑ийн бодит баганаас (information_schema) уншина; геометр
		(geoloc) баганыг хасна."""
		layer_id = request.query_params.get('layerId') or request.query_params.get('layer')
		leaf = Constant.objects.filter(id=layer_id, key='GEONAME_TYPES').first() if layer_id else None
		if not leaf:
			return Response({'results': []}, status=200)
		view_name = geoname_type_view_name(leaf)
		rows = []
		try:
			with connection.cursor() as cur:
				cur.execute(
					"SELECT column_name, data_type FROM information_schema.columns "
					"WHERE table_schema='public' AND table_name=%s ORDER BY ordinal_position",
					[view_name])
				for col, dtype in cur.fetchall():
					if col == 'geoloc':
						continue
					rows.append({'name': col, 'label': col, 'type': dtype})
		except Exception:
			import logging
			logging.getLogger(__name__).warning("style_fields introspect failed", exc_info=True)
		return Response({'results': rows}, status=200)

	@action(detail=False, methods=['post'], url_path='rebuild-names-layer')
	def rebuild_names_layer(self, request):
		"""'geoname:names' нэгдсэн давхаргыг (бүх per‑type view, таних тэмдэгтэй)
		одоогийн view‑ийн жагсаалтаар гараар дахин барина."""
		ensure_names_layergroup()
		return Response({'detail': 'Газар зүйн нэрийн нэгдсэн давхарга шинэчлэгдлээ'}, status=200)

	@action(detail=False, methods=['get'], url_path='tree')
	def tree(self, request):
		"""Нэрийн ангиллын мод — key‑ээр үндсэн төрөл, parent‑аар дэд ангилал.
		Мөр бүрт child_count. Level‑3 навч мөрт GeoServer‑т view нийтлэгдсэн
		эсэх (gs_exists) + view нэрийг (view_name) нэмж буцаана."""
		parent = request.query_params.get('parent', None)
		key = request.query_params.get('key', None)
		qs = Constant.objects.annotate(child_count=Count('children', distinct=True))
		if parent:
			qs = qs.filter(parent_id=parent)
		elif key:
			qs = qs.filter(key=key, parent__isnull=True)
		else:
			qs = qs.none()
		qs = qs.order_by('code', 'id')

		# Энэ түвшний хүүхдүүд level‑3 (навч) байж болох эсэх: parent нь өвөгтэй
		# (level‑2) бол түүний хүүхэд = level‑3. key‑ээр (язгуур) ачаалсан бол үгүй.
		parent_obj = Constant.objects.filter(id=parent).first() if parent else None
		level_has_leaves = bool(parent_obj and parent_obj.parent_id)
		published = self._published_featuretypes() if level_has_leaves else set()

		data = []
		for c in qs:
			row = {
				'id': c.id, 'name': c.name, 'key': c.key, 'code': c.code,
				'label': c.label, 'color': c.color, 'desc': c.desc,
				'parent': c.parent_id, 'child_count': c.child_count,
			}
			# Level‑3 навч (хүүхэдгүй) → GeoServer view байгаа эсэхийг шалгана
			if level_has_leaves and c.child_count == 0:
				vname = geoname_type_view_name(c)
				row['is_leaf'] = True
				row['view_name'] = vname
				row['gs_exists'] = vname in published
			else:
				row['is_leaf'] = False
				row['gs_exists'] = None
			data.append(row)
		return Response({"results": data}, status=200)

	def _published_featuretypes(self):
		"""geoname workspace‑ийн geoname store доторх нийтлэгдсэн featuretype нэрс."""
		rest, auth = _gs_rest_auth()
		try:
			r = requests.get(
				f"{rest}/workspaces/{GEONAME_WS}/datastores/{GEONAME_STORE}/featuretypes.json",
				auth=auth, timeout=8)
			if r.status_code == 200:
				return {f['name'] for f in
						(r.json().get('featureTypes') or {}).get('featureType') or []}
		except requests.RequestException:
			pass
		return set()

	# --- GeoServer view sync helpers (node‑local) ---
	def _sync_one_geoname(self, node, old_name=None):
		"""Тухайн зангилааны view‑г л зохицуулна. Навч бол үүсгэ/шинэчил,
		хүүхэдтэй бол өөрийнх нь хуучин view‑г устга."""
		try:
			if is_geoname_leaf(node):
				new_name = sync_geoname_type_view(node)
				if old_name and old_name != new_name:
					_drop_featuretype_and_view(old_name)
			else:
				_drop_featuretype_and_view(geoname_type_view_name(node))
				if old_name:
					_drop_featuretype_and_view(old_name)
		except Exception:
			import logging
			logging.getLogger(__name__).warning("geoname view sync failed", exc_info=True)

	def _drop_parent_view(self, parent):
		"""Хүүхэд нэмэгдсэн parent навч биш боллоо → parent‑ийн view‑г устга."""
		if not parent:
			return
		try:
			_drop_featuretype_and_view(geoname_type_view_name(parent))
		except Exception:
			pass

	def _is_active_flag(self):
		"""Хүсэлтийн is_active талбар → bool эсвэл None (ирээгүй бол)."""
		v = self.request.data.get('is_active', None)
		if v is None:
			return None
		if isinstance(v, bool):
			return v
		return str(v).strip().lower() in ('1', 'true', 'yes', 'on')

	def _apply_active(self, node, active, old_name=None):
		"""is_active сонголтоор GeoServer view‑г зохицуулна. active=True БА навч бол
		view үүсгэ/шинэчил; эс бөгөөс (False эсвэл навч биш) view‑г устга. Нэр
		өөрчлөгдсөн бол хуучин view‑г бас устга."""
		try:
			new_name = geoname_type_view_name(node)
			if old_name and old_name != new_name:
				_drop_featuretype_and_view(old_name)
			if active and is_geoname_leaf(node):
				sync_geoname_type_view(node)
			else:
				_drop_featuretype_and_view(new_name)
		except Exception:
			import logging
			logging.getLogger(__name__).warning("geoname view apply_active failed", exc_info=True)

	def perform_create(self, serializer):
		parent = serializer.validated_data.get('parent')
		instance = serializer.save(key='GEONAME_TYPES')
		active = self._is_active_flag()
		# is_active сонголтоор view үүсгэ/устга; ирээгүй бол хуучин зан (навч→синк)
		if active is None:
			self._sync_one_geoname(instance)
		else:
			self._apply_active(instance, active)
		# parent нь навч биш боллоо → түүний view устна
		self._drop_parent_view(parent)

	def perform_update(self, serializer):
		node = serializer.instance
		old_name = geoname_type_view_name(node) if node else None  # хуучин код‑оор
		instance = serializer.save()
		active = self._is_active_flag()
		if active is None:
			self._sync_one_geoname(instance, old_name=old_name)
		else:
			self._apply_active(instance, active, old_name=old_name)

	def perform_destroy(self, instance):
		# Устгахаас өмнө холбоотой навч view нэрс + parent‑ийг цуглуулна (CASCADE‑д устахаас)
		names = [geoname_type_view_name(c) for c in geoname_leaf_descendants(instance)]
		names.append(geoname_type_view_name(instance))  # өөрийн (stale) view ч устга
		parent = instance.parent
		super().perform_destroy(instance)
		try:
			for n in names:
				_drop_featuretype_and_view(n)
			# parent сүүлийн хүүхдээ алдаж навч болсон бол view авна
			if parent:
				self._sync_one_geoname(parent)
		except Exception:
			import logging
			logging.getLogger(__name__).warning("geoname view drop failed", exc_info=True)


class StoreViewSet(PublicListMixin, viewsets.ModelViewSet):
	serializer_class =StoreSerializer
	queryset=Constant.objects.filter(key='STORES')
	filterset_class = GlobalFilter
	permission_classes = [IsAuthenticated]
	filter_backends = [DjangoFilterBackend, filters.OrderingFilter, filters.SearchFilter]
	parser_classes = [JSONParser, MultiPartParser, FormParser]
	ordering_fields = [f.name for f in Constant._meta.fields]
	@action(detail=False, methods=['get'], url_path='stores')
	def stores(self, request, *args, **kwargs):
		wsId=request.query_params.get('wsId')
		ws=workspace.objects.get(id=wsId)
		feature_type_name = layer.table.desc
		workspace = layer.store.parent.name
		store_name = layer.store.name
		attrs=geo.get_featurestore(store_name,workspace)
		return Response({'results': attrs}, status=200)
	@transaction.atomic
	def create(self, request, *args, **kwargs):
		ser=self.get_serializer(data=request.data)
		ser.is_valid(raise_exception=True)
		instance=ser.save(key='STORES')
		try:
			geo.create_featurestore(store_name=instance.name, workspace=instance.parent.name, db=settings.DATABASE_NAME,overwrite=False, host=settings.DATABASE_HOST,port=settings.DATABASE_PORT, pg_user=settings.DATABASE_USER, pg_password=settings.DATABASE_PASSWORD)
		except Exception as e:
			return Response({'result': f'Геосерверт {e} алдаа гарлаа.'}, status=400)
		return Response({'results': ser.data}, status=200)
	@transaction.atomic
	def destroy(self, request, *args, **kwargs):
		instance = self.get_object()
		try:
			geo.delete_featurestore(featurestore_name=instance.name, workspace=instance.parent.name)
		except Exception as e:
			return Response({'result': f'Геосерверт {e} алдаа гарлаа.'}, status=400)
		instance.delete()
		return Response(status=204)

def _sld_num(v):
	try:
		return float(v)
	except (TypeError, ValueError):
		return None


def _parse_sld_rules(sld_xml):
	"""SLD XML‑ээс <Rule>‑үүдийг уншиж энгийн dict жагсаалт болгоно (namespace‑agnostic).
	GeoServer‑т default style‑ийг DB StyleRule болгон импортлоход хэрэглэнэ."""
	import xml.etree.ElementTree as ET
	def lname(t):
		return t.rsplit('}', 1)[-1]
	try:
		root = ET.fromstring(sld_xml)
	except Exception:
		return []
	out = []
	for rule_el in root.iter():
		if lname(rule_el.tag) != 'Rule':
			continue
		r = {'name': None, 'symbolizer': None, 'fill_color': None, 'fill_opacity': None,
			 'stroke_color': None, 'stroke_width': None, 'stroke_opacity': None,
			 'stroke_linecap': None, 'stroke_linejoin': None, 'size': None}
		for ch in rule_el.iter():
			lt = lname(ch.tag)
			if lt == 'Name' and ch is not rule_el and r['name'] is None and ch.text:
				r['name'] = ch.text.strip()
			elif lt == 'PointSymbolizer':
				r['symbolizer'] = 'point'
			elif lt == 'LineSymbolizer':
				r['symbolizer'] = 'line'
			elif lt == 'PolygonSymbolizer':
				r['symbolizer'] = 'polygon'
			elif lt == 'TextSymbolizer' and not r['symbolizer']:
				r['symbolizer'] = 'text'
			elif lt == 'CssParameter':
				nm, val = ch.get('name'), (ch.text or '').strip()
				if nm == 'fill':
					r['fill_color'] = val
				elif nm == 'fill-opacity':
					r['fill_opacity'] = _sld_num(val)
				elif nm == 'stroke':
					r['stroke_color'] = val
				elif nm == 'stroke-width':
					r['stroke_width'] = _sld_num(val)
				elif nm == 'stroke-opacity':
					r['stroke_opacity'] = _sld_num(val)
				elif nm == 'stroke-linecap':
					r['stroke_linecap'] = val
				elif nm == 'stroke-linejoin':
					r['stroke_linejoin'] = val
			elif lt == 'Size' and ch.text:
				r['size'] = _sld_num(ch.text.strip())
		out.append(r)
	return out


class StyleRuleViewSet(viewsets.ModelViewSet):
	queryset = (
		StyleRule.objects
		.select_related("layer")
		.all()
	)
	serializer_class = StyleRuleSerializer
	filterset_class = GlobalFilter
	permission_classes = [IsAuthenticated]
	filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
	parser_classes = [JSONParser, MultiPartParser, FormParser]
	ordering_fields = [f.name for f in StyleRule._meta.fields] + ["layer_id"]
	def get_queryset(self):
		qs = super().get_queryset()
		# layer нь nameclass leaf (Constant) id — view‑ийн rule‑уудыг шүүнэ.
		layer_id = self.request.query_params.get("layer") or self.request.query_params.get("style")
		return qs.filter(layer_id=layer_id) if layer_id else qs

	@action(detail=False, methods=['post'], url_path='import-default')
	def import_default(self, request):
		"""Тухайн layer (nameclass leaf)‑д DB StyleRule байхгүй бол GeoServer дээрх
		одоогийн style (B…view)‑ийн SLD‑г уншиж, дүрмийг нь StyleRule болгон импортлоно.
		Импортлосон дүрмийг SLD дотор rule.id‑ээр дахин нэрлэж (default→id) бичнэ —
		ингэснээр цаашид засагчаас зөв засагдана."""
		layer_id = request.data.get('layer') or request.query_params.get('layer')
		leaf = Constant.objects.filter(id=layer_id, key='GEONAME_TYPES').first() if layer_id else None
		if not leaf:
			return Response({'detail': 'layer буруу'}, status=400)
		if StyleRule.objects.filter(layer=leaf).exists():
			return Response({'detail': 'Дүрэм аль хэдийн байна', 'imported': 0}, status=200)
		ws = GEONAME_WS
		style_name = geoname_type_view_name(leaf)
		try:
			sld_xml = _gs_style_read_sld(ws, style_name)
		except requests.RequestException as e:
			return Response({'detail': f'GeoServer SLD уншиж чадсангүй: {e}'}, status=502)
		parsed = _parse_sld_rules(sld_xml)
		if not parsed:
			return Response({'detail': 'SLD дотор дүрэм олдсонгүй', 'imported': 0}, status=200)
		geom_default = GEOM_STYLE.get((leaf.desc or '').strip(), 'polygon')
		new_sld, created = sld_xml, []
		for p in parsed:
			sym = p.get('symbolizer') or geom_default
			if sym == 'text':
				sym = geom_default  # текст‑only default‑ийг геометр болгоно
			rule = StyleRule.objects.create(
				layer=leaf, symbolizer=sym, render_mode='symbol', filters=[],
				fill_color=p.get('fill_color'), fill_opacity=p.get('fill_opacity'),
				stroke_color=p.get('stroke_color'), stroke_width=p.get('stroke_width'),
				stroke_opacity=p.get('stroke_opacity'),
				stroke_linecap=p.get('stroke_linecap') or '',
				stroke_linejoin=p.get('stroke_linejoin') or '',
				size=p.get('size'),
			)
			created.append(rule.id)
			# SLD дотор хуучин нэртэй дүрмийг устгаад rule.id‑ээр дахин бичнэ
			if p.get('name'):
				try:
					new_sld, _ = delete_rule_in_sld_xml(new_sld, rule_name=p['name'], prune_empty=True)
				except Exception:
					pass
			new_sld = update_rule_in_sld_xml_safe(
				new_sld, rule_name=rule.id, filters=[], symbolizer=sym,
				fill_color=rule.fill_color, fill_opacity=rule.fill_opacity,
				stroke_color=rule.stroke_color, stroke_width=rule.stroke_width,
				stroke_opacity=rule.stroke_opacity if rule.stroke_opacity is not None else 0.7,
				stroke_linecap=rule.stroke_linecap, stroke_linejoin=rule.stroke_linejoin,
				size=rule.size or 5, rotation=0, is_with_text=False,
			)
		try:
			_gs_style_write_sld(ws, style_name, new_sld)
		except requests.RequestException as e:
			return Response({'detail': f'SLD хадгалж чадсангүй: {e}', 'imported': len(created)}, status=502)
		return Response({'imported': len(created), 'rules': created}, status=200)

	@transaction.atomic
	def create(self, request, *args, **kwargs):
		ser = self.get_serializer(data=request.data)
		ser.is_valid(raise_exception=True)
		rule = ser.save()
		# layer = nameclass leaf (Constant). Геометрийг навчийн desc‑ээс авна.
		leaf = rule.layer
		rule.symbolizer = GEOM_STYLE.get((leaf.desc or '').strip(), 'polygon')
		rule.save()
		ws = GEONAME_WS
		style_name = geoname_type_view_name(leaf)

		# SLD‑г GeoServer‑ээс REST‑ээр уншина (локал файл системгүй)
		try:
			sld_xml = _gs_style_read_sld(ws, style_name)
		except requests.RequestException as e:
			return Response({"error": "GeoServer‑ээс SLD уншиж чадсангүй",
							 "detail": str(e)}, status=502)

		# --- icon файлыг GeoServer styles/symbols руу REST‑ээр байршуулна ---
		icon_abs = None
		if rule.icon and getattr(rule.icon, "path", None):
			try:
				icon_abs = _gs_upload_style_symbol(
					ws, os.path.basename(rule.icon.name), rule.icon.path)
			except Exception as e:
				print(f"[WARN] icon upload failed: {e}")
		def _filters_as_list_local(filters_json):
			try:
				if isinstance(filters_json, list):
					return filters_json
				return filters_json or []
			except Exception as exc:
				import logging
				logging.getLogger(__name__).warning("_filters_as_list_local failed", exc_info=exc)
				return []
		filters_payload = _filters_as_list_local(rule.filters)
		prop_name = lit_val = None
		for it in filters_payload or []:
			if (it.get("operator") or "").lower() == "eq":
				prop_name = it.get("field")
				lit_val = it.get("value")
				break
		if rule.render_mode == "text":
			new_xml = update_rule_in_sld_xml_safe(
				sld_xml,
				rule_name=rule.id,
				filters=filters_payload,
				symbolizer="text",
				# --- Text styles ---
				is_with_text=True,
				text_field=rule.text_field,
				text_size=rule.text_size,
				text_color=rule.text_color,
				text_font_family=rule.text_font_family,
				text_font_style=rule.text_font_style,
				text_font_weight=rule.text_font_weight,
				text_halo_color=rule.text_halo_color,
				text_halo_radius=rule.text_halo_radius,
				text_halo_opacity=rule.text_halo_opacity,
				text_anchor=rule.text_anchor,
				text_displacement_x=rule.text_displacement_x,
				text_displacement_y=rule.text_displacement_y,
				text_rotation=rule.text_rotation,
				vendor_options=rule.vendor_options,
				# --- Scale ---
				max_scale=rule.max_scale_denom,
				min_scale=rule.min_scale_denom,
			)
			new_xml = _strip_geometry_symbolizers(new_xml, rule_name=rule.id)
		elif rule.render_mode == "symbol":
			new_xml = update_rule_in_sld_xml_safe(
				sld_xml,
				rule_name=rule.id,
				property_name=prop_name,
				literal_value=lit_val,
				filters=filters_payload,
				symbolizer=rule.symbolizer,  # point|line|polygon|raster
				# --- Geometry styles ---
				fill_color=rule.fill_color,
				fill_opacity=rule.fill_opacity,
				stroke_color=rule.stroke_color,
				stroke_width=rule.stroke_width,
				stroke_opacity=rule.stroke_opacity if rule.stroke_opacity is not None else 0.7,
				stroke_dasharray=rule.stroke_dasharray,
				stroke_linecap=rule.stroke_linecap,
				stroke_linejoin=rule.stroke_linejoin,
				icon=icon_abs,
				size=rule.size or 5,
				rotation=rule.rotation or 0,
				# --- Text-гүй ---
				is_with_text=False,
				# --- Scale ---
				max_scale=rule.max_scale_denom,
				min_scale=rule.min_scale_denom,
			)

		# === 3) BOTH (GEOMETRY + SEPARATE TEXT RULE) ===
		else:
			# a) Geometry rule
			new_xml = update_rule_in_sld_xml_safe(
				sld_xml,
				rule_name=rule.id,
				property_name=prop_name,
				literal_value=lit_val,
				filters=filters_payload,
				symbolizer=rule.symbolizer,
				# --- Geometry styles ---
				fill_color=rule.fill_color,
				fill_opacity=rule.fill_opacity,
				stroke_color=rule.stroke_color,
				stroke_width=rule.stroke_width,
				stroke_opacity=rule.stroke_opacity if rule.stroke_opacity is not None else 0.7,
				stroke_dasharray=rule.stroke_dasharray,
				stroke_linecap=rule.stroke_linecap,
				stroke_linejoin=rule.stroke_linejoin,
				icon=icon_abs,
				size=rule.size or 5,
				rotation=rule.rotation or 0,
				# --- Scale ---
				max_scale=rule.max_scale_denom,
				min_scale=rule.min_scale_denom,
			)
			# b) Label rule (separate)
			new_xml = update_rule_in_sld_xml_safe(
				new_xml,
				rule_name=rule.id,
				filters=filters_payload,
				symbolizer="text",
				is_with_text=True,
				text_field=rule.text_field,
				text_size=rule.text_size,
				text_color=rule.text_color,
				text_font_family=rule.text_font_family,
				text_font_style=rule.text_font_style,
				text_font_weight=rule.text_font_weight,
				text_halo_color=rule.text_halo_color,
				text_halo_radius=rule.text_halo_radius,
				text_halo_opacity=rule.text_halo_opacity,
				text_anchor=rule.text_anchor,
				text_displacement_x=rule.text_displacement_x,
				text_displacement_y=rule.text_displacement_y,
				text_rotation=rule.text_rotation,
				vendor_options=rule.vendor_options,
				max_scale=rule.max_scale_denom,
				min_scale=rule.min_scale_denom,
			)
		# Засагдсан SLD‑г GeoServer‑т REST‑ээр PUT хийнэ (reload шаардахгүй)
		try:
			_gs_style_write_sld(ws, style_name, new_xml)
		except requests.RequestException as e:
			return Response(
				{
					"error": "GeoServer‑т SLD хадгалж чадсангүй",
					"detail": str(e),
					"body": getattr(e, "response", None) and e.response.text,
				},
				status=502,
			)
		return Response(self.get_serializer(rule).data, status=status.HTTP_200_OK)
	
	@transaction.atomic
	def update(self, request, *args, **kwargs):
		partial = kwargs.pop("partial", True)  # DRF partial_update-с ирвэл True
		rule_obj = self.get_object()
		ser = self.get_serializer(rule_obj, data=request.data, partial=partial)
		ser.is_valid(raise_exception=True)
		rule = ser.save()
		# layer = nameclass leaf (Constant)
		leaf = rule.layer
		ws = GEONAME_WS
		style_name = geoname_type_view_name(leaf)
		# SLD‑г GeoServer‑ээс REST‑ээр уншина (локал файл системгүй)
		try:
			sld_xml = _gs_style_read_sld(ws, style_name)
		except requests.RequestException as e:
			return Response({"error": "GeoServer‑ээс SLD уншиж чадсангүй",
							 "detail": str(e)}, status=502)
		# --- icon файлыг GeoServer styles/symbols руу REST‑ээр байршуулна ---
		icon_abs = None
		if rule.icon and getattr(rule.icon, "path", None):
			try:
				icon_abs = _gs_upload_style_symbol(
					ws, os.path.basename(rule.icon.name), rule.icon.path)
			except Exception as e:
				print(f"[WARN] icon upload failed: {e}")

		# --- фильтрийг JSON -> list[dict] болгоно ---
		def _filters_as_list_local(filters_json):
			try:
				if isinstance(filters_json, list):
					return filters_json
				# DB JSONField байвал шууд буцаана
				return filters_json or []
			except Exception:
				return []

		filters_payload = _filters_as_list_local(rule.filters)
		prop_name = lit_val = None
		for it in filters_payload or []:
			if (it.get("operator") or "").lower() == "eq":
				prop_name = it.get("field")
				lit_val = it.get("value")
				break
		if rule.render_mode == "text":
			sld_xml, removed = delete_rule_in_sld_xml(
				sld_xml,
				rule_name=str(rule.id).strip(),  # SLD дээр <sld:Name> нь rule.id байгааг та хэлсэн
				prune_empty=True,
			)
			new_xml = update_rule_in_sld_xml_safe(
				sld_xml,
				rule_name=rule.id,
				filters=filters_payload,
				symbolizer="text",
				# --- Text styles ---
				is_with_text=True,
				text_field=rule.text_field,
				text_size=rule.text_size,
				text_color=rule.text_color,
				text_font_family=rule.text_font_family,
				text_font_style=rule.text_font_style,
				text_font_weight=rule.text_font_weight,
				text_halo_color=rule.text_halo_color,
				text_halo_radius=rule.text_halo_radius,
				text_halo_opacity=rule.text_halo_opacity,
				text_anchor=rule.text_anchor,
				text_displacement_x=rule.text_displacement_x,
				text_displacement_y=rule.text_displacement_y,
				text_rotation=rule.text_rotation,
				vendor_options=rule.vendor_options,
				# --- Scale ---
				max_scale=rule.max_scale_denom,
				min_scale=rule.min_scale_denom,
			)
			# Геометр симбол байж магадгүй тул цэвэрлээд хадгална
			# new_xml = _strip_geometry_symbolizers(new_xml, rule_name=rule.id)

		# === 2) SYMBOL ONLY ===
		elif rule.render_mode == "symbol":
			new_xml = update_rule_in_sld_xml_safe(
				sld_xml,
				rule_name=rule.id,
				property_name=prop_name,
				literal_value=lit_val,
				filters=filters_payload,
				symbolizer=rule.symbolizer,  # point|line|polygon|raster
				# --- Geometry styles ---
				fill_color=rule.fill_color,
				fill_opacity=rule.fill_opacity,
				stroke_color=rule.stroke_color,
				stroke_width=rule.stroke_width,
				stroke_opacity=rule.stroke_opacity if rule.stroke_opacity is not None else 0.7,
				stroke_dasharray=rule.stroke_dasharray,
				stroke_linecap=rule.stroke_linecap,
				stroke_linejoin=rule.stroke_linejoin,
				icon=icon_abs,
				size=rule.size or 5,
				rotation=rule.rotation or 0,
				# --- Text-гүй ---
				is_with_text=False,
				# --- Scale ---
				max_scale=rule.max_scale_denom,
				min_scale=rule.min_scale_denom,
			)

		# === 3) BOTH (GEOMETRY + SEPARATE TEXT RULE) ===
		else:
			# a) Geometry rule
			new_xml = update_rule_in_sld_xml_safe(
				sld_xml,
				rule_name=rule.id,
				property_name=prop_name,
				literal_value=lit_val,
				filters=filters_payload,
				symbolizer=rule.symbolizer,
				# --- Geometry styles ---
				fill_color=rule.fill_color,
				fill_opacity=rule.fill_opacity,
				stroke_color=rule.stroke_color,
				stroke_width=rule.stroke_width,
				stroke_opacity=rule.stroke_opacity if rule.stroke_opacity is not None else 0.7,
				stroke_dasharray=rule.stroke_dasharray,
				stroke_linecap=rule.stroke_linecap,
				stroke_linejoin=rule.stroke_linejoin,
				icon=icon_abs,
				size=rule.size or 5,
				rotation=rule.rotation or 0,
				# --- Scale ---
				max_scale=rule.max_scale_denom,
				min_scale=rule.min_scale_denom,
			)
			# b) Label rule (separate)
			new_xml = update_rule_in_sld_xml_safe(
				new_xml,
				rule_name=rule.id,
				filters=filters_payload,
				symbolizer="text",
				is_with_text=True,
				text_field=rule.text_field,
				text_size=rule.text_size,
				text_color=rule.text_color,
				text_font_family=rule.text_font_family,
				text_font_style=rule.text_font_style,
				text_font_weight=rule.text_font_weight,
				text_halo_color=rule.text_halo_color,
				text_halo_radius=rule.text_halo_radius,
				text_halo_opacity=rule.text_halo_opacity,
				text_anchor=rule.text_anchor,
				text_displacement_x=rule.text_displacement_x,
				text_displacement_y=rule.text_displacement_y,
				text_rotation=rule.text_rotation,
				vendor_options=rule.vendor_options,
				max_scale=rule.max_scale_denom,
				min_scale=rule.min_scale_denom,
			)

		# --- Засагдсан SLD‑г GeoServer‑т REST‑ээр хадгалах ---
		try:
			_gs_style_write_sld(ws, style_name, new_xml)
		except requests.RequestException as e:
			return Response({"error": "GeoServer‑т SLD хадгалж чадсангүй",
							 "detail": str(e),
							 "body": getattr(e, "response", None) and e.response.text},
							status=502)

		return Response(self.get_serializer(rule).data, status=status.HTTP_200_OK)

	@transaction.atomic
	def destroy(self, request, *args, **kwargs):
		rule = self.get_object()
		# layer = nameclass leaf (Constant)
		leaf = rule.layer
		ws = GEONAME_WS
		style_name = geoname_type_view_name(leaf)
		removed = 0
		# SLD‑г GeoServer‑ээс REST‑ээр уншиж, rule‑г хасаад буцаан PUT хийнэ
		try:
			sld_xml = _gs_style_read_sld(ws, style_name)
			new_xml, removed = delete_rule_in_sld_xml(
				sld_xml,
				rule_name=str(rule.id).strip(),  # SLD дээр <sld:Name> нь rule.id байгааг та хэлсэн
				prune_empty=True,
			)
			_gs_style_write_sld(ws, style_name, new_xml)
		except requests.RequestException as exc:
			import logging
			logging.getLogger(__name__).warning(
				"GeoServer SLD update failed during StyleRule destroy", exc_info=exc)
		rule.delete()
		return Response({"result": "success", "removed": removed}, status=204)
		
class LayerGroupViewSet(viewsets.ModelViewSet):
	queryset = (
		LayerGroup.objects
		.prefetch_related("items")
		.all()
	)
	serializer_class = LayerGroupSerializer
	permission_classes = [IsAuthenticated]
	filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
	filterset_class = GlobalFilter
	parser_classes = [JSONParser, MultiPartParser, FormParser]
	ordering_fields = [f.name for f in LayerGroup._meta.fields]
	@transaction.atomic
	def create(self, request, *args, **kwargs):
		data = request.data.copy()
		items = data.get("items", None)
		if isinstance(items, str):
			import json
			try:
				data["items"] = json.loads(items)
			except json.JSONDecodeError:
				data["items"] = [] 
		serializer = self.get_serializer(data=data)
		serializer.is_valid(raise_exception=True)
		self.perform_create(serializer)
		return Response(serializer.data, status=status.HTTP_201_CREATED)

	@transaction.atomic
	def update(self, request, *args, **kwargs):
		partial = kwargs.pop('partial', False)
		instance = self.get_object()
		data = request.data.copy()
		items = data.get("items", None)
		if isinstance(items, str):
			import json
			try:
				data["items"] = json.loads(items)
			except json.JSONDecodeError:
				pass
		serializer = self.get_serializer(instance, data=data, partial=partial)
		serializer.is_valid(raise_exception=True)
		self.perform_update(serializer)
		workspace=Constant.objects.filter(key='WORKSPACES').first()
		layers=instance.items.all().values_list('layer__name',flat=True)
		try:
			try:
				geo.delete_layergroup(layergroup_name=instance.name, workspace=workspace.name)
			except Exception as e:
				import logging
				logging.getLogger(__name__).warning("Failed to delete layergroup in GeoServer (update)", exc_info=e)
			groups = geo.create_layergroup(name=instance.name, layers=list(layers), title=instance.name, workspace=workspace.name)
		except Exception as e:
			return Response({"result": str(e)}, status=500)
		return Response(serializer.data, status=status.HTTP_200_OK)
	@transaction.atomic
	def destroy(self, request, *args, **kwargs):
		instance = self.get_object()
		workspace=Constant.objects.filter(key='WORKSPACES').first()
		try:
			geo.delete_layergroup(layergroup_name=instance.name, workspace=workspace.name)
		except Exception as e:
			import logging
			logging.getLogger(__name__).warning("Failed to delete layergroup in GeoServer (destroy)", exc_info=e)
		instance.delete()
		return Response(status=status.HTTP_204_NO_CONTENT)

class LayerGroupItemViewSet(viewsets.ModelViewSet):
	permission_classes = [IsAuthenticated]
	queryset = (
		LayerGroupItem.objects
		.select_related("group", "feature", "style", "rule")
		.all()
	)
	serializer_class = LayerGroupItemSerializer
	filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
	filterset_class = GlobalFilter
	parser_classes = [JSONParser, MultiPartParser, FormParser]
	ordering_fields = [f.name for f in LayerGroup._meta.fields]
