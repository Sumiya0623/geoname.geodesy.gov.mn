import math

from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q, Subquery, OuterRef
from django.contrib.gis.geos import Point, GEOSGeometry

from core.models import Constant, GeoName, AdminUnit, Nomek, ReCount
from core.mixin import PublicListMixin
from core.filters import GlobalFilter
from portal.auth import function_permission

from .serializers import GeoNameSerializer, GeoNameFullSerializer, GeoNameDropSerializer


def descendant_type_ids(type_id):
	"""type_id + бүх удам (GEONAME_TYPES мод бүтэц)."""
	try:
		ids = [int(type_id)]
	except (TypeError, ValueError):
		return []
	frontier = list(ids)
	while frontier:
		children = list(
			Constant.objects.filter(parent_id__in=frontier)
			.exclude(id__in=ids)
			.values_list('id', flat=True)
		)
		if not children:
			break
		ids.extend(children)
		frontier = children
	return ids


def descendant_unit_ids(unit_id):
	"""unit_id + бүх удам (AdminUnit мод: аймаг→сум→баг)."""
	try:
		ids = [int(unit_id)]
	except (TypeError, ValueError):
		return []
	frontier = list(ids)
	while frontier:
		children = list(
			AdminUnit.objects.filter(parent_id__in=frontier)
			.exclude(id__in=ids)
			.values_list('id', flat=True)
		)
		if not children:
			break
		ids.extend(children)
		frontier = children
	return ids


