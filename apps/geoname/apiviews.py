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
