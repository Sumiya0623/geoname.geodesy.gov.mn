import re
import os
import requests
from requests.auth import HTTPBasicAuth
from django.db import transaction, connection
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
from django.db.models import Count
from portal.auth import function_permission
from rest_framework.decorators import action
from portal.utils.rulestyle import update_rule_in_sld_xml_safe,delete_rule_in_sld_xml, _strip_geometry_symbolizers

from geo.Geoserver import Geoserver
geo = Geoserver(f'{settings.GEOSERVER_URL}', username=settings.GEOSERVER_USER, password=settings.GEOSERVER_PASSWORD)
# from geoserver.catalog import Catalog
# cat = Catalog(f'http://local.nextgis.mn:8080/geoserver/rest/', username=settings.GEOSERVER_USER, password=settings.GEOSERVER_PASSWORD)
from .default_style import create_default_style_and_assign

from core.models import (
	Constant,
	StyleRule,
	LayerGroupItem,
	LayerGroup,
	BaseMapLayer,
)

from core.userapiview import (
	ConstantSerializer,
)
from .serializer import (
	WorkspaceSerializer,
	StoreSerializer,
	StyleRuleSerializer,
	LayerGroupSerializer,
	LayerGroupItemSerializer,
	BaseMapLayerSerializer,
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


def _localize_sld_symbols(sld, ws=None):
    """SLD доторх absolute media symbol URL бүрийг GeoServer‑ийн локал
    styles/symbols/ рүү REST‑ээр байршуулж, href‑ийг relative 'symbols/<нэр>'
    болгож rewrite хийнэ. `ws` нь тухайн style байрлах workspace (symbol нь ижил
    ws‑д байх ёстой — эс бол GeoServer рендерт олдохгүй); default GEONAME_WS."""
    import os
    from django.conf import settings as _st
    ws = ws or GEONAME_WS
    for basename in set(_MEDIA_SYM_RE.findall(sld)):
        src = os.path.join(_st.MEDIA_ROOT, 'geoname_symbols', basename)
        if os.path.exists(src):
            try:
                with open(src, 'rb') as fh:
                    _gs_upload_symbol_bytes(ws, basename, fh.read())
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


def _gwc_masstruncate(layer_full):
    """GWC‑д кэшлэгдсэн layer/layergroup‑ийн БҮХ tile‑ийг устгана (mass truncate).
    Style засагдсаны дараа хуучин tile арилахад найдвартай."""
    from django.conf import settings as _st
    auth = HTTPBasicAuth(_st.GEOSERVER_USER, _st.GEOSERVER_PASSWORD)
    body = f'<truncateLayer><layerName>{layer_full}</layerName></truncateLayer>'
    try:
        requests.post(f"{_st.GEOSERVER_URL}/gwc/rest/masstruncate", data=body,
                      headers={'Content-Type': 'text/xml'}, auth=auth, timeout=30)
    except requests.RequestException:
        pass


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
        "              FROM core_legalorder_names go WHERE go.geoname_id = g.id), '[]'::json) AS orders,\n"
        # name_spaced — нэрийг шугамын урт/тэмдэгтийн тооны харьцаагаар үсэг хооронд
        # зайлуулж бэлдсэн багана. GeoServer‑ийн charSpacing нь илэрхийлэл авдаггүй
        # (зөвхөн статик тоо) тул уртынхаа дагуу дүүрэх labelийг өгөгдөл дээр бэлднэ.
        "    CASE WHEN g.name IS NULL OR char_length(g.name) < 2 THEN g.name\n"
        "         ELSE array_to_string(regexp_split_to_array(g.name, ''),\n"
        "              repeat(' ', GREATEST(1, LEAST(5,\n"
        "                round((ST_Length(g.geoloc) / NULLIF(char_length(g.name),0)) * 900)::int)))) END AS name_spaced\n"
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
    g.type_id,
    t.parent_id AS type_l2, t2.parent_id AS type_l1,
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
        created = False
        with connection.cursor() as c:
            c.execute("SELECT to_regclass('public.geoname_view')")
            if not c.fetchone()[0]:
                c.execute('CREATE VIEW public."%s" AS %s' % (GEONAME_SEARCH_VIEW, _GEONAME_SEARCH_SQL))
                created = True
        if created:
            _ensure_geoname_store()
            _publish_or_recalc(GEONAME_SEARCH_VIEW, 'Газар зүйн нэр (хайлт)')
        # geoname_types style + geoname_view‑ийн default болгоно (ганц view архитектур)
        ensure_geoname_type_style()
    except Exception:
        import logging
        logging.getLogger(__name__).warning("ensure_geoname_search_view failed", exc_info=True)


RECOUNT_VIEW = 'recount_view'
# Дахин тооллого (ReCount.loc) — геонэрийн type‑той join хийсэн view. geoname_view‑тэй
# ижил баганатай (type, type_l1/l2) тул ижил style (type symbol)‑оор зурагдана.
# project_id баганаар CQL‑ээр тухайн төслөөр шүүнэ.
_RECOUNT_VIEW_SQL = """SELECT r.id, r.project_id, r.draft,
    r.name_id AS name_id,
    COALESCE(r.loc, g.geoloc) AS geoloc,
    GeometryType(COALESCE(r.loc, g.geoloc)) AS geom_type,
    COALESCE(g.type_id, r.type_id) AS type_id,
    t.parent_id AS type_l2, t2.parent_id AS type_l1,
    json_build_array(t.parent_id, COALESCE(g.type_id, r.type_id)) AS type,
    CASE WHEN g.type_id IS NOT NULL THEN 'name' ELSE 'draft' END AS type_src,
    CASE WHEN g.id IS NOT NULL THEN 'name' ELSE 'geom' END AS unit_src,
    COALESCE(g.name, r.draft) AS name,
    g.number AS number,
    COALESCE(g.is_border, false) AS is_border,
    COALESCE(
        CASE WHEN g.id IS NOT NULL THEN
            ' '||(SELECT string_agg(gu.adminunit_id::text,' ')
                  FROM core_geoname_unit gu WHERE gu.geoname_id=g.id)||' '
        ELSE
            -- GeoName‑гүй (draft) тодруулалт — зурсан байрлалаар нь ЗЗ нэгжийг
            -- орон зайгаар тодорхойлно (эс бөгөөс нэгжийн шүүлтэд алдагдана)
            ' '||(SELECT string_agg(au.id::text,' ') FROM core_adminunit au
                  WHERE au.geom IS NOT NULL AND ST_Intersects(au.geom, r.loc))||' '
        END, '') AS unit_ids,
    COALESCE((SELECT string_agg(n.nomek,' ') FROM core_geoname_nomek gn JOIN core_nomek n ON n.id=gn.nomek_id WHERE gn.geoname_id=g.id),'') AS nomek_codes,
    COALESCE(
        ' '||(SELECT string_agg(rs.constant_id::text,' ') FROM core_recount_statuses rs WHERE rs.recount_id=r.id)||' ',
        ''
    ) AS status_ids
FROM core_recount r
LEFT JOIN core_geoname g  ON g.id = r.name_id
LEFT JOIN core_constant t  ON t.id = COALESCE(g.type_id, r.type_id)
LEFT JOIN core_constant t2 ON t2.id = t.parent_id
WHERE COALESCE(r.loc, g.geoloc) IS NOT NULL
  AND NOT ST_IsEmpty(COALESCE(r.loc, g.geoloc))"""


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

# --- Нэгдсэн geoname_types style дотор НЭГ type_id‑ийн rule‑уудыг ялгах/нэгтгэх ---
# (per-type view/style хассан тул style засвар нь нэгдсэн style дээр type_id‑ээр).
_SLD_NS = 'http://www.opengis.net/sld'
_OGC_NS = 'http://www.opengis.net/ogc'
_XLINK_NS = 'http://www.w3.org/1999/xlink'


def _rule_type_ids(rule):
    """rule‑ийн Filter доторх type_id литералуудыг буцаана."""
    ids = []
    for eq in rule.iter(f'{{{_OGC_NS}}}PropertyIsEqualTo'):
        pn = eq.find(f'{{{_OGC_NS}}}PropertyName')
        li = eq.find(f'{{{_OGC_NS}}}Literal')
        if pn is not None and li is not None and (pn.text or '').strip() == 'type_id':
            ids.append((li.text or '').strip())
    return ids


def _make_type_eq(tid):
    import xml.etree.ElementTree as ET
    eq = ET.Element(f'{{{_OGC_NS}}}PropertyIsEqualTo')
    ET.SubElement(eq, f'{{{_OGC_NS}}}PropertyName').text = 'type_id'
    ET.SubElement(eq, f'{{{_OGC_NS}}}Literal').text = str(tid)
    return eq


def _remove_type_eq(rule, tid):
    """rule‑ийн Filter‑ээс type_id==tid нөхцөлийг хасна (Or дотор 1 үлдвэл хялбарчилна).
    SLD 1.0‑д Filter нь OGC namespace (ogc:Filter) — _SLD_NS БИШ."""
    flt = rule.find(f'{{{_OGC_NS}}}Filter')
    if flt is None:
        return
    for parent in list(flt.iter()):
        for eq in list(parent.findall(f'{{{_OGC_NS}}}PropertyIsEqualTo')):
            pn = eq.find(f'{{{_OGC_NS}}}PropertyName')
            li = eq.find(f'{{{_OGC_NS}}}Literal')
            if (pn is not None and li is not None and (pn.text or '').strip() == 'type_id'
                    and (li.text or '').strip() == str(tid)):
                parent.remove(eq)
    # Or дотор ганц operand үлдвэл Or‑г түүгээрээ орлуулна (SLD Or ≥2 шаарддаг)
    orel = flt.find(f'{{{_OGC_NS}}}Or')
    if orel is not None:
        kids = list(orel)
        if len(kids) == 1:
            flt.remove(orel)
            flt.append(kids[0])


_SE_NS = 'http://www.opengis.net/se'  # SLD 1.1 Symbology Encoding namespace


def _normalize_rule_to_sld10(rule):
	"""SLD 1.1 (se:) rule‑ийг SLD 1.0 (sld:) болгож хөрвүүлнэ — geoname_types нь 1.0
	тул нэгтгэхэд таарна. se:→sld:, SvgParameter→CssParameter. ogc: (filter) хэвээр."""
	import xml.etree.ElementTree as ET
	for el in rule.iter():
		if el.tag.startswith(f'{{{_SE_NS}}}'):
			local = el.tag.split('}', 1)[1]
			if local == 'SvgParameter':
				local = 'CssParameter'
			el.tag = f'{{{_SLD_NS}}}{local}'
	# LinePlacement (GeoStyler Placement=Line)‑тэй текстэд followLine нэмнэ — эс бөгөөс
	# GeoServer шошгыг шугам ДАГУУЛЖ мурийлгадаггүй (шулуун зурна). Gap → repeat VendorOption.
	# _sld11_to_sld10‑той ижил зарчим (nameclass editor энэ функцийг ашигладаг тул энд ч хэрэгтэй).
	SLD = _SLD_NS
	for ts in rule.iter(f'{{{SLD}}}TextSymbolizer'):
		lp = next(iter(ts.iter(f'{{{SLD}}}LinePlacement')), None)
		if lp is None:
			continue
		gap = lp.find(f'{{{SLD}}}Gap')
		gap_val = gap.text.strip() if (gap is not None and gap.text) else None
		for extra in ('Gap', 'IsRepeated', 'InitialGap', 'GeneralizeLine'):
			e = lp.find(f'{{{SLD}}}{extra}')
			if e is not None:
				lp.remove(e)
		if gap_val is not None and not any(
				v.get('name') == 'repeat' for v in ts.findall(f'{{{SLD}}}VendorOption')):
			vo = ET.SubElement(ts, f'{{{SLD}}}VendorOption')
			vo.set('name', 'repeat')
			vo.text = gap_val
		if not any(v.get('name') == 'followLine' for v in ts.findall(f'{{{SLD}}}VendorOption')):
			fl = ET.SubElement(ts, f'{{{SLD}}}VendorOption')
			fl.set('name', 'followLine')
			fl.text = 'true'
	return rule


def _sld11_to_sld10(sld_xml):
	"""Бүхэл SLD 1.1 (se:) баримтыг SLD 1.0 (sld:) болгож хөрвүүлнэ — geoname‑тэй
	ижил зарчим (se:→sld:, SvgParameter→CssParameter, version=1.0.0). GeoStyler нь
	SLD 1.1/SE илгээдэг ба GeoServer‑т 1.0 гэж задлуулбал SvgParameter (өнгө/өргөн)
	алдагддаг тул бичихийн өмнө найдвартай 1.0 болгоно."""
	import xml.etree.ElementTree as ET
	ET.register_namespace('sld', _SLD_NS)
	ET.register_namespace('ogc', _OGC_NS)
	ET.register_namespace('xlink', _XLINK_NS)
	try:
		root = ET.fromstring(sld_xml)
	except Exception:
		return sld_xml
	for el in root.iter():
		if el.tag.startswith(f'{{{_SE_NS}}}'):
			local = el.tag.split('}', 1)[1]
			if local == 'SvgParameter':
				local = 'CssParameter'
			el.tag = f'{{{_SLD_NS}}}{local}'
	# SE 1.1 LinePlacement дахь Gap/IsRepeated‑ийг GeoServer VendorOption болгоно.
	# SLD 1.0 LinePlacement нь зөвхөн PerpendicularOffset‑ийг дэмждэг тул GeoStyler‑ийн
	# Repeat (Gap) утга GeoServer‑т үл тоомсорлогдож, ажилладаггүй байсан. Gap →
	# <VendorOption name="repeat">; IsRepeated/бусад SE‑only элементийг хасна.
	SLD = _SLD_NS
	for ts in root.iter(f'{{{SLD}}}TextSymbolizer'):
		lp = None
		for cand in ts.iter(f'{{{SLD}}}LinePlacement'):
			lp = cand
			break
		if lp is None:
			continue
		gap = lp.find(f'{{{SLD}}}Gap')
		gap_val = gap.text.strip() if (gap is not None and gap.text) else None
		for extra in ('Gap', 'IsRepeated', 'InitialGap', 'GeneralizeLine'):
			e = lp.find(f'{{{SLD}}}{extra}')
			if e is not None:
				lp.remove(e)
		if gap_val is not None:
			vo = ET.SubElement(ts, f'{{{SLD}}}VendorOption')
			vo.set('name', 'repeat')
			vo.text = gap_val
		# LinePlacement‑тэй текст (GeoStyler Placement=Line) — GeoServer дээр нэрийг
		# шугам дагуулж мурийлгахын тулд followLine нэмнэ (GeoStyler өөрөө гаргадаггүй).
		# Энэ нь ХИЛ ДАГУУ формын label БИШ: тэр нь maxDisplacement/maxAngleDelta/group
		# зэрэг өөрийн тэмдэгтэй тул уншихад (_strip_boundary_fts) ялгагдана.
		if not any(v.get('name') == 'followLine'
				   for v in ts.findall(f'{{{SLD}}}VendorOption')):
			fl = ET.SubElement(ts, f'{{{SLD}}}VendorOption')
			fl.set('name', 'followLine')
			fl.text = 'true'
	if root.tag.split('}', 1)[-1] == 'StyledLayerDescriptor':
		root.set('version', '1.0.0')
	return ET.tostring(root, encoding='unicode')


def _sld_for_geostyler_read(sld_xml):
	"""GeoServer‑т хадгалсан SLD 1.0‑г GeoStyler уншихад тохируулж SE 1.1 хэлбэрт
	хөрвүүлнэ: version→1.1.0, CssParameter→SvgParameter, TextSymbolizer‑ийн
	VendorOption repeat → LinePlacement Gap+IsRepeated. Ингэснээр GeoStyler‑ийн
	Repeat, өнгө талбарууд зөв дүүрнэ (geostyler нь repeat‑г ЗӨВХӨН SLD 1.1 + Gap‑аас
	уншдаг; өнгийг 1.1 үед SvgParameter‑аас уншдаг)."""
	import xml.etree.ElementTree as ET
	ET.register_namespace('sld', _SLD_NS)
	ET.register_namespace('ogc', _OGC_NS)
	ET.register_namespace('xlink', _XLINK_NS)
	try:
		root = ET.fromstring(sld_xml)
	except Exception:
		return sld_xml
	SLD = _SLD_NS
	for el in root.iter(f'{{{SLD}}}CssParameter'):
		el.tag = f'{{{SLD}}}SvgParameter'
	for ts in root.iter(f'{{{SLD}}}TextSymbolizer'):
		repeat_val = None
		for vo in list(ts.findall(f'{{{SLD}}}VendorOption')):
			nm = vo.get('name')
			if nm == 'repeat':
				repeat_val = (vo.text or '').strip()
				ts.remove(vo)
			elif nm == 'followLine':
				ts.remove(vo)  # geostyler хэрэглэдэггүй
		if repeat_val is not None:
			lp = None
			for cand in ts.iter(f'{{{SLD}}}LinePlacement'):
				lp = cand
				break
			if lp is not None:
				ET.SubElement(lp, f'{{{SLD}}}IsRepeated').text = 'true'
				ET.SubElement(lp, f'{{{SLD}}}Gap').text = repeat_val
	if root.tag.split('}', 1)[-1] == 'StyledLayerDescriptor':
		root.set('version', '1.1.0')
	return ET.tostring(root, encoding='unicode')


def _fix_sld_dasharray(sld_xml):
	"""geostyler-sld-parser нь stroke-dasharray‑г .split‑ддэг ба XML parser нь ганц
	тоон утгыг (жишээ '4.0') NUMBER болгон хувиргадаг тул 'l.split is not a function'
	алдаа өгдөг. Ганц утгыг зайтай хос ('4.0 4.0') болгож STRING хэвээр үлдээнэ."""
	import re as _re

	def _rep(m):
		val = (m.group(2) or '').strip()
		if val and ' ' not in val:
			val = f'{val} {val}'
		return f'{m.group(1)}{val}{m.group(3)}'

	return _re.sub(r'(name="(?:stroke|outline)-dasharray">)([^<]*)(</)',
				   _rep, sld_xml)


def _strip_boundary_fts(sld_xml):
	"""SLD‑ээс ЗӨВХӨН "ХИЛ ДАГУУ НЭР" формын RULE‑уудыг хасна — GeoStyler‑т зөвхөн
	GeoStyler‑ийн rule‑ийг харуулахын тулд. Формын label нь `maxDisplacement`
	VendorOption‑той (зөвхөн gs_boundary_label гаргадаг) тул үүгээр ялгана. АНХААР:
	followLine‑аар ялгаж БОЛОХГҮЙ — GeoStyler‑ийн энгийн шугам дагасан (curve) label
	ч followLine‑той тул тэдгээрийг андуурч хасаж болзошгүй. Формын label тусдаа
	FeatureTypeStyle‑д ч, ерөнхий FTS доторх rule‑д ч байж болно — тиймээс бүхэл
	FTS‑ийг биш, тэмдэгтэй RULE‑ыг тус тусад нь хасна. Хоосон FTS‑ийг устгана.
	Rule нэг ч үлдэхгүй бол None."""
	import xml.etree.ElementTree as ET
	ET.register_namespace('sld', _SLD_NS)
	ET.register_namespace('ogc', _OGC_NS)
	ET.register_namespace('xlink', _XLINK_NS)
	try:
		root = ET.fromstring(sld_xml)
	except Exception:
		return sld_xml
	for us in root.iter(f'{{{_SLD_NS}}}UserStyle'):
		for fts in list(us.findall(f'{{{_SLD_NS}}}FeatureTypeStyle')):
			for rule in list(fts.findall(f'{{{_SLD_NS}}}Rule')):
				if 'maxDisplacement' in ET.tostring(rule, encoding='unicode'):
					fts.remove(rule)
			if not fts.findall(f'{{{_SLD_NS}}}Rule'):
				us.remove(fts)
	if not root.findall(f'.//{{{_SLD_NS}}}Rule'):
		return None
	return ET.tostring(root, encoding='unicode')


def _sanitize_sld_marks(sld_xml):
	"""GeoStyler‑ийн parser нь WellKnownName‑гүй Mark‑ийг задалж чаддаггүй
	('MarkSymbolizer cannot be parsed. WellKnownName undefined is not supported').
	ExternalGraphic ч, WellKnownName ч үгүй хоосон Mark‑д default 'circle' нэмж,
	editor ачаалагдахуйц болгоно."""
	import xml.etree.ElementTree as ET
	ET.register_namespace('sld', _SLD_NS)
	ET.register_namespace('ogc', _OGC_NS)
	ET.register_namespace('xlink', _XLINK_NS)
	try:
		root = ET.fromstring(sld_xml)
	except Exception:
		return sld_xml
	changed = False
	for el in root.iter():
		if el.tag.split('}', 1)[-1] != 'Mark':
			continue
		child_locals = {c.tag.split('}', 1)[-1] for c in el}
		if child_locals & {'WellKnownName', 'ExternalGraphic', 'OnlineResource'}:
			continue
		ns = el.tag.split('}', 1)[0].strip('{') if '}' in el.tag else _SLD_NS
		wkn = ET.Element(f'{{{ns}}}WellKnownName')
		wkn.text = 'circle'
		el.insert(0, wkn)  # WellKnownName нь Mark‑ийн эхний хүүхэд байх ёстой
		changed = True
	return ET.tostring(root, encoding='unicode') if changed else sld_xml


def _set_type_filter(rule, tid):
    """rule‑д type_id==tid filter‑ийг тавина. Байгаа (type‑бус) filter‑г AND‑лэнэ.
    ЧУХАЛ: SLD 1.0‑д Filter нь OGC namespace (ogc:Filter) — SLD биш. Өмнө _SLD_NS‑ээр
    хайж байсан тул байгаа filter олдохгүй → давхар Filter нэмэгдэж, дараагийн
    хадгалалт дээр устгах логик буруу ажиллаж rule давхардаж байсан."""
    import xml.etree.ElementTree as ET
    existing = rule.find(f'{{{_OGC_NS}}}Filter')
    new_flt = ET.Element(f'{{{_OGC_NS}}}Filter')
    if existing is not None and list(existing):
        # байгаа filter‑ийн доторхийг And(type_id, ...) болгоно
        andel = ET.SubElement(new_flt, f'{{{_OGC_NS}}}And')
        andel.append(_make_type_eq(tid))
        for ch in list(existing):
            andel.append(ch)
        rule.remove(existing)
    else:
        new_flt.append(_make_type_eq(tid))
        if existing is not None:
            rule.remove(existing)
    rule.insert(0, new_flt)  # Filter‑ийг эхэнд (SLD дараалал)


def ensure_geoname_type_style():
    """geoname_view‑д type symbol бүхий combined NAMED style (geoname_types) үүсгэж,
    geoname_view‑ийн DEFAULT style болгоно. Нэгдсэн ганц view нь энэ style‑аар
    ангилал бүрийг өөрийн тэмдгээр рендерлэнэ (per-type view/style хэрэггүй)."""
    global _geoname_type_style_done
    name = _GEONAME_TYPE_STYLE
    try:
        base, auth = _gs_rest_auth()
        if not _geoname_type_style_done:
            sld = _build_recount_type_sld()  # type_id-д суурилсан тул geoname_view-д хүчинтэй
            if not sld:
                return ''
            sld = sld.replace(f'>{RECOUNT_VIEW}<', f'>{GEONAME_SEARCH_VIEW}<')  # NamedLayer
            chk = requests.get(f"{base}/workspaces/{GEONAME_WS}/styles/{name}.json",
                               auth=auth, timeout=10)
            if chk.status_code != 200:
                requests.post(f"{base}/workspaces/{GEONAME_WS}/styles",
                              json={"style": {"name": name, "filename": f"{name}.sld"}},
                              auth=auth, timeout=10)
            _gs_style_write_sld(GEONAME_WS, name, sld)
            _geoname_type_style_done = True
        # geoname_view‑ийн default style болгоно (үргэлж баталгаажуулна — хямд PUT)
        requests.put(
            f"{base}/layers/{GEONAME_WS}:{GEONAME_SEARCH_VIEW}",
            data=f'<layer><defaultStyle><name>{name}</name>'
                 f'<workspace>{GEONAME_WS}</workspace></defaultStyle></layer>',
            auth=auth, headers={"Content-Type": "text/xml"}, timeout=10)
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
    type symbol бүхий combined style ононо. Багана дутуу (хуучин хувилбар) бол
    view‑г ДАХИН үүсгэнэ (ж: geom_type нэмэгдсэн)."""
    try:
        with connection.cursor() as c:
            c.execute("SELECT to_regclass('public.recount_view')")
            exists = bool(c.fetchone()[0])
            if exists:
                c.execute(
                    "SELECT column_name FROM information_schema.columns "
                    "WHERE table_name=%s", [RECOUNT_VIEW])
                cols = {r[0] for r in c.fetchall()}
                # type_src — draft‑ийн ангиллыг тооцдог болсон хувилбарын тэмдэг
                if ('geom_type' not in cols or 'type_src' not in cols
                        or 'unit_src' not in cols):
                    c.execute('DROP VIEW public."%s" CASCADE' % RECOUNT_VIEW)
                    exists = False
            if not exists:
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
    """DEPRECATED — ганц geoname_view архитектур руу шилжсэн тул per-type
    'geoname:names' LayerGroup үүсгэхээ больсон (no-op). Хуучин код доор үлдсэн."""
    return
    # pylint: disable=unreachable
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
    """DEPRECATED — ганц geoname_view архитектур руу шилжсэн тул per-type view
    үүсгэхээ больсон (no-op). Бүх ангилал geoname_view + geoname_types style‑аар
    CQL (type_l1/l2/id)‑ээр рендерлэгдэнэ."""
    return None
    # pylint: disable=unreachable
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
			# Зөвшөөрсөн workspace-уудыг settings.GEOSERVER_WORKSPACES-ээр шүүнэ
			# (frontend-д hardcode хийхгүй). Хоосон/тохируулаагүй бол бүгдийг.
			qs = qs.filter(key='WORKSPACES', parent__isnull=True)
			allowed = getattr(settings, 'GEOSERVER_WORKSPACES', None)
			if allowed:
				qs = qs.filter(name__in=allowed)
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
						vcount = self._gs_workspace_layer_count(c.name)
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
			# Нэгдсэн/бусад published view‑ууд (geoname_view, recount_view,
			# geoname_search_view г.м.) — per‑type leaf view‑үүд устсан тул
			# эдгээр бодит давхаргуудыг мөн жагсаана.
			added = {r['view'] for r in rows}
			for nm in sorted(published):
				if nm in added:
					continue
				rows.append({
					'view': nm, 'type_id': None, 'geom': '',
					'level1': '', 'level2': '', 'level3': '',
					'published': True, **svc_flags(nm),
				})
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

	def _gs_workspace_layer_count(self, ws_name):
		"""Workspace доторх БҮХ store‑ийн нийтэлсэн layer тоо (vector featuretype,
		raster coverage, WMS/WMTS cascade). Картын 'N view' тоог гаргахад ашиглана —
		зөвхөн ганц store биш, workspace дахь бүх өгөгдлийн эх сурвалжийг хамруулна."""
		base, auth = self._gs_rest(), self._gs_auth()
		total = 0
		for skind, lkind, _gtype in self._STORE_KINDS:
			try:
				sr = requests.get(f"{base}/workspaces/{ws_name}/{skind}.json",
								  auth=auth, timeout=8)
				if sr.status_code != 200:
					continue
				sroot = next(iter(sr.json().values()), None) or {}
				stores = next(iter(sroot.values()), []) if isinstance(sroot, dict) else []
				if isinstance(stores, dict):
					stores = [stores]
				for st in stores:
					sname = st.get('name')
					if not sname:
						continue
					lr = requests.get(
						f"{base}/workspaces/{ws_name}/{skind}/{sname}/{lkind}.json",
						auth=auth, timeout=8)
					if lr.status_code != 200:
						continue
					lroot = next(iter(lr.json().values()), None) or {}
					items = next(iter(lroot.values()), []) if isinstance(lroot, dict) else []
					if isinstance(items, dict):
						items = [items]
					total += len(items)
			except requests.RequestException:
				continue
		return total

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

	# Store‑ийн төрөл бүрийн GeoServer REST зам: (store‑ийн kind, доторх
	# featuretype/coverage‑ийн kind, харагдах төрлийн шошго)
	_STORE_KINDS = [
		('datastores', 'featuretypes', 'vector'),
		('coveragestores', 'coverages', 'raster'),
		('wmsstores', 'wmslayers', 'wms'),
		('wmtsstores', 'wmtslayers', 'wmts'),
	]

	@action(detail=True, methods=['get'], url_path='gs-all-layers')
	def gs_all_layers(self, request, *args, **kwargs):
		"""Workspace доторх БҮХ нийтэлсэн layer (vector featuretype, raster
		coverage, WMS/WMTS cascade) — store болон төрлийн шошготойгоор жагсаана.
		gs-layers нь зөвхөн vector datastore‑той тул raster workspace‑д
		хангалтгүй; энэ endpoint нь store‑ийн бүх төрлийг хамруулна."""
		ws = self.get_object()
		base, auth = self._gs_rest(), self._gs_auth()
		out = []
		try:
			for skind, lkind, gtype in self._STORE_KINDS:
				sr = requests.get(f"{base}/workspaces/{ws.name}/{skind}.json",
								  auth=auth, timeout=10)
				if sr.status_code != 200:
					continue
				sroot = next(iter(sr.json().values()), None) or {}
				stores = next(iter(sroot.values()), []) if isinstance(sroot, dict) else []
				if isinstance(stores, dict):
					stores = [stores]
				for st in stores:
					sname = st.get('name')
					if not sname:
						continue
					lr = requests.get(
						f"{base}/workspaces/{ws.name}/{skind}/{sname}/{lkind}.json",
						auth=auth, timeout=10)
					if lr.status_code != 200:
						continue
					lroot = next(iter(lr.json().values()), None) or {}
					items = next(iter(lroot.values()), []) if isinstance(lroot, dict) else []
					if isinstance(items, dict):
						items = [items]
					for it in items:
						out.append({'name': it.get('name'), 'store': sname,
									'store_kind': skind, 'type': gtype})
		except requests.RequestException as e:
			return Response({'detail': f'GeoServer холбогдсонгүй: {e}'}, status=502)
		out.sort(key=lambda x: (x['type'], x['store'], x['name'] or ''))
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

	# ==================================================================
	# Layer‑ийн style (symbol) засвар — GeoStyler editor‑т SLD унших/бичих.
	# Global default style (жишээ nь 'point', 'generic')‑ийг шууд засвал бусад
	# layer‑т нөлөөлдөг тул тухайн workspace‑д хувийн style ({ws}:{layer})
	# үүсгээд түүн рүү бичиж, layer‑ийн default style‑ийг болгоно.
	# ==================================================================
	def _gs_read_style_sld_any(self, ws, name):
		"""ws‑scoped, эс бол global style‑ийн SLD‑г уншина (ws‑ийг эхэлж)."""
		rest, auth = self._gs_rest(), self._gs_auth()
		r = requests.get(f"{rest}/workspaces/{ws}/styles/{name}.sld", auth=auth, timeout=30)
		if r.status_code == 200:
			return r.text
		r = requests.get(f"{rest}/styles/{name}.sld", auth=auth, timeout=30)
		return r.text if r.status_code == 200 else None

	def _gs_layer_default_style(self, ws, layer):
		rest, auth = self._gs_rest(), self._gs_auth()
		r = requests.get(f"{rest}/workspaces/{ws}/layers/{layer}.json", auth=auth, timeout=15)
		if r.status_code != 200:
			return {}
		return ((r.json().get('layer') or {}).get('defaultStyle')) or {}

	def _gs_layer_geom_type(self, ws, layer):
		"""Layer‑ийн геометрийн төрөл: 'polygon'|'line'|'point'|'raster'."""
		rest, auth = self._gs_rest(), self._gs_auth()
		lr = requests.get(f"{rest}/workspaces/{ws}/layers/{layer}.json", auth=auth, timeout=15)
		if lr.status_code != 200:
			return 'polygon'
		lj = lr.json().get('layer') or {}
		if (lj.get('type') or '').upper() == 'RASTER':
			return 'raster'
		res_href = (lj.get('resource') or {}).get('href')
		try:
			ft = requests.get(res_href, auth=auth, timeout=15).json().get('featureType') or {}
			for a in ((ft.get('attributes') or {}).get('attribute') or []):
				b = (a.get('binding') or '').lower()
				if 'geom' in b or 'jts' in b:
					if 'polygon' in b:
						return 'polygon'
					if 'line' in b:
						return 'line'
					if 'point' in b:
						return 'point'
		except (requests.RequestException, ValueError):
			pass
		return 'polygon'

	def _default_sld_for_layer(self, ws, layer, style_name):
		"""GeoStyler‑т тохирох ЦЭВЭР default SLD — layer‑ийн геометрийн төрлөөр.
		GeoServer‑ийн 'generic' зэрэг ogc:Function (isCoverage/dimension) агуулсан
		style‑ийг GeoStyler editor рендерлэж чаддаггүй тул үүгээр орлуулна."""
		gt = self._gs_layer_geom_type(ws, layer)
		if gt == 'raster':
			sym = '<RasterSymbolizer><Opacity>1.0</Opacity></RasterSymbolizer>'
		elif gt == 'line':
			sym = ('<LineSymbolizer><Stroke>'
				   '<CssParameter name="stroke">#3388ff</CssParameter>'
				   '<CssParameter name="stroke-width">1</CssParameter>'
				   '</Stroke></LineSymbolizer>')
		elif gt == 'point':
			sym = ('<PointSymbolizer><Graphic><Mark>'
				   '<WellKnownName>circle</WellKnownName>'
				   '<Fill><CssParameter name="fill">#3388ff</CssParameter></Fill>'
				   '</Mark><Size>8</Size></Graphic></PointSymbolizer>')
		else:
			sym = ('<PolygonSymbolizer>'
				   '<Fill><CssParameter name="fill">#AAAAAA</CssParameter>'
				   '<CssParameter name="fill-opacity">0.6</CssParameter></Fill>'
				   '<Stroke><CssParameter name="stroke">#333333</CssParameter>'
				   '<CssParameter name="stroke-width">1</CssParameter></Stroke>'
				   '</PolygonSymbolizer>')
		return (
			'<?xml version="1.0" encoding="UTF-8"?>'
			'<StyledLayerDescriptor version="1.0.0" '
			'xmlns="http://www.opengis.net/sld" '
			'xmlns:ogc="http://www.opengis.net/ogc" '
			'xmlns:xlink="http://www.w3.org/1999/xlink">'
			f'<NamedLayer><Name>{layer}</Name><UserStyle><Name>{style_name}</Name>'
			f'<FeatureTypeStyle><Rule>{sym}</Rule></FeatureTypeStyle>'
			'</UserStyle></NamedLayer></StyledLayerDescriptor>'
		)

	@action(detail=True, methods=['get', 'put'], url_path='gs-layer-sld')
	def gs_layer_sld(self, request, *args, **kwargs):
		"""Тухайн layer‑ийн style SLD унших/бичих (GeoStyler editor‑т зориулав).
		GET → одоогийн (ws‑scoped, эс бол default) SLD. PUT → ws‑scoped хувийн
		style‑д хадгалаад layer‑ийн default болгоно."""
		ws = self.get_object()
		layer = (request.query_params.get('layer') or request.data.get('layer') or '').strip()
		if not layer:
			return Response({'detail': 'layer шаардлагатай'}, status=400)
		style_name = layer  # ws‑scoped хувийн style нэр = layer нэр

		if request.method == 'GET':
			# 1) Энэ layer‑т ws‑scoped хувийн style байвал түүнийг. Хэрэв combined
			#    (GeoStyler rule + ХИЛ ДАГУУ НЭР) бол boundary FeatureTypeStyle‑ийг
			#    хасаад GeoStyler‑ийн rule‑ийг л буцаана (boundary‑г форм тусдаа удирдана).
			sld = self._gs_read_style_sld_any(ws.name, style_name)
			if sld and 'maxDisplacement' in sld:
				sld = _strip_boundary_fts(sld)
			if sld and ('<ogc:Function' in sld or '<Function' in sld):
				sld = None
			if sld is None:
				# 2) Одоогийн default style‑ийг эх болгож авах — ГЭХДЭЭ ogc:Function
				#    агуулаагүй (GeoStyler рендерлэж чадах) бол. Эс бөгөөс геометрт
				#    тохирсон цэвэр default SLD үүсгэнэ ('generic' style‑ийн crash‑аас).
				ds = self._gs_layer_default_style(ws.name, layer)
				dname = ds.get('name')
				if dname:
					cand = self._gs_read_style_sld_any(ds.get('workspace') or ws.name, dname)
					if cand and '<ogc:Function' not in cand and '<Function' not in cand:
						sld = cand
				if sld is None:
					sld = self._default_sld_for_layer(ws.name, layer, style_name)
			# GeoStyler‑ийн parser‑т тохируулах: WellKnownName‑гүй Mark + dasharray,
			# дараа нь SE 1.1 хэлбэрт (Repeat/өнгө зөв дүүргэх).
			sld = _sanitize_sld_marks(sld)
			sld = _fix_sld_dasharray(sld)
			sld = _sld_for_geostyler_read(sld)
			sld = _absolutize_sld_symbols(sld, request)
			return Response({'sld': sld, 'style_name': style_name, 'ws': ws.name,
							 'layer': layer}, status=200)

		# PUT
		edited = request.data.get('sld')
		if not edited:
			return Response({'detail': 'sld хоосон'}, status=400)
		edited = _localize_sld_symbols(edited, ws.name)
		# GeoStyler нь SLD 1.1 / SE (se:SvgParameter) илгээдэг. GeoServer‑т 1.0 гэж
		# задлуулбал SvgParameter (fill/stroke өнгө, өргөн) танигдалгүй хаягдаж, style
		# ХООСОН болдог. Тиймээс geoname‑тэй ижил найдвартай SLD 1.0 болгож хөрвүүлээд
		# sld+xml‑ээр бичнэ.
		edited = _sld11_to_sld10(edited)
		rest, auth = self._gs_rest(), self._gs_auth()
		# 1) ws‑scoped style байхгүй бол үүсгэнэ
		chk = requests.get(f"{rest}/workspaces/{ws.name}/styles/{style_name}.json",
						   auth=auth, timeout=15)
		if chk.status_code != 200:
			requests.post(
				f"{rest}/workspaces/{ws.name}/styles",
				data=f'<style><name>{style_name}</name>'
					 f'<filename>{style_name}.sld</filename></style>',
				headers={'Content-Type': 'application/xml'}, auth=auth, timeout=20)
		# 2) SLD бичих (SLD 1.0, sld+xml — geoname‑тэй ижил)
		try:
			_gs_style_write_sld(ws.name, style_name, edited)
		except requests.RequestException as e:
			return Response({'detail': f'SLD хадгалж чадсангүй: {e}'}, status=502)
		# 3) Layer‑ийн default style‑ийг ws‑scoped руу тавих
		requests.put(
			f"{rest}/workspaces/{ws.name}/layers/{layer}",
			data=f'<layer><defaultStyle><name>{style_name}</name>'
				 f'<workspace>{ws.name}</workspace></defaultStyle></layer>',
			headers={'Content-Type': 'application/xml'}, auth=auth, timeout=20)
		# 4) GWC‑д хуучин tile байвал цэвэрлэх (шинэ style шууд харагдана)
		try:
			self._gwc_truncate_layer_and_groups(ws.name, layer)
		except Exception:
			pass
		return Response({'saved': True, 'style_name': style_name, 'ws': ws.name,
						 'layer': layer}, status=200)

	# GeoStyler Icon source‑д зөвшөөрөх зургийн төрлүүд. GeoServer нь SVG (Batik)
	# болон PNG/GIF (ImageIO)‑г ExternalGraphic‑аар рендерлэнэ.
	_ICON_EXTS = {'.svg', '.png', '.gif', '.jpg', '.jpeg'}

	@action(detail=True, methods=['post'], url_path='gs-upload-symbol')
	def gs_upload_symbol(self, request, *args, **kwargs):
		"""GeoStyler Icon source‑д зориулсан зураг upload (workspace‑scoped).
		SVG (вектор) болон PNG/GIF/JPG (растер) зөвшөөрнө."""
		import os
		import uuid
		from django.core.files.storage import default_storage
		from django.core.files.base import ContentFile
		ws = self.get_object()
		f = request.FILES.get('file')
		if not f:
			return Response({'detail': 'Файл алга'}, status=400)
		ext = os.path.splitext(f.name)[1].lower()
		if ext not in self._ICON_EXTS:
			return Response({'detail': 'Зөвхөн SVG, PNG, GIF, JPG зураг оруулна'},
							status=400)
		if f.size > 2 * 1024 * 1024:
			return Response({'detail': 'Файл 2MB‑аас их байна'}, status=400)
		data = f.read()
		basename = f"{uuid.uuid4().hex}{ext}"
		saved = default_storage.save(f"geoname_symbols/{basename}", ContentFile(data))
		try:
			_gs_upload_symbol_bytes(ws.name, basename, data)
		except requests.RequestException:
			pass
		return Response({'url': request.build_absolute_uri(default_storage.url(saved)),
						 'path': saved}, status=201)

	def _gwc_truncate_layer_and_groups(self, ws_name, layer):
		"""Layer‑ийн GWC кэш + түүнийг агуулсан layergroup‑уудын GWC кэшийг ч
		цэвэрлэнэ. Газрын зураг ихэвчлэн layergroup‑оор (TILED) рендерлэдэг тул
		зөвхөн layer‑ийг truncate хийхэд style засвар харагдахгүй байдаг."""
		_gwc_masstruncate(f"{ws_name}:{layer}")
		rest, auth = self._gs_rest(), self._gs_auth()
		try:
			r = requests.get(f"{rest}/workspaces/{ws_name}/layergroups.json",
							 auth=auth, timeout=10)
			root = (r.json().get('layerGroups') or '') if r.status_code == 200 else ''
			items = (root.get('layerGroup') if isinstance(root, dict) else []) or []
			if isinstance(items, dict):
				items = [items]
			targets = {f"{ws_name}:{layer}", layer}
			for it in items:
				gname = it.get('name')
				if not gname:
					continue
				gr = requests.get(f"{rest}/workspaces/{ws_name}/layergroups/{gname}.json",
								  auth=auth, timeout=10)
				if gr.status_code != 200:
					continue
				pubs = (((gr.json().get('layerGroup') or {}).get('publishables') or {})
						.get('published')) or []
				if isinstance(pubs, dict):
					pubs = [pubs]
				if any((p.get('name') in targets) for p in pubs):
					_gwc_masstruncate(f"{ws_name}:{gname}")
		except requests.RequestException:
			pass

	def _gs_layer_geom_field(self, ws, layer):
		"""Layer‑ийн геометрийн баганын нэр (default 'geom')."""
		rest, auth = self._gs_rest(), self._gs_auth()
		lr = requests.get(f"{rest}/workspaces/{ws}/layers/{layer}.json", auth=auth, timeout=15)
		if lr.status_code != 200:
			return 'geom'
		res_href = ((lr.json().get('layer') or {}).get('resource') or {}).get('href')
		try:
			ft = requests.get(res_href, auth=auth, timeout=15).json().get('featureType') or {}
			for a in ((ft.get('attributes') or {}).get('attribute') or []):
				b = (a.get('binding') or '').lower()
				if 'geom' in b or 'jts' in b:
					return a.get('name') or 'geom'
		except (requests.RequestException, ValueError):
			pass
		return 'geom'

	@action(detail=True, methods=['get', 'post'], url_path='gs-boundary-label')
	def gs_boundary_label(self, request, *args, **kwargs):
		"""OSM маягийн ХИЛ ДАГУУ нэр — polygon layer‑ийн захын (boundary) шугам дагуулж,
		дотогш (PerpendicularOffset) шилжүүлж, followLine‑аар нэрийг байрлуулна.
		GeoStyler‑ээр хийх боломжгүй (vendor option) тул preset SLD‑ээр хэрэгжинэ.
		GET → тухайн layer‑т одоо идэвхтэй эсэх + параметрүүд (edit‑д урьдчилан дүүргэх)."""
		ws = self.get_object()
		layer = (request.query_params.get('layer') or request.data.get('layer') or '').strip()
		if not layer:
			return Response({'detail': 'layer шаардлагатай'}, status=400)
		style_name = layer

		if request.method == 'GET':
			import re as _re
			full = self._gs_read_style_sld_any(ws.name, style_name) or ''
			# ХИЛ ДАГУУ формын label нь maxDisplacement‑тэй (зөвхөн энэ форм гаргадаг).
			# followLine‑аар шалгаж БОЛОХГҮЙ — GeoStyler‑ийн энгийн curve label ч
			# followLine‑той тул формыг андуурч "идэвхтэй" гэж уншина.
			active = 'maxDisplacement' in full
			# Combined style (GeoStyler rule + ХИЛ ДАГУУ НЭР) үед scale/offset‑ийг
			# ЗӨВХӨН формын FeatureTypeStyle‑ээс уншина — эс бөгөөс GeoStyler rule‑ийн
			# масштаб буруу уншигдана.
			blocks = _re.findall(
				r'<(?:\w+:)?FeatureTypeStyle>.*?</(?:\w+:)?FeatureTypeStyle>', full, _re.S)
			sld = next((b for b in blocks if 'maxDisplacement' in b), full)
			d = {'active': active, 'geom_type': self._gs_layer_geom_type(ws.name, layer),
				 'label_field': 'name', 'offset': 9, 'font_size': 12,
				 'font_family': 'Arial', 'fill': '#333333', 'stroke': '#888888',
				 'repeat': 400, 'scale_min': None, 'scale_max': None}
			if active:
				def g(pat, cast=str, default=None):
					m = _re.search(pat, sld)
					try:
						return cast(m.group(1)) if m else default
					except (TypeError, ValueError):
						return default
				# GeoServer нь SLD‑г sld: prefix‑тэй дахин серизацилдаг тул tag‑уудыг
				# prefix‑agnostic (?:\w+:)? хэлбэрээр тааруулна.
				d['label_field'] = g(r'<(?:\w+:)?Label>\s*<(?:\w+:)?PropertyName>([^<]+)', str, 'name')
				d['offset'] = g(r'<(?:\w+:)?PerpendicularOffset>([^<]+)', float, 9)
				d['font_family'] = g(r'font-family[^>]*>([^<]+)', str, 'Arial')
				d['font_size'] = g(r'font-size[^>]*>([^<]+)', lambda x: int(float(x)), 12)
				d['fill'] = g(r'name="fill">([^<]+)', str, '#333333')
				d['stroke'] = g(r'name="stroke">([^<]+)', str, '#888888')
				d['repeat'] = g(r'name="repeat">([^<]+)', lambda x: int(float(x)), 0)
				d['scale_min'] = g(r'<(?:\w+:)?MinScaleDenominator>([^<]+)', lambda x: int(float(x)))
				d['scale_max'] = g(r'<(?:\w+:)?MaxScaleDenominator>([^<]+)', lambda x: int(float(x)))
			return Response(d, status=200)

		# POST — хэрэгжүүлэх
		label = (request.data.get('label_field') or 'name').strip()
		offset = request.data.get('offset', 9)          # +дотогш / −гадагш (ринг чиглэлээс)
		font_size = request.data.get('font_size', 12)
		font_family = (request.data.get('font_family') or 'Arial').strip()
		stroke = (request.data.get('stroke') or '#888888').strip()
		stroke_w = request.data.get('stroke_width', 1)
		fill = (request.data.get('fill') or '#333333').strip()
		repeat = request.data.get('repeat', 400)
		smin = request.data.get('scale_min')            # MinScaleDenominator (том зум)
		smax = request.data.get('scale_max')            # MaxScaleDenominator (жижиг зум)
		if not self._IDENT_RE.match(label):
			return Response({'detail': 'label талбар буруу'}, status=400)
		try:
			repeat_val = float(repeat)
		except (TypeError, ValueError):
			repeat_val = 0
		geom = self._gs_layer_geom_field(ws.name, layer)
		gtype = self._gs_layer_geom_type(ws.name, layer)
		# polygon бол захын шугам (boundary функц), line бол шугамаа шууд label‑дэнэ
		geom_xml = (f'<sld:Geometry><ogc:Function name="boundary">'
					f'<ogc:PropertyName>{geom}</ogc:PropertyName></ogc:Function></sld:Geometry>'
					if gtype == 'polygon' else '')
		scale_xml = ''
		if smin not in (None, ''):
			scale_xml += f'<sld:MinScaleDenominator>{float(smin)}</sld:MinScaleDenominator>'
		if smax not in (None, ''):
			scale_xml += f'<sld:MaxScaleDenominator>{float(smax)}</sld:MaxScaleDenominator>'
		# ХИЛ ДАГУУ НЭР‑ийн Rule (sld: prefix — combined SLD‑д нэгтгэхэд тохирно)
		rule = (
			'<sld:Rule>'
			f'{scale_xml}'
			f'<sld:LineSymbolizer><sld:Stroke>'
			f'<sld:CssParameter name="stroke">{stroke}</sld:CssParameter>'
			f'<sld:CssParameter name="stroke-width">{stroke_w}</sld:CssParameter>'
			f'</sld:Stroke></sld:LineSymbolizer>'
			f'<sld:TextSymbolizer>'
			f'{geom_xml}'
			f'<sld:Label><ogc:PropertyName>{label}</ogc:PropertyName></sld:Label>'
			f'<sld:Font><sld:CssParameter name="font-family">{font_family}</sld:CssParameter>'
			f'<sld:CssParameter name="font-size">{font_size}</sld:CssParameter>'
			f'<sld:CssParameter name="font-weight">bold</sld:CssParameter></sld:Font>'
			f'<sld:LabelPlacement><sld:LinePlacement>'
			f'<sld:PerpendicularOffset>{offset}</sld:PerpendicularOffset>'
			f'</sld:LinePlacement></sld:LabelPlacement>'
			f'<sld:Fill><sld:CssParameter name="fill">{fill}</sld:CssParameter></sld:Fill>'
			f'<sld:VendorOption name="followLine">true</sld:VendorOption>'
			# repeat > 0 бол шугам дагаж давтана; 0/хоосон бол ГАНЦ label (давтахгүй)
			+ (f'<sld:VendorOption name="repeat">{repeat}</sld:VendorOption>'
			   if repeat_val > 0 else '')
			+ f'<sld:VendorOption name="maxAngleDelta">90</sld:VendorOption>'
			f'<sld:VendorOption name="maxDisplacement">50</sld:VendorOption>'
			f'<sld:VendorOption name="group">yes</sld:VendorOption>'
			f'</sld:TextSymbolizer>'
			'</sld:Rule>'
		)
		# base_sld ирвэл (GeoStyler‑ийн rule) түүн рүү ХИЛ ДАГУУ НЭР‑ийн FeatureTypeStyle
		# нэмж НЭГТГЭНЭ — rule засвар алдагдахгүй. Эс бол шинээр (зөвхөн label) үүсгэнэ.
		base = request.data.get('base_sld')
		sld = None
		if base:
			import xml.etree.ElementTree as ET
			ET.register_namespace('sld', _SLD_NS)
			ET.register_namespace('ogc', _OGC_NS)
			ET.register_namespace('xlink', _XLINK_NS)
			try:
				b = _sanitize_sld_marks(_sld11_to_sld10(_localize_sld_symbols(base, ws.name)))
				root = ET.fromstring(b)
				us = root.find(f'.//{{{_SLD_NS}}}UserStyle')
				if us is not None:
					# өмнөх ХИЛ ДАГУУ формын FTS байвал устгаад дахин нэмнэ (давхардал
					# арилгах). maxDisplacement‑аар ялгана — GeoStyler‑ийн энгийн curve
					# label (followLine‑той ч maxDisplacement‑гүй) устгагдахгүй.
					for fts in list(us.findall(f'{{{_SLD_NS}}}FeatureTypeStyle')):
						if 'maxDisplacement' in ET.tostring(fts, encoding='unicode'):
							us.remove(fts)
					bfts = ET.fromstring(
						f'<sld:FeatureTypeStyle xmlns:sld="{_SLD_NS}" '
						f'xmlns:ogc="{_OGC_NS}">{rule}</sld:FeatureTypeStyle>')
					us.append(bfts)
					sld = ET.tostring(root, encoding='unicode')
			except Exception:
				sld = None
		if not sld:
			sld = (
				'<?xml version="1.0" encoding="UTF-8"?>'
				f'<sld:StyledLayerDescriptor version="1.0.0" xmlns:sld="{_SLD_NS}" '
				f'xmlns:ogc="{_OGC_NS}" xmlns:xlink="{_XLINK_NS}">'
				f'<sld:NamedLayer><sld:Name>{layer}</sld:Name>'
				f'<sld:UserStyle><sld:Name>{style_name}</sld:Name>'
				f'<sld:FeatureTypeStyle>{rule}</sld:FeatureTypeStyle>'
				'</sld:UserStyle></sld:NamedLayer></sld:StyledLayerDescriptor>'
			)
		rest, auth = self._gs_rest(), self._gs_auth()
		chk = requests.get(f"{rest}/workspaces/{ws.name}/styles/{style_name}.json",
						   auth=auth, timeout=15)
		if chk.status_code != 200:
			requests.post(f"{rest}/workspaces/{ws.name}/styles",
				data=f'<style><name>{style_name}</name><filename>{style_name}.sld</filename></style>',
				headers={'Content-Type': 'application/xml'}, auth=auth, timeout=20)
		try:
			_gs_style_write_sld(ws.name, style_name, sld)
		except requests.RequestException as e:
			return Response({'detail': f'SLD хадгалж чадсангүй: {e}'}, status=502)
		requests.put(f"{rest}/workspaces/{ws.name}/layers/{layer}",
			data=f'<layer><defaultStyle><name>{style_name}</name>'
				 f'<workspace>{ws.name}</workspace></defaultStyle></layer>',
			headers={'Content-Type': 'application/xml'}, auth=auth, timeout=20)
		try:
			self._gwc_truncate_layer_and_groups(ws.name, layer)
		except Exception:
			pass
		return Response({'saved': True, 'style_name': style_name, 'ws': ws.name,
						 'layer': layer, 'geom': geom}, status=200)

	# ==================================================================
	# Layer‑ийн багана (attribute) жагсаах + сонгосон талбар(ууд)‑аар бүлэглэсэн
	# (dissolve) PG view үүсгэж workspace‑д layer болгон нийтлэх.
	# ==================================================================
	@action(detail=True, methods=['get'], url_path='gs-layer-fields')
	def gs_layer_fields(self, request, *args, **kwargs):
		"""Тухайн featuretype layer‑ийн багана (attribute)‑ууд — геометрээс бусад
		талбарыг бүлэглэх сонголтод харуулна."""
		ws = self.get_object()
		layer = (request.query_params.get('layer') or '').strip()
		if not layer:
			return Response({'detail': 'layer шаардлагатай'}, status=400)
		rest, auth = self._gs_rest(), self._gs_auth()
		lr = requests.get(f"{rest}/workspaces/{ws.name}/layers/{layer}.json",
						  auth=auth, timeout=15)
		if lr.status_code != 200:
			return Response({'detail': 'Layer олдсонгүй'}, status=404)
		res_href = ((lr.json().get('layer') or {}).get('resource') or {}).get('href')
		fields, geom_field = [], None
		try:
			meta = requests.get(res_href, auth=auth, timeout=15).json()
			ft = meta.get('featureType') or {}
			for a in ((ft.get('attributes') or {}).get('attribute') or []):
				b = (a.get('binding') or '')
				if 'geom' in b.lower() or 'jts' in b.lower():
					geom_field = a.get('name')
					continue
				fields.append({'name': a.get('name'), 'binding': b.split('.')[-1]})
		except (requests.RequestException, ValueError):
			return Response({'detail': 'Багана уншиж чадсангүй'}, status=502)
		return Response({'layer': layer, 'geom_field': geom_field, 'results': fields},
						status=200)

	def _store_db(self, ws_name, store):
		"""Datastore‑ийн бодит PostGIS баазад холбогдоно. `database`/`schema`/`host`/
		`port`‑ыг GeoServer REST‑ээс уншиж, нэвтрэхдээ Django‑ийн default эрхийг
		(ижил кластер) ашиглана — GeoServer доторх нууц үг шифрлэгдсэн байдаг. Store
		бүр өөр баазтай байж болох тул view‑г ЗӨВ баазад (жишээ nь basemap) үүсгэнэ."""
		import psycopg2
		from django.conf import settings as _st
		rest, auth = self._gs_rest(), self._gs_auth()
		r = requests.get(f"{rest}/workspaces/{ws_name}/datastores/{store}.json",
						 auth=auth, timeout=15)
		params = {}
		if r.status_code == 200:
			entries = (((r.json().get('dataStore') or {})
						.get('connectionParameters') or {}).get('entry') or [])
			params = {e.get('@key'): e.get('$') for e in entries}
		d = _st.DATABASES['default']
		conn = psycopg2.connect(
			host=params.get('host') or d.get('HOST') or 'localhost',
			port=params.get('port') or d.get('PORT') or 5432,
			dbname=params.get('database') or d['NAME'],
			user=d['USER'], password=d['PASSWORD'])
		return conn, (params.get('schema') or 'public')

	@staticmethod
	def _slug_ident(value, fallback):
		"""Дурын утгыг PG identifier болгон цэвэрлэнэ (view нэрэнд). Латин бус
		тэмдэгт (кирилл) хасагдвал fallback (индекс) хэрэглэнэ."""
		import re as _r
		# Угтвар (prefix_) үргэлж түрүүнд байх тул тоогоор эхэлсэн ч асуудалгүй.
		s = _r.sub(r'[^0-9A-Za-z_]+', '_', str(value)).strip('_').lower()
		return s or str(fallback)

	def _publish_view_with_bounds(self, ws_name, store, name, title, geom, conn, schema):
		"""Store‑ийн баазад байгаа view‑ийн extent/SRID‑ийг уншаад GeoServer‑т
		тодорхой bbox‑той featuretype болгон нийтэлнэ (SQL view дээр GeoServer bounds
		автоматаар тооцоолж чаддаггүй)."""
		srid, bbox = 0, None
		with conn.cursor() as cur:
			cur.execute(f'SELECT COALESCE(ST_SRID("{geom}"),0), '
						f'ST_XMin(e), ST_YMin(e), ST_XMax(e), ST_YMax(e) '
						f'FROM (SELECT "{geom}", ST_Extent("{geom}") OVER () e '
						f'FROM "{schema}"."{name}" WHERE "{geom}" IS NOT NULL LIMIT 1) t')
			row = cur.fetchone()
			if row:
				srid = row[0] or 0
				if row[1] is not None:
					bbox = {'minx': row[1], 'miny': row[2], 'maxx': row[3], 'maxy': row[4]}
		rest, auth = self._gs_rest(), self._gs_auth()
		srs = f'EPSG:{srid}' if srid else 'EPSG:4326'
		ft = {'name': name, 'nativeName': name, 'title': title or name, 'srs': srs}
		if bbox:
			ft['nativeBoundingBox'] = {**bbox, 'crs': srs}
			ft['latLonBoundingBox'] = {**bbox, 'crs': 'EPSG:4326'}
			ft['projectionPolicy'] = 'FORCE_DECLARED' if srid else 'NONE'
		return requests.post(
			f"{rest}/workspaces/{ws_name}/datastores/{store}/featuretypes",
			json={'featureType': ft}, auth=auth, timeout=30)

	@action(detail=True, methods=['post'], url_path='gs-create-grouped-view')
	def gs_create_grouped_view(self, request, *args, **kwargs):
		"""Сонгосон НЭГ талбарын утга бүрд ТУСДАА шүүсэн (filter) PG view үүсгээд
		layer болгон нийтэлнэ. Жишээ: adminunit дээр level_id сонгоход утга тус бүрээр
		(аймаг 22 мөр, сум 339 мөр, улс 1 мөр...) тусдаа давхарга үүснэ. View‑ууд нь
		ЭХ store‑ийн БААЗАД (жишээ nь basemap) үүснэ — Django‑ийн geoname баазад биш."""
		ws = self.get_object()
		src = (request.data.get('source') or '').strip()
		store = (request.data.get('store') or '').strip()
		field = (request.data.get('field') or '').strip()          # ангилах НЭГ талбар
		geom = (request.data.get('geom_field') or 'geom').strip()
		prefix = (request.data.get('prefix') or src).strip()
		if not self._IDENT_RE.match(src):
			return Response({'detail': 'Эх layer нэр буруу'}, status=400)
		if not self._IDENT_RE.match(field):
			return Response({'detail': 'Ангилах талбар буруу'}, status=400)
		if not store:
			return Response({'detail': 'store шаардлагатай'}, status=400)
		if not self._IDENT_RE.match(prefix):
			return Response({'detail': 'Угтвар нэр буруу (зөвхөн үсэг, тоо, _)'}, status=400)
		MAX_VIEWS = 100
		try:
			conn, schema = self._store_db(ws.name, store)
		except Exception as e:
			return Response({'detail': f'Store баазад холбогдож чадсангүй: {e}'}, status=502)
		from psycopg2 import sql as _sql
		created, errors = [], []
		try:
			conn.autocommit = True
			with conn.cursor() as cur:
				cur.execute(_sql.SQL('SELECT DISTINCT {f} FROM {s}.{t} '
									 'WHERE {f} IS NOT NULL ORDER BY 1').format(
					f=_sql.Identifier(field), s=_sql.Identifier(schema),
					t=_sql.Identifier(src)))
				values = [r[0] for r in cur.fetchall()]
			if not values:
				return Response({'detail': 'Тухайн талбарт утга алга'}, status=400)
			if len(values) > MAX_VIEWS:
				return Response({'detail': f'{len(values)} ялгаатай утга — хэт олон '
								 f'(дээд тал нь {MAX_VIEWS}). Бага ялгаатай талбар сонгоно уу.'},
								status=400)
			seen = set()
			for i, val in enumerate(values):
				vn = f'{prefix}_{self._slug_ident(val, i)}'
				while vn in seen:
					vn = f'{vn}_{i}'
				seen.add(vn)
				# 1) Шүүсэн view үүсгэх (утгыг sql.Literal‑ээр аюулгүй оруулна)
				with conn.cursor() as cur:
					cur.execute(_sql.SQL('DROP VIEW IF EXISTS {s}.{v} CASCADE').format(
						s=_sql.Identifier(schema), v=_sql.Identifier(vn)))
					cur.execute(_sql.SQL('CREATE VIEW {s}.{v} AS '
										 'SELECT * FROM {s}.{t} WHERE {f} = {val}').format(
						s=_sql.Identifier(schema), v=_sql.Identifier(vn),
						t=_sql.Identifier(src), f=_sql.Identifier(field),
						val=_sql.Literal(val)))
				# 2) GeoServer‑т нийтлэх
				rp = self._publish_view_with_bounds(
					ws.name, store, vn, f'{src}: {field}={val}', geom, conn, schema)
				if rp.status_code in (200, 201):
					created.append({'name': vn, 'value': val})
				else:
					errors.append({'name': vn, 'value': val,
								   'status': rp.status_code, 'body': rp.text[:150]})
		except Exception as e:
			return Response({'detail': f'View үүсгэхэд алдаа: {e}'}, status=400)
		finally:
			conn.close()
		return Response({'field': field, 'created': created, 'errors': errors,
						 'count': len(created)}, status=200)

	@action(detail=True, methods=['post'], url_path='gs-delete-view')
	def gs_delete_view(self, request, *args, **kwargs):
		"""Нийтэлсэн view‑layer‑ийг устгана: GeoServer featuretype + ws‑scoped style +
		store‑ийн баазад байгаа PG view. БАЗ хүснэгт (base table) бол зөвхөн unpublish
		хийж, өгөгдлийг УСТГАХГҮЙ (adminunit гэх мэт эх хүснэгтийг хамгаална)."""
		ws = self.get_object()
		store = (request.data.get('store') or '').strip()
		name = (request.data.get('name') or '').strip()
		if not store or not self._IDENT_RE.match(name):
			return Response({'detail': 'store ба зөв name шаардлагатай'}, status=400)
		rest, auth = self._gs_rest(), self._gs_auth()
		# 1) featuretype‑ийг GeoServer‑ээс хасах
		try:
			requests.delete(
				f"{rest}/workspaces/{ws.name}/datastores/{store}/featuretypes/{name}",
				params={'recurse': 'true'}, auth=auth, timeout=20)
		except requests.RequestException as e:
			return Response({'detail': f'GeoServer холбогдсонгүй: {e}'}, status=502)
		# 2) ws‑scoped style (name‑тэй ижил) байвал устгах
		try:
			requests.delete(f"{rest}/workspaces/{ws.name}/styles/{name}",
							params={'purge': 'true', 'recurse': 'true'}, auth=auth, timeout=15)
		except requests.RequestException:
			pass
		# 3) Store баазад VIEW бол устгах (base table бол хамгаална)
		dropped = False
		try:
			conn, schema = self._store_db(ws.name, store)
			try:
				conn.autocommit = True
				with conn.cursor() as cur:
					cur.execute("SELECT table_type FROM information_schema.tables "
								"WHERE table_schema=%s AND table_name=%s", [schema, name])
					row = cur.fetchone()
					if row and row[0] == 'VIEW':
						cur.execute(f'DROP VIEW IF EXISTS "{schema}"."{name}" CASCADE')
						dropped = True
			finally:
				conn.close()
		except Exception as e:
			return Response({'detail': f'Layer устсан ч view устсангүй: {e}',
							 'view_dropped': False}, status=200)
		return Response({'deleted': True, 'view_dropped': dropped}, status=200)

	# ==================================================================
	# GeoServer layer group (workspace‑scoped) — layer‑ийн эрэмбэ (давхаргын
	# дараалал)‑г удирдана. publishables.published массивын дараалал = зурах
	# дараалал (эхнийх нь доор, сүүлийнх нь дээр).
	# ==================================================================
	@action(detail=True, methods=['get'], url_path='gs-layergroups')
	def gs_layergroups(self, request, *args, **kwargs):
		ws = self.get_object()
		rest, auth = self._gs_rest(), self._gs_auth()
		out = []
		try:
			r = requests.get(f"{rest}/workspaces/{ws.name}/layergroups.json",
							 auth=auth, timeout=10)
			if r.status_code == 200:
				root = r.json().get('layerGroups') or ''
				items = (root.get('layerGroup') if isinstance(root, dict) else []) or []
				if isinstance(items, dict):
					items = [items]
				out = [{'name': it.get('name')} for it in items]
		except requests.RequestException as e:
			return Response({'detail': f'GeoServer холбогдсонгүй: {e}'}, status=502)
		return Response({'workspace': ws.name, 'results': out}, status=200)

	@action(detail=True, methods=['get'], url_path='gs-layergroup')
	def gs_layergroup(self, request, *args, **kwargs):
		ws = self.get_object()
		name = (request.query_params.get('name') or '').strip()
		rest, auth = self._gs_rest(), self._gs_auth()
		r = requests.get(f"{rest}/workspaces/{ws.name}/layergroups/{name}.json",
						 auth=auth, timeout=10)
		if r.status_code != 200:
			return Response({'detail': 'Layergroup олдсонгүй'}, status=404)
		lg = r.json().get('layerGroup') or {}
		pubs = ((lg.get('publishables') or {}).get('published')) or []
		if isinstance(pubs, dict):
			pubs = [pubs]
		styles = ((lg.get('styles') or {}).get('style')) or []
		if isinstance(styles, dict):
			styles = [styles]
		layers = []
		for i, p in enumerate(pubs):
			st = styles[i] if i < len(styles) else ''
			sname = (st.get('name') if isinstance(st, dict) else st) or None
			layers.append({'name': p.get('name'), 'style': sname})
		# GeoServer: эхний = доод давхарга. UI‑д эхний мөр = дээд болгохоор эргүүлнэ.
		layers.reverse()
		return Response({'name': lg.get('name'), 'mode': lg.get('mode') or 'SINGLE',
						 'title': lg.get('title'), 'layers': layers}, status=200)

	@action(detail=True, methods=['post'], url_path='gs-save-layergroup')
	def gs_save_layergroup(self, request, *args, **kwargs):
		"""Layer group үүсгэх/шинэчлэх. Ирсэн `layers` жагсаалтын дараалал = зурах
		дараалал. Style‑ийг layer‑ийн default‑аар (хоосон) үлдээнэ."""
		ws = self.get_object()
		name = (request.data.get('name') or '').strip()
		mode = (request.data.get('mode') or 'SINGLE').strip().upper()
		title = (request.data.get('title') or name).strip()
		layers = request.data.get('layers') or []
		if not self._IDENT_RE.match(name):
			return Response({'detail': 'Layergroup нэр буруу (зөвхөн үсэг, тоо, _)'}, status=400)
		if not layers:
			return Response({'detail': 'Дор хаяж нэг layer сонгоно'}, status=400)
		published, styles = [], []
		for ly in layers:
			lname = (ly.get('name') if isinstance(ly, dict) else ly) or ''
			lname = lname.strip()
			if not lname:
				continue
			if ':' not in lname:
				lname = f"{ws.name}:{lname}"
			published.append({'@type': 'layer', 'name': lname})
			styles.append('')  # layer‑ийн default style ашиглана
		# UI‑ийн эхний мөр = газрын зураг дээр ХАМГИЙН ДЭЭР (foreground) харагдана.
		# GeoServer‑т publishables‑ийн эхний элемент = хамгийн ДООД давхарга тул эргүүлнэ.
		published.reverse()
		styles.reverse()
		body = {'layerGroup': {
			'name': name, 'mode': mode, 'title': title,
			'workspace': {'name': ws.name},
			'publishables': {'published': published},
			'styles': {'style': styles},
		}}
		rest, auth = self._gs_rest(), self._gs_auth()
		chk = requests.get(f"{rest}/workspaces/{ws.name}/layergroups/{name}.json",
						   auth=auth, timeout=10)
		try:
			if chk.status_code == 200:
				r = requests.put(f"{rest}/workspaces/{ws.name}/layergroups/{name}",
								 json=body, auth=auth, timeout=20)
			else:
				r = requests.post(f"{rest}/workspaces/{ws.name}/layergroups",
								  json=body, auth=auth, timeout=20)
		except requests.RequestException as e:
			return Response({'detail': f'GeoServer холбогдсонгүй: {e}'}, status=502)
		if r.status_code not in (200, 201):
			return Response({'detail': f'Хадгалахад алдаа ({r.status_code})',
							 'body': r.text[:300]}, status=400)
		# Group‑ийн бүрэлдэхүүн/дараалал өөрчлөгдсөн тул GWC‑д кэшлэгдсэн хуучин
		# tile‑ууд хоцрогдоно — group болон доторх layer бүрийн кэшийг цэвэрлэнэ.
		_gwc_masstruncate(f"{ws.name}:{name}")
		for _p in published:
			_gwc_masstruncate(_p['name'])
		return Response({'saved': True, 'name': name}, status=200)

	@action(detail=True, methods=['post'], url_path='gs-delete-layergroup')
	def gs_delete_layergroup(self, request, *args, **kwargs):
		ws = self.get_object()
		name = (request.data.get('name') or '').strip()
		rest, auth = self._gs_rest(), self._gs_auth()
		try:
			requests.delete(f"{rest}/workspaces/{ws.name}/layergroups/{name}",
							auth=auth, timeout=20)
		except requests.RequestException as e:
			return Response({'detail': f'GeoServer холбогдсонгүй: {e}'}, status=502)
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
		# Ганц geoname_view архитектурт бүх нэр НЭГДСЭН geoname_types style‑аар
		# рендерлэгддэг (per-type view/style хассан). Тиймээс style засвар нь энэ
		# нэгдсэн style дээр хийгдэнэ (rule бүр type_id filter‑тэй).
		style_name = _GEONAME_TYPE_STYLE
		import xml.etree.ElementTree as ET
		import copy
		ET.register_namespace('sld', _SLD_NS)
		ET.register_namespace('ogc', _OGC_NS)
		ET.register_namespace('xlink', _XLINK_NS)
		tid = str(leaf.id)

		if request.method == 'GET':
			try:
				raw = _gs_style_read_sld(ws, style_name)
			except requests.RequestException as e:
				return Response({'detail': f'GeoServer SLD уншиж чадсангүй: {e}'}, status=502)
			# Нэгдсэн style дотроос ЗӨВХӨН энэ type_id‑ийн rule‑уудыг ялгаж, type_id
			# filter‑ийг нь хасаад (editor‑т цэвэрхэн) буцаана. Rule байхгүй бол хоосон.
			try:
				root = ET.fromstring(raw)
				new = ET.Element(f'{{{_SLD_NS}}}StyledLayerDescriptor', {'version': '1.0.0'})
				nl = ET.SubElement(new, f'{{{_SLD_NS}}}NamedLayer')
				ET.SubElement(nl, f'{{{_SLD_NS}}}Name').text = GEONAME_SEARCH_VIEW
				us = ET.SubElement(nl, f'{{{_SLD_NS}}}UserStyle')
				ET.SubElement(us, f'{{{_SLD_NS}}}Name').text = leaf.name or style_name
				fts = ET.SubElement(us, f'{{{_SLD_NS}}}FeatureTypeStyle')
				for r in root.iter(f'{{{_SLD_NS}}}Rule'):
					if tid in _rule_type_ids(r):
						rc = copy.deepcopy(r)
						flt = rc.find(f'{{{_OGC_NS}}}Filter')
						if flt is not None:
							rc.remove(flt)  # type_id filter‑ийг нуух (backend удирдана)
						fts.append(rc)
				out = ET.tostring(new, encoding='unicode')
			except Exception:
				out = raw  # задлаж чадаагүй бол бүтэн style
			# GeoStyler‑ийн parser‑т тохируулах (gs_layer_sld‑тэй ижил): dasharray‑ийн
			# ганц тоог зайтай хос болгоно (эс бол XML NUMBER болж geostyler .split() дээр
			# "h.split is not a function" алдаа өгдөг), Mark‑уудыг цэвэрлэж, SE 1.1 хэлбэрт.
			out = _sanitize_sld_marks(out)
			out = _fix_sld_dasharray(out)
			out = _sld_for_geostyler_read(out)
			out = _absolutize_sld_symbols(out, request)
			return Response({'sld': out, 'style_name': style_name, 'ws': ws,
							 'type_id': leaf.id}, status=200)

		# PUT — засагдсан rule‑уудыг нэгдсэн style‑д буцааж нэгтгэнэ
		edited = request.data.get('sld')
		if not edited:
			return Response({'detail': 'sld хоосон'}, status=400)
		edited = _localize_sld_symbols(edited)
		try:
			combined = ET.fromstring(_gs_style_read_sld(ws, style_name))
			ed = ET.fromstring(edited)
		except Exception as e:
			return Response({'detail': f'SLD задлаж чадсангүй: {e}'}, status=400)
		# 1) Энэ type‑ийн ХУУЧИН rule‑уудыг нэгдсэн style‑ээс хас
		for fts in combined.iter(f'{{{_SLD_NS}}}FeatureTypeStyle'):
			for rule in list(fts.findall(f'{{{_SLD_NS}}}Rule')):
				ids = _rule_type_ids(rule)
				if tid not in ids:
					continue
				if len(ids) == 1:
					fts.remove(rule)  # зөвхөн энэ type — устга
				else:
					_remove_type_eq(rule, tid)  # олон type — зөвхөн tid‑ийг хас
		# 2) Засагдсан rule‑уудыг type_id==tid filter‑тэй нэмнэ
		target = combined.find(f'.//{{{_SLD_NS}}}FeatureTypeStyle')
		if target is None:
			us = combined.find(f'.//{{{_SLD_NS}}}UserStyle')
			target = ET.SubElement(us, f'{{{_SLD_NS}}}FeatureTypeStyle')
		# Frontend GeoStyler нь SLD 1.1 (se: namespace) илгээдэг — Rule‑ийг namespace‑аас
		# үл хамааран (local name) олж, SLD 1.0 болгож хөрвүүлээд нэгтгэнэ.
		edited_rules = [el for el in ed.iter() if el.tag.split('}', 1)[-1] == 'Rule']
		for rule in edited_rules:
			rc = copy.deepcopy(rule)
			_normalize_rule_to_sld10(rc)
			_set_type_filter(rc, tid)
			target.append(rc)
		out = ET.tostring(combined, encoding='unicode')
		try:
			ET.fromstring(out)  # хамгаалалт: үр дүн зөв XML эсэх
		except Exception:
			return Response({'detail': 'Үр дүнгийн SLD буруу боллоо'}, status=400)
		try:
			_gs_style_write_sld(ws, style_name, out)
		except requests.RequestException as e:
			return Response({'detail': f'GeoServer‑т SLD хадгалж чадсангүй: {e}',
							 'body': getattr(e, 'response', None) and e.response.text}, status=502)
		try:
			_gwc_seed(f"{ws}:{GEONAME_SEARCH_VIEW}")
		except Exception:
			pass
		return Response({'style_name': style_name, 'ws': ws, 'saved': True,
						 'type_id': leaf.id}, status=200)

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

		data = []
		for c in qs:
			row = {
				'id': c.id, 'name': c.name, 'key': c.key, 'code': c.code,
				'label': c.label, 'color': c.color, 'desc': c.desc,
				'parent': c.parent_id, 'child_count': c.child_count,
			}
			# Level‑3 навч (хүүхэдгүй) → газрын зурагт харуулах эсэх (тогтвортой флаг).
			# gs_exists нэрийг хэвээр (frontend toggle уншдаг) — утга нь is_map_active.
			if level_has_leaves and c.child_count == 0:
				row['is_leaf'] = True
				row['view_name'] = geoname_type_view_name(c)
				row['gs_exists'] = c.is_map_active
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
		"""Ангиллыг газрын зурагт харуулах эсэхийг (is_map_active) хадгална.
		Урьд per-type GeoServer view үүсгэдэг байсан — одоо ганц geoname_view
		архитектурт зөвхөн флагийг хадгалж, модны харагдацыг удирдана."""
		try:
			if node.is_map_active != bool(active):
				node.is_map_active = bool(active)
				node.save(update_fields=['is_map_active'])
		except Exception:
			import logging
			logging.getLogger(__name__).warning("geoname apply_active failed", exc_info=True)

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


class BaseMapLayerViewSet(viewsets.ModelViewSet):
	"""Газрын зургийн СУУРЬ/НЭМЭЛТ давхаргын удирдлага (/settings/gis?tab=basemap).
	CRUD + GeoServer‑ээс сонгуулах жагсаалт + role‑оор шүүсэн map жагсаалт."""
	queryset = BaseMapLayer.objects.prefetch_related('roles').all()
	serializer_class = BaseMapLayerSerializer
	permission_classes = [IsAuthenticated]
	filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
	filterset_fields = ['layer_type', 'source_type', 'is_enabled']
	search_fields = ['key', 'label', 'gs_layer', 'workspace']
	ordering_fields = ['layer_type', 'sort_order', 'label', 'id']
	ordering = ['layer_type', 'sort_order', 'id']

	@action(detail=False, methods=['get'], url_path='available')
	def available(self, request):
		"""raster, base (болон ?ws=<нэр>) workspace‑ийн GeoServer давхаргууд —
		шинэ давхарга нэмэхэд сонгуулах. featuretype (вектор) + coverage (растер)."""
		rest, auth = _gs_rest_auth()
		wss = request.query_params.get('ws')
		workspaces = [wss] if wss else ['raster', 'basemap']
		out = []
		for ws in workspaces:
			for kind, root, node, gtype in (
				('featuretypes', 'featureTypes', 'featureType', 'vector'),
				('coverages', 'coverages', 'coverage', 'raster'),
			):
				try:
					r = requests.get(f"{rest}/workspaces/{ws}/{kind}.json",
									 auth=auth, timeout=10)
					if r.status_code != 200:
						continue
					items = (r.json().get(root) or {}).get(node) or []
					for it in items:
						nm = it.get('name')
						if not nm:
							continue
						out.append({
							'workspace': ws,
							'name': nm,
							'gs_layer': f"{ws}:{nm}",
							'geom_type': gtype,
						})
				except requests.RequestException:
					continue
			# Layer group‑ууд — нэг WMS давхарга болж нийтлэгддэг тул сонгуулна
			try:
				gr = requests.get(f"{rest}/workspaces/{ws}/layergroups.json",
								  auth=auth, timeout=10)
				if gr.status_code == 200:
					groot = gr.json().get('layerGroups') or ''
					gitems = (groot.get('layerGroup') if isinstance(groot, dict) else []) or []
					if isinstance(gitems, dict):
						gitems = [gitems]
					for it in gitems:
						nm = it.get('name')
						if not nm:
							continue
						out.append({
							'workspace': ws,
							'name': nm,
							'gs_layer': f"{ws}:{nm}",
							'geom_type': 'group',
						})
			except requests.RequestException:
				pass
		# gs_layer давхардлыг арилгах (жишээ nь featuretype ба layergroup ижил нэртэй)
		seen, deduped = set(), []
		for x in out:
			if x['gs_layer'] in seen:
				continue
			seen.add(x['gs_layer'])
			deduped.append(x)
		deduped.sort(key=lambda x: (x['workspace'], x['name']))
		return Response({'results': deduped}, status=200)

	@action(detail=False, methods=['get'], url_path='layer-extent')
	def layer_extent(self, request):
		"""?layer=<ws:name> → тухайн GeoServer давхаргын хил (EPSG:4326).
		Газрын зураг дээрх 'Zoom to Layer' цэсэнд ашиглана. featuretype →
		coverage → layergroup дарааллаар хайна."""
		full = (request.query_params.get('layer') or '').strip()
		if ':' not in full:
			return Response({'detail': 'layer=<ws:name> шаардлагатай'}, status=400)
		ws, name = full.split(':', 1)
		rest, auth = _gs_rest_auth()

		def _bbox(d, key):
			b = d.get(key) or {}
			try:
				return [float(b['minx']), float(b['miny']),
						float(b['maxx']), float(b['maxy'])]
			except (KeyError, TypeError, ValueError):
				return None

		for kind, node in (('featuretypes', 'featureType'),
						   ('coverages', 'coverage')):
			try:
				r = requests.get(f"{rest}/workspaces/{ws}/{kind}/{name}.json",
								 auth=auth, timeout=10)
				if r.status_code != 200:
					continue
				d = (r.json() or {}).get(node) or {}
				ext = _bbox(d, 'latLonBoundingBox') or _bbox(d, 'nativeBoundingBox')
				if ext:
					return Response({'extent': ext}, status=200)
			except requests.RequestException:
				continue
		try:
			r = requests.get(f"{rest}/workspaces/{ws}/layergroups/{name}.json",
							 auth=auth, timeout=10)
			if r.status_code == 200:
				d = (r.json() or {}).get('layerGroup') or {}
				ext = _bbox(d, 'bounds')
				if ext:
					return Response({'extent': ext}, status=200)
		except requests.RequestException:
			pass
		return Response({'detail': 'Давхаргын хил олдсонгүй'}, status=404)

	@action(detail=False, methods=['get'], url_path='for-map')
	def for_map(self, request):
		"""Хэрэглэгчийн role‑д тохирсон ИДЭВХТЭЙ давхаргууд (frontend газрын зураг).
		roles ХООСОН давхарга бүх хэрэглэгчид; утгатай бол зөвхөн тэр role‑той
		хэрэглэгчид харагдана."""
		user = request.user
		user_roles = set()
		if user and user.is_authenticated:
			user_roles = set(user.roles.values_list('id', flat=True))
		qs = (BaseMapLayer.objects.filter(is_enabled=True)
			  .prefetch_related('roles').order_by('layer_type', 'sort_order', 'id'))
		result = []
		for lyr in qs:
			role_ids = set(lyr.roles.values_list('id', flat=True))
			if role_ids and not (role_ids & user_roles):
				continue
			result.append(BaseMapLayerSerializer(lyr).data)
		return Response({'results': result}, status=200)