class GeoNameViewSet(PublicListMixin, viewsets.ModelViewSet):
	"""Газар зүйн нэр (GeoName) — CRUD, хуудаслалт, хайлт, сорттой.

	- ?type=<id> → тухайн төрөл БА түүний бүх удмын GeoName‑ууд (карт сонгоход)
	- ?search=... → нэр, дугаараар хайна
	"""
	serializer_class = GeoNameSerializer
	queryset = GeoName.objects.all()
	permission_classes = function_permission('geoname')
	filterset_class = GlobalFilter
	filter_backends = [DjangoFilterBackend, filters.OrderingFilter, filters.SearchFilter]
	search_fields = ['name', 'number']
	# Модел талбарууд + холбоост (төрлийн нэр, эх сурвалжийн итгэл/төлөв)
	ordering_fields = [f.name for f in GeoName._meta.fields] + [
		'type__name', 'sources__confidence', 'sources__needs_review',
		'aimag_name', 'sum_name']
	ordering = ['-created_date']

	def get_queryset(self):
		qs = GeoName.objects.select_related('type', 'user').prefetch_related(
			'sources', 'unit', 'unit__level')
		# Аймаг/сумаар сортлоход — түвшингээр шүүсэн нэрийг annotate (M2M давхардлаас сэргийлж Subquery)
		aimag_sq = AdminUnit.objects.filter(
			unitnames=OuterRef('pk'), level__name='Аймаг/Нийслэл').order_by('unit').values('unit')[:1]
		sum_sq = AdminUnit.objects.filter(
			unitnames=OuterRef('pk'), level__name='Сум/Дүүрэг').order_by('unit').values('unit')[:1]
		qs = qs.annotate(aimag_name=Subquery(aimag_sq), sum_name=Subquery(sum_sq))
		p = self.request.query_params
		# Картын төрөл / ангилал (удам багтаана)
		type_id = p.get('type', None)
		if type_id:
			qs = qs.filter(type_id__in=descendant_type_ids(type_id))
		# Батлагдсан эсэх (true/false)
		approved = p.get('is_approved', None)
		if approved in ('true', 'True', '1'):
			qs = qs.filter(is_approved=True)
		elif approved in ('false', 'False', '0'):
			qs = qs.filter(is_approved=False)
		# Импортын эх сурвалж: хянах шаардлагатай эсэхээр шүүх
		review = p.get('needs_review', None)
		if review in ('true', 'True', '1'):
			qs = qs.filter(sources__needs_review=True).distinct()
		elif review in ('false', 'False', '0'):
			qs = qs.filter(sources__needs_review=False).distinct()
		# Дэлгэрэнгүй хайлт: засаг захиргааны нэгж (удам багтаана)
		unit_tree = p.get('unit_tree', None)
		if unit_tree:
			qs = qs.filter(unit__id__in=descendant_unit_ids(unit_tree)).distinct()
		# Дахин тооллогын таб: тухайн төсөл/үе шатанд АЛЬ ХЭДИЙН бүртгэгдсэн нэрсийг
		# хайлтын жагсаалтаас хасна (устгавал буцаж орно).
		excl_project = p.get('exclude_recount_project', None)
		if excl_project:
			rc = ReCount.objects.filter(project_id=excl_project)
			excl_step = p.get('exclude_recount_step', None)
			if excl_step:
				rc = rc.filter(step_id=excl_step)
			# name_id=NULL (шинэ нэр/draft/байршил) мөрүүдийг хасахгүй — эс бөгөөс
			# id__in доторх NULL улмаас NOT IN бүх мөрийг хоослодог (SQL NULL алдаа).
			excl_ids = rc.exclude(name_id__isnull=True).values_list('name_id', flat=True)
			qs = qs.exclude(id__in=excl_ids)
		# ЗЗ нэгжээр СПАТИАЛ шүүх (нэгжийн геометр дотор багтах geoname).
		# 'unit_geom' param — GlobalFilter‑ийн 'unit' (M2M гишүүнчлэл) filter‑тэй
		# мөргөлдөхгүй (тэр нь AND хийж хоослодог).
		unit = p.get('unit_geom', None)
		if unit:
			au = AdminUnit.objects.filter(id=unit).exclude(geom__isnull=True).first()
			if au:
				qs = qs.filter(geoloc__intersects=au.geom)
			else:
				qs = qs.filter(unit__id__in=descendant_unit_ids(unit)).distinct()
		# Дэлгэрэнгүй хайлт: нэрлэвэр (М-46-22 гэх мэт код)
		# Зураасны тоогоор масштабыг тогтооно — зөвхөн 1:100000 (2 зураас),
		# 1:25000 (4 зураас). Тухайн код+масштабтай Nomek‑ийн geom‑той
		# огтлолцож буй GeoName‑уудыг буцаана.
		nomek = p.get('nomek', None)
		if nomek and nomek.strip():
			qs = self._filter_by_nomek(qs, nomek.strip())
		# Байршлаар хайх — дүрс (polygon GeoJSON) огтлолцол
		geom_raw = p.get('geom', None)
		if geom_raw:
			try:
				poly = GEOSGeometry(geom_raw)
				if not poly.srid:
					poly.srid = 4326
				qs = qs.filter(geoloc__intersects=poly)
			except Exception:
				pass
		# Дэлгэрэнгүй хайлт: солбицол — цэг + радиус (метрээр). radius_meter
		# байхгүй бол ~1.1км (0.01°) гэж үзнэ.
		lat, lon = p.get('lat', None), p.get('lon', None)
		if lat not in (None, '') and lon not in (None, ''):
			try:
				pt = Point(float(lon), float(lat), srid=4326)
				r_m = p.get('radius_meter', None)
				if r_m not in (None, ''):
					# 4326 (градус) талбарт метрийг ойролцоо градус болгоно
					deg = float(r_m) / 111320.0
				else:
					deg = 0.01
				qs = qs.filter(geoloc__dwithin=(pt, deg))
			except (TypeError, ValueError):
				pass
		return qs

	# Хайлт/онооход ашиглах масштабууд (1:100000, 1:25000)
	NOMEK_SCALES = ('M1:100000', 'M1:25000')
	# Зураасны тоо → масштабын нэр (зөвхөн эдгээр дээр хайна)
	NOMEK_SCALE_BY_DASH = {2: 'M1:100000', 4: 'M1:25000'}
	# Кирилл том үсэг → латин (нэрлэврийн М, А, В... = M, A, B...)
	CYR2LAT = str.maketrans('МАВЕКНОРСТХ', 'MABEKHOPCTX')

	def _filter_by_nomek(self, qs, code):
		dashes = code.count('-')
		scale_name = self.NOMEK_SCALE_BY_DASH.get(dashes)
		# Зөвшөөрөгдөөгүй масштаб (зураасны тоо) → үр дүн байхгүй
		if not scale_name:
			return qs.none()
		code_norm = code.translate(self.CYR2LAT)
		# GeoName‑ийн nomek (M2M) талбарт агуулагдах нэрлэврээс л шүүнэ
		return qs.filter(
			Q(nomek__nomek__iexact=code) | Q(nomek__nomek__iexact=code_norm),
			nomek__scale__key='MAPSCALES', nomek__scale__name=scale_name,
		).distinct()

	def _assign_nomeks(self, instance):
		"""geoloc‑той огтлолцох нэрлэврүүдийг (1:100000, 1:25000) M2M‑д онооно."""
		if not instance.geoloc:
			instance.nomek.clear()
			return
		ids = list(
			Nomek.objects.filter(
				scale__key='MAPSCALES',
				scale__name__in=self.NOMEK_SCALES,
				geom__intersects=instance.geoloc,
			).values_list('id', flat=True)
		)
		instance.nomek.set(ids)

	def _assign_units(self, instance):
		"""geoloc‑той огтлолцох засаг захиргааны нэгжүүдийг (аймаг/сум/баг) M2M‑д онооно."""
		if not instance.geoloc:
			instance.unit.clear()
			return
		ids = list(
			AdminUnit.objects.filter(
				geom__intersects=instance.geoloc,
			).values_list('id', flat=True)
		)
		instance.unit.set(ids)

	def get_serializer_class(self):
		# Дэлгэрэнгүй (retrieve) үед бүрэн serializer
		if self.action == 'retrieve':
			return GeoNameFullSerializer
		return GeoNameSerializer

	def perform_create(self, serializer):
		user = self.request.user if self.request.user.is_authenticated else None
		instance = serializer.save(user=user)
		# Дугаарыг GeoName.save() өөрөө үүсгэнэ (level codes + id)
		# Огтлолцох нэрлэвэр болон засаг захиргааны нэгжийг автоматаар онооно
		self._assign_nomeks(instance)
		self._assign_units(instance)

	def perform_update(self, serializer):
		instance = serializer.save()
		# Геометр өөрчлөгдсөн бол нэрлэвэр/нэгжийг дахин онооно
		self._assign_nomeks(instance)
		self._assign_units(instance)

	@action(detail=False, methods=['get'], url_path='types',
			permission_classes=[IsAuthenticated])
	def types(self, request):
		"""Үндсэн (parent байхгүй) GEONAME_TYPES — картууд.
		geoname_count = тухайн төрөл болон удам дахь GeoName тоо."""
		tops = Constant.objects.filter(
			key='GEONAME_TYPES', parent__isnull=True
		).order_by('code', 'id')
		# Эхэнд "Нийт" карт — бүх GeoName
		cards = [{
			'id': '',
			'name': 'Нийт',
			'code': '',
			'color': '',
			'geoname_count': GeoName.objects.count(),
		}]
		for t in tops:
			ids = descendant_type_ids(t.id)
			cards.append({
				'id': t.id,
				'name': t.name,
				'code': t.code,
				'color': t.color,
				'geoname_count': GeoName.objects.filter(type_id__in=ids).count(),
			})
		return Response({'results': cards}, status=200)

	@action(detail=False, methods=['get'], url_path='dropdown',
			permission_classes=[IsAuthenticated])
	def dropdown(self, request, *args, **kwargs):
		"""Газар зүйн нэр сонголт (FK dropdown) — нэр/дугаар, ЗЗ нэгж (удам), нэрийн
		ангилал (удам)‑аар шүүнэ."""
		p = request.query_params
		qs = GeoName.objects.all().order_by('name')
		search = p.get('search')
		if search:
			qs = qs.filter(Q(name__icontains=search) | Q(number__icontains=search))
		unit = p.get('unit')
		if unit:
			# Спатиал хайлт: тухайн ЗЗ нэгжийн ГЕОМЕТР дотор багтах/огтлолцох
			# geoname‑ууд (unit_tree=<id>‑ийн geom). Геомгүй бол M2M гишүүнчлэлээр.
			au = AdminUnit.objects.filter(id=unit).exclude(geom__isnull=True).first()
			if au:
				qs = qs.filter(geoloc__intersects=au.geom)
			else:
				qs = qs.filter(unit__id__in=descendant_unit_ids(unit)).distinct()
		type_id = p.get('type')
		if type_id:
			qs = qs.filter(type_id__in=descendant_type_ids(type_id))
		return Response(
			{'results': GeoNameDropSerializer(qs[:50], many=True).data}, status=200)


