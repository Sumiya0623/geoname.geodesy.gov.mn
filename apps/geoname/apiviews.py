from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q
from django.contrib.gis.geos import Point, GEOSGeometry

from core.models import Constant, GeoName, AdminUnit, Nomek
from core.mixin import PublicListMixin
from core.filters import GlobalFilter
from portal.auth import function_permission

from .serializers import GeoNameSerializer, GeoNameFullSerializer


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
	ordering_fields = [f.name for f in GeoName._meta.fields]
	ordering = ['-created_date']

	def get_queryset(self):
		qs = GeoName.objects.select_related('type', 'user')
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
		# Дэлгэрэнгүй хайлт: засаг захиргааны нэгж (удам багтаана)
		unit_tree = p.get('unit_tree', None)
		if unit_tree:
			qs = qs.filter(unit__id__in=descendant_unit_ids(unit_tree)).distinct()
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
