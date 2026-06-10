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
	Layer,
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
	LayerSerializer,
	LayerCreateOrUpdateSerializer,
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
        "    json_build_array(t.parent_id, g.type_id) AS type,\n"
        "    COALESCE((SELECT json_agg(gn.nomek_id ORDER BY gn.nomek_id)\n"
        "              FROM core_geoname_nomek gn WHERE gn.geoname_id = g.id), '[]'::json) AS nomek,\n"
        "    COALESCE((SELECT json_agg(go.legalorder_id ORDER BY go.legalorder_id)\n"
        "              FROM core_geoname_orders go WHERE go.geoname_id = g.id), '[]'::json) AS orders\n"
        "FROM core_geoname g LEFT JOIN core_constant t ON t.id = g.type_id\n"
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
    g.type_id, t.parent_id AS type_l2, t2.parent_id AS type_l1,
    json_build_array(t.parent_id, g.type_id) AS type,
    COALESCE(' '||(SELECT string_agg(gu.adminunit_id::text,' ') FROM core_geoname_unit gu WHERE gu.geoname_id=g.id)||' ','') AS unit_ids,
    COALESCE((SELECT string_agg(n.nomek,' ') FROM core_geoname_nomek gn JOIN core_nomek n ON n.id=gn.nomek_id WHERE gn.geoname_id=g.id),'') AS nomek_codes,
    COALESCE((SELECT json_agg(gn.nomek_id) FROM core_geoname_nomek gn WHERE gn.geoname_id=g.id),'[]'::json) AS nomek,
    COALESCE((SELECT json_agg(go.legalorder_id) FROM core_geoname_orders go WHERE go.geoname_id=g.id),'[]'::json) AS orders
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

	@action(detail=False, methods=['get'], url_path='tree')
	def tree(self, request):
		"""Нэрийн ангиллын мод — key‑ээр үндсэн төрөл, parent‑аар дэд ангилал.
		Мөр бүрт child_count."""
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
		data = [{
			'id': c.id, 'name': c.name, 'key': c.key, 'code': c.code,
			'label': c.label, 'color': c.color, 'desc': c.desc,
			'parent': c.parent_id, 'child_count': c.child_count,
		} for c in qs]
		return Response({"results": data}, status=200)

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

	def perform_create(self, serializer):
		parent = serializer.validated_data.get('parent')
		instance = serializer.save(key='GEONAME_TYPES')
		# Шинэ зангилаа навч → view үүснэ; parent нь навч биш боллоо → view устна
		self._sync_one_geoname(instance)
		self._drop_parent_view(parent)

	def perform_update(self, serializer):
		node = serializer.instance
		old_name = geoname_type_view_name(node) if node else None  # хуучин код‑оор
		instance = serializer.save()
		self._sync_one_geoname(instance, old_name=old_name)

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