# ==================== Хэвлэлийн эх (PrintMap / raster) ====================
from django.contrib.gis.db.models import Union as _GisUnion
from django.core.files.base import ContentFile
from core.models import PrintMap
from .serializers import PrintMapSerializer
from . import mapprint

AIMAG_LVL = 'Аймаг/Нийслэл'
SUM_LVL = 'Сум/Дүүрэг'


def _union_geom(unit_ids):
    """Сонгосон нэгжүүдийн геометрийн нэгдэл (union)."""
    if not unit_ids:
        return None
    agg = AdminUnit.objects.filter(id__in=unit_ids).exclude(
        geom__isnull=True).aggregate(u=_GisUnion('geom'))
    return agg.get('u')


def _linestring_chain(geom):
    """(Multi)LineString/GeometryCollection → хамгийн урт цувралын [[lon,lat],...]."""
    if geom is None:
        return []
    try:
        if geom.empty:
            return []
    except Exception:
        pass
    gt = geom.geom_type
    if gt == 'LineString':
        return [[round(x, 6), round(y, 6)] for x, y in geom.coords]
    best, blen = None, -1.0
    try:
        for g in geom:
            if 'LineString' in g.geom_type and not g.empty:
                if g.length > blen:
                    blen, best = g.length, g
    except Exception:
        return []
    if best is None:
        return []
    return [[round(x, 6), round(y, 6)] for x, y in best.coords]


def _shared_border_dense(union, neighbor, step=0.0018, near=0.0035):
    """union-ий хилийг НЯГТ алхаж (step≈200м), хөршийн buffer дотор унах
    ТАСРАЛТГҮЙ хамгийн урт хэсгийг [[lon,lat],...] болгож буцаана. intersection-ийн
    chord (хилийн curve огтолсон урт segment) асуудлыг бүрэн арилгана."""
    try:
        ring = union.boundary
        lines = [ring] if ring.geom_type == 'LineString' else list(ring)
        nb_buf = neighbor.buffer(near)
        best = []
        for line in lines:
            length = line.length
            if not length:
                continue
            cur = []
            d = 0.0
            while d <= length:
                p = line.interpolate(d)
                if nb_buf.contains(p):
                    cur.append([round(p.x, 6), round(p.y, 6)])
                else:
                    if len(cur) > len(best):
                        best = cur
                    cur = []
                d += step
            if len(cur) > len(best):
                best = cur
        return best
    except Exception:
        return []


def _bordering_units(union_geom, level_name, exclude_ids):
    """union-ий ГАДНА талд хил залгаа нэгжүүд (ижил түвшин, сонгосныг хасна).
    Топологийн зөрүүг тэвчихийн тулд dwithin (~300м) ашиглана."""
    if union_geom is None:
        return []
    return list(AdminUnit.objects.filter(level__name=level_name)
                .exclude(id__in=exclude_ids).exclude(geom__isnull=True)
                .filter(geom__dwithin=(union_geom, 0.003))
                .select_related('parent'))


def _adjacent_by_direction(union_geom, borders):
    """Хил залгаа нэгжүүдийг чиглэлээр (N/S/E/W) хамгийн ойроор нь хуваарилна."""
    out = {'north': None, 'south': None, 'east': None, 'west': None}
    if union_geom is None:
        return out
    cc = union_geom.centroid
    best = {}
    for b in borders:
        bc = b.geom.centroid
        dx, dy = bc.x - cc.x, bc.y - cc.y
        d = (dx * dx + dy * dy) ** 0.5
        key = ('east' if dx > 0 else 'west') if abs(dx) >= abs(dy) else (
            'north' if dy > 0 else 'south')
        if key not in best or d < best[key][0]:
            best[key] = (d, b.unit)
    for k, v in best.items():
        out[k] = v[1]
    return out


def _build_title(units):
    """'<Аймаг> аймгийн <Сум1>, <Сум2> сумын газар зүйн нэрийн зураг' (авто)."""
    parents, sums = [], []
    for u in units:
        sums.append(u.unit)
        if u.parent_id and u.parent.unit not in parents:
            parents.append(u.parent.unit)
    if parents:
        return f"{', '.join(parents)} аймгийн {', '.join(sums)} сумын газар зүйн нэрийн зураг"
    return f"{', '.join(sums)} аймгийн газар зүйн нэрийн зураг"


def _geom_rings(geom):
    """GEOS геометр → гадаад цагиргуудын [[lon,lat],...] жагсаалт (хялбарчилсан)."""
    if geom is None:
        return []
    try:
        g = geom.simplify(0.001, preserve_topology=True) or geom
    except Exception:
        g = geom
    polys = list(g) if g.geom_type == 'MultiPolygon' else [g]
    out = []
    for poly in polys:
        try:
            coords = poly.exterior_ring.coords
        except Exception:
            continue
        out.append([[round(x, 6), round(y, 6)] for x, y in coords])
    return out


def _geom_clip_polys(geom):
    """GEOS геометр → [{'exterior': [[lon,lat],...], 'holes': [[[lon,lat],...]]}]
    (нүхтэй полигонуудыг хадгална — PIL clip mask-д ашиглана)."""
    if geom is None:
        return []
    try:
        g = geom.simplify(0.0015, preserve_topology=True) or geom
    except Exception:
        g = geom
    polys = list(g) if g.geom_type == 'MultiPolygon' else [g]
    out = []
    for poly in polys:
        try:
            ext = [[round(x, 6), round(y, 6)]
                   for x, y in poly.exterior_ring.coords]
        except Exception:
            continue
        holes = []
        try:
            for i in range(1, poly.num_interior_rings + 1):
                holes.append([[round(x, 6), round(y, 6)]
                              for x, y in poly[i].coords])
        except Exception:
            pass
        out.append({'exterior': ext, 'holes': holes})
    return out


# шаргал-улбар hypsometric — print-д 7 ШАТЛАЛ, min/max-аар сунгана (гөлгөр)
_DEM_STOPS = [
    (0.00, '#f8ddb0'), (0.17, '#f3c486'), (0.33, '#eeac5e'),
    (0.50, '#e79440'), (0.67, '#dd7e2c'), (0.83, '#cf6a1d'),
    (1.00, '#bd5811'),
]