class LayerViewSet(PublicListMixin, viewsets.ModelViewSet):
	queryset = Layer.objects.select_related("table", "store").all()
	serializer_class = LayerSerializer
	filterset_class = GlobalFilter
	permission_classes = [IsAuthenticated]
	filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
	parser_classes = [JSONParser, MultiPartParser, FormParser]
	ordering_fields = [f.name for f in Layer._meta.fields]+['table__name']
	def get_serializer_class(self):
		if self.action in ('create', 'update', 'partial_update'):
			return LayerCreateOrUpdateSerializer
		return LayerSerializer
	@transaction.atomic
	def create(self, request, *args, **kwargs):
		serializer=self.get_serializer(data=request.data)
		serializer.is_valid(raise_exception=True)
		instance=serializer.save()
		instance.name=instance.table.desc
		workspace = instance.store.parent.name
		store=instance.store.name
		layer_name = instance.table.desc  # layer нэр
		instance.url = (
			f"{settings.GEOSERVER_URL}/{workspace}/wms?"
			f"service=WMS&version=1.1.0&request=GetMap&bbox=97.5,41,120,52"
			f"&layers={workspace}:{layer_name}"
			f"&srs=EPSG:4326&width=768&height=330&format=image/png"
		)
		instance.save()
		if instance.is_published:
			try:
				geo.delete_layer(layer_name=layer_name, workspace=instance.store.parent.name)
			except Exception as e:
				import logging
				logging.getLogger(__name__).warning("Failed to delete existing layer before publish", exc_info=e)
		try:
			if instance.is_raster:
				geo.create_coveragestore(workspace=workspace, layer_name=instance.name, path=r'/var/monpos/geoserver/data_dir/workspaces/point/tif/l48.tif')
			geo.publish_featurestore(workspace=workspace, store_name=store,title=instance.name, pg_table=instance.table.desc)
		except Exception as e:
			# pass
			return Response({'result': f'Геосерверт {e} алдаа гарлаа.'}, status=400)
		try:
			geom_type = (instance.table.code or "").lower()
			style_name = create_default_style_and_assign(
				workspace=workspace, layer_name=layer_name, geom_type=geom_type
			)
			print("Created/updated style:", style_name, geom_type)
		except Exception as e:
			return Response({"result": f"Default style үүсгэхэд алдаа: {e}"}, status=400)
		return Response({'results': serializer.data}, status=200)

	@action(detail=False, methods=['get'], url_path='geoserver')
	def geoserver(self, request, *args, **kwargs):
		features = Layer.objects.filter(is_published=True,name="point").order_by("id")
		results = []
		for feat in features:
			node = OrderedDict()
			node["name"] = (
				feat.table.name if getattr(feat, "table", None) and feat.table
				else (feat.store.name if getattr(feat, "store", None) and feat.store else "Layer")
			)
			node["url"] = feat.url or ""
			node["id"]  = feat.id

			children = []
			if feat.rules.exists():
				total = 0
				qs = feat.rules.filter(is_visible=True).exclude(render_mode='text')
				for rule in qs:
					rule_name = rule.name.split("-symbol")[0] or "Rule"
					item = {"name": rule_name, "id": rule.id}
					count = 0
					filters = getattr(rule, "filters", None) or []
					if filters and isinstance(filters, list) and len(filters) > 0:
						first = filters[0] or {}
						const_id = first.get("value")
						const = Constant.objects.filter(id=const_id).first()
						count = 0  # Measurement модель энэ project‑д байхгүй
						if const and const.desc and feat.name == "point" and count > 0:						
							total += count
							item["parent"] = const.parent.name if const and const.parent else None
							item["count"] = count
							item['layer']=const.desc
					cql = _build_cql_from_filters_json(getattr(rule, "filters", None), getattr(rule, "join_op", "AND"))
					if cql:
						item["cql_filter"] = cql
					if item.get("layer"):
						children.append(item)
				if children:
					node["count"] = total
					grouped = defaultdict(list)
					for it in children:
						key = it.pop("parent", None)
						grouped[key or None].append(it)
					new_children = []
					has_parent_groups = any(k is not None for k in grouped.keys())
					if has_parent_groups:
						for key, items in grouped.items():
							if key is not None:
								new_children.append({
									"type": "group",
									"name": key,
									"children": items,
								})
						if grouped.get(None):
							new_children.extend(grouped[None])
					else:
						new_children = grouped.get(None, children)
					new_children.sort(key=lambda x: (0 if x.get("type") == "group" else 1, x.get("name", "")))
					node["children"] = new_children
			results.append(node)
		return Response({"results": results})
	@action(detail=False, methods=['get'], url_path='baselayers')
	def baselayers(self, request, *args, **kwargs):
		features = Layer.objects.filter(is_published=True).exclude(name="point").order_by("id")
		results = []
		for feat in features:
			node = OrderedDict()
			node["name"] = (
				feat.table.name if getattr(feat, "table", None) and feat.table
				else (feat.store.name if getattr(feat, "store", None) and feat.store else "Layer")
			)
			node["url"] = feat.url or ""
			node["id"]  = feat.id
			children = []
			if feat.rules.exists():
				total = 0
				qs = feat.rules.filter(is_visible=True).exclude(render_mode='text')
				for rule in qs:
					rule_name = rule.name.split("-symbol")[0] or "Rule"
					item = {"name": rule_name, "id": rule.id}

					# parent / count
					filters = getattr(rule, "filters", None) or []
					if filters and isinstance(filters, list) and len(filters) > 0:
						first = filters[0] or {}
						const_id = first.get("value")
						if const_id and feat.name == "point":
							const = Constant.objects.filter(id=const_id).first()
							count = 0  # Measurement модель энэ project‑д байхгүй
							total += count
							item["parent"] = const.parent.name if const and const.parent else None
							item["count"] = count

					cql = _build_cql_from_filters_json(getattr(rule, "filters", None), getattr(rule, "join_op", "AND"))
					if cql:
						item["cql_filter"] = cql

					children.append(item)
				if children:
					node["count"] = total
					grouped = defaultdict(list)
					for it in children:
						key = it.pop("parent", None)
						grouped[key or None].append(it)
					new_children = []
					has_parent_groups = any(k is not None for k in grouped.keys())
					if has_parent_groups:
						for key, items in grouped.items():
							if key is not None:
								new_children.append({
									"type": "group",
									"name": key,
									"children": items,
								})
						if grouped.get(None):
							# 'Бүлэггүй' групп үүсгэхгүй, шулуугаараа нэмнэ
							new_children.extend(grouped[None])
					else:
						new_children = grouped.get(None, children)

					new_children.sort(key=lambda x: (0 if x.get("type") == "group" else 1, x.get("name", "")))
					node["children"] = new_children

			results.append(node)
		return Response({"results": results})
	@action(detail=False, methods=['get'], url_path='attributes')
	def attributes(self, request, *args, **kwargs):
		layerId=request.query_params.get('layerId')
		layer=Layer.objects.get(id=layerId)
		feature_type_name = layer.table.desc
		workspace = layer.store.parent.name
		store_name = layer.store.name
		attrs=geo.get_feature_attribute(feature_type_name, workspace, store_name)
		contants=Constant.objects.filter(key='GSCONSTANTS', name__in=attrs).order_by('parent__id')
		data=ConstantSerializer(contants, many=True).data
		return Response({'results': attrs}, status=200)
	
	@action(detail=False, methods=['get'], url_path='stylefields')
	def stylefields(self, request, *args, **kwargs):
		layerId=request.query_params.get('layerId')
		layer=Layer.objects.get(id=layerId)
		feature_type_name = layer.table.desc
		workspace = layer.store.parent.name
		store_name = layer.store.name
		attrs=geo.get_feature_attribute(feature_type_name, workspace, store_name)
		return Response({'results': attrs}, status=200)
	@action(detail=False, methods=['get'], url_path='layers')
	def layers(self, request, *args, **kwargs):
		stId=request.query_params.get('stId')
		store=Constant.objects.get(id=stId)
		workspace = store.parent.name
		store_name =store.name
		layers=geo.get_featurestore(store_name,workspace)
		return Response({'results': layers}, status=200)
	def destroy(self, request, *args, **kwargs):
		instance = self.get_object()
		try:
			geo.delete_layer(layer_name=instance.table.desc, workspace=instance.store.parent.name)
		except Exception as e:
			import logging
			logging.getLogger(__name__).warning("Failed to delete layer in GeoServer", exc_info=e)
		instance.delete()
		return Response(status=status.HTTP_204_NO_CONTENT)

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
	ordering_fields = [f.name for f in StyleRule._meta.fields] + ["style_id"]
	def get_queryset(self):
		qs = super().get_queryset()
		style_id = self.request.query_params.get("style")
		return qs.filter(style_id=style_id) if style_id else qs

	@transaction.atomic
	def create(self, request, *args, **kwargs):
		ser = self.get_serializer(data=request.data)
		ser.is_valid(raise_exception=True)
		rule = ser.save()
		rule.symbolizer = rule.layer.table.code or 'polygon'
		rule.save()
		if rule.render_mode == 'symbol':
			rule.name=f'{rule.name}-symbol'
		elif rule.render_mode == 'text':
			rule.name=f'{rule.name}-label'
		else:
			rule.name=f"{rule.name}-full"
		rule.save()
		layer = rule.layer
		ws = layer.store.parent.name
		sld_file = Path(f"{settings.GEOSERVER_DATA_DIR}/workspaces/{ws}/styles/{layer.name}.sld")

		with open(sld_file, "r", encoding="utf-8") as f:
			sld_xml = f.read()

		# --- icon файлыг GeoServer styles/symbols руу хуулна ---
		styles_dir = Path(settings.GEOSERVER_DATA_DIR) / "workspaces" / ws / "styles"
		target_dir = styles_dir / "symbols"
		target_dir.mkdir(parents=True, exist_ok=True)

		icon_abs = None
		if rule.icon and getattr(rule.icon, "path", None):
			basename = os.path.basename(rule.icon.name)
			dst = target_dir / basename
			try:
				if dst.exists():
					dst.unlink()
				shutil.copy2(rule.icon.path, dst)
				# GeoServer-д зөв: absolute file:// URL
				icon_abs = f"file://{dst.as_posix()}"
			except Exception as e:
				print(f"[WARN] icon copy failed: {e}")
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
		with open(sld_file, "w", encoding="utf-8") as f:
			f.write(new_xml)
		try:
			status_resp = geo.reload()
		except requests.RequestException as e:
			return Response(
				{
					"error": "GeoServer reload failed",
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
		layer = rule.layer
		ws = layer.store.parent.name
		sld_file = Path(f"{settings.GEOSERVER_DATA_DIR}/workspaces/{ws}/styles/{layer.name}.sld")
		with open(sld_file, "r", encoding="utf-8") as f:
			sld_xml = f.read()
		styles_dir = Path(settings.GEOSERVER_DATA_DIR) / "workspaces" / ws / "styles"
		target_dir = styles_dir / "symbols"
		target_dir.mkdir(parents=True, exist_ok=True)
		icon_abs = None
		if rule.icon and getattr(rule.icon, "path", None):
			basename = os.path.basename(rule.icon.name)
			dst = target_dir / basename
			try:
				if dst.exists():
					dst.unlink()
				shutil.copy2(rule.icon.path, dst)
				# GeoServer-д зөв: absolute file:// URL
				icon_abs = f"file://{dst.as_posix()}"
			except Exception as e:
				print(f"[WARN] icon copy failed: {e}")

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
			new_xml, removed = delete_rule_in_sld_xml(
				sld_xml,
				rule_name=str(rule.id).strip(),  # SLD дээр <sld:Name> нь rule.id байгааг та хэлсэн
				prune_empty=True,
			)
			sld_file.write_text(new_xml, encoding="utf-8")
			with open(sld_file, "r", encoding="utf-8") as f:
				sld_xml = f.read()
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

		# --- SLD хадгалах ---
		with open(sld_file, "w", encoding="utf-8") as f:
			f.write(new_xml)


		return Response(self.get_serializer(rule).data, status=status.HTTP_200_OK)

	@transaction.atomic
	def destroy(self, request, *args, **kwargs):
		rule = self.get_object()
		layer = rule.layer
		ws = layer.store.parent.name
		sld_file = Path(f"{settings.GEOSERVER_DATA_DIR}/workspaces/{ws}/styles/{layer.name}.sld")
		removed = 0
		if sld_file.exists():
			sld_xml = sld_file.read_text(encoding="utf-8")
			new_xml, removed = delete_rule_in_sld_xml(
				sld_xml,
				rule_name=str(rule.id).strip(),  # SLD дээр <sld:Name> нь rule.id байгааг та хэлсэн
				prune_empty=True,
			)
			sld_file.write_text(new_xml, encoding="utf-8")
			try:
				geo.reload()
			except Exception as exc:
				import logging
				logging.getLogger(__name__).warning("GeoServer reload failed during StyleRule destroy", exc_info=exc)
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