def _union_dem_minmax(union, target=300):
    """Сонгосон нэгжийн хил ДОТОРХ DEM-ийн (min, max) өндөр.
    DEM-ийг ГЕОСЕРВЕРЭЭС WCS GetCoverage-ээр HTTP-ээр татна (prod-д тусдаа
    геосервер байсан ч ажиллана — локал файл ашиглахгүй). Полигон mask-аар
    зөвхөн хил доторх пикселийн min/max. Алдаа гарвал None (global шатлал)."""
    import os
    import tempfile
    tp = None
    try:
        import numpy as np
        import requests
        from django.conf import settings
        from django.contrib.gis.gdal import GDALRaster
        from PIL import Image, ImageDraw
        x0, y0, x1, y1 = union.extent
        base = (settings.GEOSERVER_URL or '').rstrip('/')
        params = {
            'service': 'WCS', 'version': '2.0.1', 'request': 'GetCoverage',
            'coverageId': 'geoname__dem', 'format': 'image/tiff',
            'subset': [f'Long({x0},{x1})', f'Lat({y0},{y1})'],
            'scaleSize': f'i({target}),j({target})',
        }
        r = requests.get(base + '/geoname/wcs', params=params,
                         auth=(settings.GEOSERVER_USER,
                               settings.GEOSERVER_PASSWORD), timeout=90)
        ct = r.headers.get('content-type', '')
        if not ('tif' in ct or 'image' in ct):
            return None
        fd, tp = tempfile.mkstemp(suffix='.tif')
        os.write(fd, r.content)
        os.close(fd)
        rast = GDALRaster(tp)
        tw, th = rast.width, rast.height
        arr = np.array(rast.bands[0].data(), dtype='float32').reshape(th, tw)
        ox, oy = rast.origin.x, rast.origin.y
        sx, sy = rast.scale.x, rast.scale.y  # sy < 0
        mask = Image.new('L', (tw, th), 0)
        drw = ImageDraw.Draw(mask)

        def _px(ring):
            return [((x - ox) / sx, (y - oy) / sy) for x, y in ring]
        for p in _geom_clip_polys(union):
            if len(p['exterior']) >= 3:
                drw.polygon(_px(p['exterior']), fill=255)
            for hl in p['holes']:
                if len(hl) >= 3:
                    drw.polygon(_px(hl), fill=0)
        m = np.array(mask) > 0
        valid = (arr > -1000) & m
        if not valid.any():
            valid = arr > -1000
        if not valid.any():
            return None
        vals = arr[valid]
        return round(float(vals.min())), round(float(vals.max()))
    except Exception:
        return None
    finally:
        if tp and os.path.exists(tp):
            try:
                os.remove(tp)
            except OSError:
                pass


def _dem_terrain_sld(vmin, vmax, relief=0):
    """[vmin, vmax] өндрийн хооронд сунгасан шаргал hypsometric ColorMap SLD.
    relief=0 → ХАТУУ сүүдэргүй гөлгөр шаргал тинт (хэвлэлд)."""
    if vmax - vmin < 50:
        vmax = vmin + 50
    entries = ['<ColorMapEntry color="#000000" quantity="-1" opacity="0.0"/>']
    for i, (t, col) in enumerate(_DEM_STOPS):
        q = vmin + t * (vmax - vmin)
        op = ' opacity="1.0"' if i == 0 else ''
        entries.append(
            f'<ColorMapEntry color="{col}" quantity="{q:.1f}"{op}/>')
    cm = ''.join(entries)
    relief_xml = (f'<ShadedRelief><ReliefFactor>{relief}</ReliefFactor>'
                  '</ShadedRelief>') if relief else ''
    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<StyledLayerDescriptor version="1.0.0" '
        'xmlns="http://www.opengis.net/sld">'
        '<NamedLayer><Name>geoname:dem</Name><UserStyle>'
        '<FeatureTypeStyle><Rule><RasterSymbolizer><Opacity>1.0</Opacity>'
        f'<ColorMap type="ramp">{cm}</ColorMap>{relief_xml}'
        '</RasterSymbolizer></Rule></FeatureTypeStyle>'
        '</UserStyle></NamedLayer></StyledLayerDescriptor>')


def _geom_all_rings(geom):
    """Бүх олон өнцөгтийн ГАДААД ба ДОТООД (нүх) цагираг — band дүүргэхэд."""
    if geom is None or getattr(geom, 'empty', False):
        return []
    try:
        g = geom.simplify(0.001, preserve_topology=True) or geom
    except Exception:
        g = geom
    polys = list(g) if g.geom_type == 'MultiPolygon' else [g]
    out = []
    for poly in polys:
        try:
            for i in range(len(poly)):  # 0=гадаад, 1..=нүх
                out.append([[round(x, 6), round(y, 6)] for x, y in poly[i].coords])
        except Exception:
            continue
    return out


def _buffer_band_rings(union):
    """Сонгосон хилийн ШУГАМААС 2 ТИЙШ 500м (газар дээрх) зурвас (line buffer).
    Хаалттай цагираг тул дотор/гадна 500м тус бүрийн ~1км өргөн анулус band."""
    import math
    try:
        latc = union.centroid.y
        line = union.boundary  # хилийн шугам(ууд)
        l = line.clone()
        l.transform(3857)
        # 3857-д өргөргөөр сунадаг тул 500/cos(lat) → бодит ~500м (2 тийш)
        ribbon = l.buffer(500.0 / max(0.2, math.cos(math.radians(latc))))
        ribbon.transform(4326)
        return _geom_all_rings(ribbon)  # дүүргэхэд (гадаад + нүх)
    except Exception:
        return []


class PrintMapViewSet(PublicListMixin, viewsets.ModelViewSet):
    """Газар зүйн нэрийн зургийн ХЭВЛЭЛИЙН ЭХ — жагсаалт + print(POST) + adjacent(GET)."""
    serializer_class = PrintMapSerializer
    queryset = PrintMap.objects.all().order_by('-created_date')
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get'], url_path='adjacent')
    def adjacent(self, request):
        """Прогрессив сонголт: сонгосон нэгжүүдийн union-д хил залгаа нэгжүүд.
        ?level=aimag|sum & selected=1,2 & parent=<aimag_id>. Сонголтгүй бол бүгд."""
        level = request.query_params.get('level', 'aimag')
        level_name = AIMAG_LVL if level == 'aimag' else SUM_LVL
        parents = [p for p in (request.query_params.get('parent', '') or '').split(',') if p]
        sel = [s for s in (request.query_params.get('selected', '') or '').split(',') if s]
        base = AdminUnit.objects.filter(level__name=level_name).exclude(geom__isnull=True)
        if parents:
            base = base.filter(parent_id__in=parents)
        if sel:
            u = _union_geom(sel)
            # сонгосон + union-д хил залгаа (прогрессив contiguous сонголт)
            base = base.filter(Q(id__in=sel) | Q(geom__dwithin=(u, 0.003)))
        rows = base.order_by('unit').values('id', 'unit', 'parent_id')
        return Response({'results': list(rows)}, status=200)

    @action(detail=False, methods=['get'], url_path='geometry')
    def geometry(self, request):
        """Сонгосон нэгжүүдийн union → bbox + хилийн GeoJSON (preview-д ашиглана).
        ?units=1,2,3"""
        ids = [x for x in (request.query_params.get('units', '') or '').split(',') if x]
        if not ids:
            return Response({'bbox': None, 'rings': []}, status=200)
        union = _union_geom(ids)
        if union is None:
            return Response({'bbox': None, 'rings': []}, status=200)
        x0, y0, x1, y1 = union.extent
        px, py = (x1 - x0) * 0.03, (y1 - y0) * 0.03
        fit = mapprint.fit_layout([x0 - px, y0 - py, x1 + px, y1 + py])
        return Response({
            'bbox': list(union.extent),       # [w,s,e,n] EPSG:4326
            'rings': _geom_rings(union),       # [[ [lon,lat],... ], ...]
            'scale': fit['scale'],            # авто масштаб (render-гүй)
            'fitBbox': fit['bbox'],           # төвлөрүүлсэн (A0-д тааруулсан)
            'widthMM': fit['widthMM'], 'heightMM': fit['heightMM'],
            'orientation': fit['orientation'],
        }, status=200)

    def _build_params(self, unit_ids, is_border, dpi):
        """Сонгосон нэгжээс mapprint params + meta(scale/name_count/title) бүтээнэ."""
        union = _union_geom(unit_ids)
        if union is None:
            return None
        units = list(AdminUnit.objects.filter(id__in=unit_ids)
                     .select_related('parent', 'level'))
        # Тор интервал: сум → 5 минут, аймаг → 15 минут
        is_sum = bool(units and units[0].level_id
                      and units[0].level.name == SUM_LVL)
        grid_minutes = 5.0 if is_sum else 15.0
        # Сумын хилээс ГАДАГШ 5км бүс (саарал hillshade) + дотор clip полигон
        union_clip_polys = _geom_clip_polys(union)
        ring_clip_polys = None
        u_buf = union
        try:
            u3857 = union.transform(3857, clone=True)
            buf3857 = u3857.buffer(5000.0)            # 5км гадагш
            ring3857 = buf3857.difference(u3857)      # зөвхөн гадна зурвас
            u_buf = buf3857.transform(4326, clone=True)
            ring_geo = ring3857.transform(4326, clone=True)
            ring_clip_polys = _geom_clip_polys(ring_geo)
        except Exception:
            pass
        # Orange DEM-ийг хилээс ГАДАГШ 5км хүртэл сунгаж clip (union + 5км буфер)
        ubuf_clip_polys = _geom_clip_polys(u_buf)
        # Print-д сонгосон нэгжийн min↔max өндрөөр peach шатлалыг СУНГАНА
        dem_minmax = _union_dem_minmax(union)
        dem_sld = _dem_terrain_sld(*dem_minmax) if dem_minmax else None
        # 5км бүс багтахаар bbox-г buffer-ийн extent-ээр тооцно
        x0, y0, x1, y1 = u_buf.extent
        px, py = (x1 - x0) * 0.02, (y1 - y0) * 0.02
        # A0 формат, масштаб авто, дүрсийг ГОЛД төвлөрүүлсэн bbox
        fit = mapprint.fit_layout([x0 - px, y0 - py, x1 + px, y1 + py])
        # Индексийн торны БҮТЭН нүд (10см) + шошго багтахаар bbox-г өргөтгөж
        # ДАХИН fit (зураг бага зэрэг жижгэрч, хүрээ "томрох" эффект).
        margin_m = 0.09 * fit['scale']  # ~90мм цаас → газрын метр (тор+шошго багтах зай)
        clat = math.cos(math.radians((y0 + y1) / 2.0)) or 1.0
        dlat = margin_m / 111000.0
        dlon = margin_m / (111000.0 * clat)
        fit = mapprint.fit_layout([x0 - px - dlon, y0 - py - dlat,
                                   x1 + px + dlon, y1 + py + dlat])
        scale, bbox = fit['scale'], fit['bbox']

        # Нэрс нь unit M2M-ээр биш, БАЙРШЛААРАА сумд багтдаг тул СПАТИАЛ шүүлт
        # (geoloc нь сонгосон хилийн геометрт багтах). geoname_view-д geoloc багана бий.
        wkt = (union.simplify(0.004, preserve_topology=True) or union).wkt
        cql = f"INTERSECTS(geoloc, {wkt})"
        if is_border:
            cql += ' AND is_border=true'
        nq = GeoName.objects.filter(geoloc__intersects=union)
        if is_border:
            nq = nq.filter(is_border=True)
        name_count = nq.distinct().count()

        title = _build_title(units)
        boundary = _geom_rings(union)
        buffer_rings = _buffer_band_rings(union)  # хилийн дагуу 500м зурвас
        neighbors = []
        ub = union.boundary
        for b in _bordering_units(union, SUM_LVL, unit_ids):
            cen = b.geom.centroid
            nb = {'name': b.unit, 'rings': _geom_rings(b.geom),
                  'cx': round(cen.x, 6), 'cy': round(cen.y, 6)}
            # union-тай ХУВААЛЦАХ хилийн шугам (нэрийг дагуулж бичих) — хилийг НЯГТ
            # алхаж тасралтгүй хэсгийг авна (intersection-ийн cross-cut chord-гүй).
            nb['border'] = _shared_border_dense(union, b.geom)
            # хөрш сумын хилийн дагуу 500м БҮДЭГ ягаан зурвас (тодруулга)
            try:
                nb['band'] = _buffer_band_rings(b.geom)
            except Exception:
                nb['band'] = []
            neighbors.append(nb)

        # Газар зүйн нэрсийг ТYPE-ийн таних тэмдгээр (combined style) харуулна
        try:
            from apps.geoserver.apiviews import ensure_geoname_type_style
            type_style = ensure_geoname_type_style()
        except Exception:
            type_style = ''
        layers = [
            # 5км ГАДАГШ бүс — DEM хассан, ЦАГААН (visible=False → цаасны цагаан)
            {'type': 'wms', 'layerFullName': 'geoname:dem', 'styles': 'dem_gray',
             'name': 'Гадаргын саарал (5км)', 'opacity': 0.6,
             'visible': False, 'clipPolys': ring_clip_polys},
            # Сумын ДОТОР — DEM peach hypsometric, min↔max-аар сунгасан динамик
            # ColorMap (dem_sld). Алдаа гарвал тогтмол dem_terrain руу шилжинэ.
            {'type': 'wms', 'layerFullName': 'geoname:dem',
             'styles': None if dem_sld else 'dem_terrain', 'sld_body': dem_sld,
             'name': 'Газрын гадарга', 'opacity': 0.8, 'visible': True,
             'clipPolys': ubuf_clip_polys},  # хил + 5км гадагш
            {'type': 'wms', 'layerFullName': 'geoname:geoname_view',
             'name': 'Газар зүйн нэр', 'opacity': 1.0, 'visible': True,
             'geometryType': 'point', 'color': '#c0392b', 'cql': cql,
             'styles': type_style},
        ]
        params = {
            'paper': {'format': 'custom', 'widthMM': float(fit['widthMM']),
                      'heightMM': float(fit['heightMM']), 'marginMM': 8.0,
                      'orientation': fit['orientation']},
            'map': {'bbox': bbox, 'scale': scale, 'dpi': dpi, 'rotation': 0},
            'layers': layers,
            'layout': {
                'titleText': '', 'subtitle': title, 'showLegend': True,
                'legendColumns': 1, 'showNorthArrow': True, 'showGrid': True,
                'showScaleBar': True, 'showScaleValue': True, 'adjacentNomeks': {},
                'boundary': boundary, 'neighbors': neighbors,
                'buffer': buffer_rings,  # хилийн дагуу 500м ягаан зурвас (сэргээв)
                'gridMinutes': grid_minutes,  # сум=5мин, аймаг=15мин
                'indexClip': ubuf_clip_polys,  # индекс торыг DEM(улбар)-д л тайрна
            },
        }
        meta = {'scale': scale, 'name_count': name_count, 'title': title,
                'widthMM': fit['widthMM'], 'heightMM': fit['heightMM'],
                'orientation': fit['orientation'],
                'gridMinutes': int(grid_minutes)}
        return params, meta

    @action(detail=False, methods=['get'], url_path='preview')
    def preview(self, request):
        """Сонголтоор хэвлэлийн эх композицыг (хүрээ/тор/гарчиг) рендерлэж PNG + масштаб
        буцаана (ХАДГАЛАХГҮЙ). Панелд 'хэвлэлийн эх шиг' харуулна."""
        ids = [int(x) for x in (request.query_params.get('units', '') or '').split(',') if x]
        if not ids:
            return Response({'detail': 'units шаардлагатай'}, status=400)
        is_border = request.query_params.get('is_border') in ('1', 'true', 'True')
        built = self._build_params(ids, is_border, dpi=45)  # preview хөнгөн (хурдан)
        if built is None:
            return Response({'detail': 'геометр алга'}, status=400)
        params, meta = built
        try:
            pdf_bytes = mapprint.render(params)
        except Exception as exc:
            import logging
            logging.getLogger(__name__).exception('preview render failed')
            return Response({'detail': f'Алдаа: {exc}'}, status=500)
        from django.db import close_old_connections
        close_old_connections()
        import fitz
        import base64
        doc = fitz.open(stream=pdf_bytes, filetype='pdf')
        png = doc[0].get_pixmap(dpi=70).tobytes('png')
        return Response({
            'scale': meta['scale'], 'name_count': meta['name_count'],
            'widthMM': meta['widthMM'], 'heightMM': meta['heightMM'],
            'orientation': meta['orientation'],
            'gridMinutes': meta.get('gridMinutes'),
            'image': 'data:image/png;base64,' + base64.b64encode(png).decode(),
        }, status=200)

    @action(detail=False, methods=['post'], url_path='print')
    def print_map(self, request):
        """Сонгосон сум(д) → A0 PDF үүсгэж PrintMap-д хадгална."""
        d = request.data
        unit_ids = [int(x) for x in (d.get('units') or [])]
        if not unit_ids:
            return Response({'detail': 'units шаардлагатай'}, status=400)
        is_border = bool(d.get('is_border'))
        built = self._build_params(unit_ids, is_border, int(d.get('dpi') or 200))
        if built is None:
            return Response({'detail': 'Сонгосон нэгжид геометр алга'}, status=400)
        params, meta = built
        try:
            pdf_bytes = mapprint.render(params)
        except Exception as exc:
            import logging
            logging.getLogger(__name__).exception('print render failed')
            return Response({'detail': f'PDF үүсгэхэд алдаа: {exc}'}, status=500)

        # render нь WMS/tile-ийг удаан татдаг тул DB холболт хаагдсан байж магадгүй
        from django.db import close_old_connections
        close_old_connections()

        pm = PrintMap.objects.create(
            user=request.user if request.user.is_authenticated else None,
            is_border=is_border, name_count=meta['name_count'],
            title=meta['title'], scale=meta['scale'])
        pm.units.set(unit_ids)
        fname = (meta['title'][:60] or 'print').replace(' ', '_').replace('/', '-') + '.pdf'
        pm.file.save(fname, ContentFile(pdf_bytes), save=True)
        return Response(PrintMapSerializer(pm, context={'request': request}).data, status=201)
