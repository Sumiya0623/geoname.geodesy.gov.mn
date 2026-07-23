import requests
from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from django_filters.rest_framework import DjangoFilterBackend
from django.conf import settings
from django.db.models import Count, IntegerField, Value, Q
from django.db.models.functions import Cast, NullIf
from django.contrib.contenttypes.models import ContentType
from django.contrib.gis.geos import Point

from core.models import Constant, LegalOrder, AdminUnit, GeoName, RequestName, Photo, Attach, ReCount, ReCountMap, Council, CouncilMember, Nomek
from core.mixin import PublicListMixin
from core.filters import GlobalFilter
from portal.auth import function_permission

from .serializers import (
	LegalTypeSerializer, LegalOrderSerializer, UnitDropSerializer,
	RequestNameSerializer, ReCountSerializer, ReCountMapSerializer,
	CouncilSerializer, CouncilMemberSerializer,
)

class LegalTypeViewSet(PublicListMixin, viewsets.ReadOnlyModelViewSet):
	"""Тогтоол, шийдвэрийн төрлүүд (LEGAL_TYPES) — картууд.

	Мөр бүрт order_count‑оор тухайн төрөлд хичнээн тогтоол байгааг харуулна.
	"""
	serializer_class = LegalTypeSerializer
	permission_classes = function_permission('legal')

	def get_queryset(self):
		# color талбарт хадгалсан тоогоор эрэмбэлнэ (хоосон бол сүүлд).
		# color нь CharField тул бүхэл тоо руу cast хийнэ; хоосныг NULL болгоно.
		return (
			Constant.objects.filter(key='LEGAL_TYPES')
			.annotate(order_count=Count('legalorgs', distinct=True))
			.annotate(color_num=Cast(NullIf('color', Value('')), IntegerField()))
			.order_by('color_num', 'id')
		)


class LegalOrderViewSet(PublicListMixin, viewsets.ModelViewSet):
	"""Тогтоол, шийдвэрийн сан (LegalOrder) — CRUD, хуудаслалт, хайлт, сорттой.

	- ?type=<id>   → тухайн төрлийн тогтоолууд (карт сонгоход)
	- ?search=...  → нэр, дугаар, гарын үсэг, тайлбараар хайна
	- ?ordering=...→ эрэмбэлнэ (order_date, name, order_number, views ...)
	"""
	serializer_class = LegalOrderSerializer
	queryset = LegalOrder.objects.all()
	permission_classes = function_permission('legal')
	filterset_class = GlobalFilter
	filter_backends = [DjangoFilterBackend, filters.OrderingFilter, filters.SearchFilter]
	search_fields = ['name', 'order_number', 'signer', 'description']
	ordering_fields = [f.name for f in LegalOrder._meta.fields]
	ordering = ['-created_date']

	def get_queryset(self):
		p = self.request.query_params
		qs = LegalOrder.objects.select_related('org', 'type', 'unit', 'user')
		# Төслөөр шүүх (бэлтгэл таб): тухайн төслийн legal орд (projects M2M).
		# 'projects' param — GlobalFilter‑ийн 'project' (FK) filter‑тэй мөргөлдөхгүй.
		project_id = p.get('projects', None)
		if project_id:
			qs = qs.filter(projects__id=project_id)
		# Карт = org (LEGAL_TYPES ангилал)
		org_id = p.get('org', None)
		if org_id:
			qs = qs.filter(org_id=org_id)
		# Баримтын төрөл (ORDER_TYPES) — нэмэлт шүүлт
		type_id = p.get('type', None)
		if type_id:
			qs = qs.filter(type_id=type_id)
		# Нэр / дугаар / огноогоор тусгайлан шүүх (сангаас хайх дэлгэрэнгүй)
		name = p.get('name', None)
		if name:
			qs = qs.filter(name__icontains=name)
		order_number = p.get('order_number', None)
		if order_number:
			qs = qs.filter(order_number__icontains=order_number)
		order_date = p.get('order_date', None)
		if order_date:
			qs = qs.filter(order_date=order_date)
		# Оноор хайх (гарсан огнооны жил)
		year = p.get('year', None)
		if year:
			qs = qs.filter(order_date__year=year)
		# Нэгжээр шүүх: sum сонгосон бол яг тэр сум, эс бөгөөс аймаг
		# (аймаг өөрөө эсвэл түүнд харьяа сумаар).
		sum_id = p.get('sum', None)
		aimag_id = p.get('aimag', None)
		if sum_id:
			qs = qs.filter(unit_id=sum_id)
		elif aimag_id:
			qs = qs.filter(Q(unit_id=aimag_id) | Q(unit__parent_id=aimag_id))
		# Газрын зургийн badge дээр дарахад: тухайн нэгж БА түүний удмын (аймаг→сум
		# →баг) бүх захиалга. Аль ч түвшний нэгжийн id‑г нэг ижилээр авна.
		map_unit = p.get('map_unit', None)
		if map_unit:
			try:
				root = int(map_unit)
				ids, frontier = {root}, [root]
				for _ in range(3):
					ch = list(AdminUnit.objects.filter(parent_id__in=frontier)
					          .exclude(id__in=ids).values_list('id', flat=True))
					if not ch:
						break
					ids.update(ch)
					frontier = ch
				qs = qs.filter(unit_id__in=ids)
			except (TypeError, ValueError):
				pass
		return qs

	def perform_create(self, serializer):
		user = self.request.user if self.request.user.is_authenticated else None
		instance = serializer.save(user=user)
		# Бэлтгэл табаас нэмэхэд тухайн төсөлд холбоно (projects M2M)
		project_id = self.request.data.get('project')
		if project_id:
			instance.projects.add(project_id)

	@action(detail=True, methods=['post'], url_path='attach-project')
	def attach_project(self, request, *args, **kwargs):
		"""Сан дахь одоо байгаа ордыг тухайн төсөлд холбоно (projects M2M).
		Бэлтгэл табын 'сангаас хайх' урсгал."""
		order = self.get_object()
		project_id = request.data.get('project')
		if not project_id:
			return Response({'detail': 'project шаардлагатай'}, status=400)
		order.projects.add(project_id)
		return Response({'detail': 'Төсөлд холбогдлоо', 'id': order.id}, status=200)

	@action(detail=True, methods=['post'], url_path='detach-project')
	def detach_project(self, request, *args, **kwargs):
		"""Ордыг тухайн төслөөс салгана (орд өөрөө устахгүй)."""
		order = self.get_object()
		project_id = request.data.get('project')
		if not project_id:
			return Response({'detail': 'project шаардлагатай'}, status=400)
		order.projects.remove(project_id)
		return Response({'detail': 'Төслөөс салгалаа', 'id': order.id}, status=200)

	# ЗЗ нэгжийн түвшин: URL түлхүүр → UNIT_LEVEL нэр
	MAP_LEVELS = {'aimag': 'Аймаг/Нийслэл', 'sum': 'Сум/Дүүрэг', 'bag': 'Баг/Хороо'}

	@action(detail=False, methods=['get'], url_path='map-counts')
	def map_counts(self, request):
		"""Газрын зургийн overlay: тухайн түвшний ЗЗ нэгж бүрийн тогтоол/шийдвэрийн
		тоог GeoJSON болгож буцаана. Геометр = нэгжийн центроид (цэг), count = тоо.
		Захиалга нь нэгжид (аймаг/сум/баг) холбогддог тул тухайн түвшний нэгжид
		ТҮҮНД БОЛОН доод нэгжид (удам) харьяалагдах бүх захиалгыг нэгтгэнэ.
		  ?level=aimag|sum|bag  (default aimag)
		  ?bbox=minx,miny,maxx,maxy  (EPSG:4326) — зөвхөн харагдах мужийн нэгж
		    (баг/сум олон тул zoom‑д зориулан хэрэглэнэ)
		Зөвхөн тоо > 0 нэгжийг буцаана."""
		import json
		from django.contrib.gis.geos import Polygon
		level = request.query_params.get('level', 'aimag')

		# Улсын хэмжээ / ЗЗ нэгжгүй (unit=NULL) баримтын тоо (zoom 2‑5 дээр тусад нь)
		if level == 'national':
			n = LegalOrder.objects.filter(unit__isnull=True).count()
			return Response({'type': 'FeatureCollection', 'features': [],
			                 'national_count': n})

		level_name = self.MAP_LEVELS.get(level, self.MAP_LEVELS['aimag'])
		bbox = request.query_params.get('bbox')
		# Хилийг хялбарчлах хэмжээ (град) — түвшингээр
		SIMP = {'aimag': 0.02, 'sum': 0.006, 'bag': 0.002}.get(level, 0.01)

		# Нэгж (unit_id) бүрийн шууд тоо
		per_unit = dict(
			LegalOrder.objects.exclude(unit__isnull=True)
			.values_list('unit_id').annotate(c=Count('id')))
		# Захиалгатай нэгж бүрийн ӨВӨГ (parent‑chain)‑ийг level_name хүртэл олж нэгтгэх
		uinfo = {u.id: u for u in AdminUnit.objects.filter(
			id__in=list(per_unit.keys())).select_related(
			'level', 'parent__level', 'parent__parent__level')}
		total = {}
		for uid, cnt in per_unit.items():
			cur = uinfo.get(uid)
			for _ in range(4):  # aimag→sum→bag → дээд тал нь 3 давхар
				if cur and cur.level and cur.level.name == level_name:
					total[cur.id] = total.get(cur.id, 0) + cnt
					break
				cur = cur.parent if cur else None

		units = AdminUnit.objects.filter(
			level__name=level_name).exclude(geom__isnull=True)
		if bbox:
			try:
				minx, miny, maxx, maxy = (float(x) for x in bbox.split(','))
				box = Polygon.from_bbox((minx, miny, maxx, maxy))
				box.srid = 4326
				units = units.filter(geom__intersects=box)
			except (ValueError, TypeError):
				pass

		features = []
		for u in units.iterator():
			cnt = total.get(u.id, 0)
			if not cnt:
				continue
			# Хил (полигон) — хялбарчилсан. Label/hover‑д зориулж центроидыг props‑д.
			try:
				g = u.geom.simplify(SIMP, preserve_topology=True) or u.geom
			except Exception:
				g = u.geom
			c = u.geom.centroid
			features.append({
				'type': 'Feature',
				'geometry': json.loads(g.geojson),
				'properties': {'id': u.id, 'name': u.unit, 'count': cnt,
				               'level': level, 'parent_id': u.parent_id,
				               'cx': c.x, 'cy': c.y},
			})
		return Response({'type': 'FeatureCollection', 'features': features})


class LegalUnitViewSet(PublicListMixin, viewsets.ReadOnlyModelViewSet):
	serializer_class = UnitDropSerializer
	permission_classes = function_permission('legal')
	def get_queryset(self):
		# level = UNITLEVEL Constant‑ийн нэр (ж: 'Аймаг/Нийслэл', 'Сум/Дүүрэг')
		level = self.request.query_params.get('level', None)
		parent = self.request.query_params.get('parent', None)
		level_const = Constant.objects.filter(key='UNITLEVEL', name=level).first()
		if not level_const:
			return AdminUnit.objects.none()
		qs = AdminUnit.objects.select_related('level', 'parent').filter(level=level_const)
		if parent:
			qs = qs.filter(parent_id=parent)
		return qs.order_by('unit')

	@action(detail=True, methods=['get'], url_path='extent',
			permission_classes=[IsAuthenticated])
	def extent(self, request, pk=None, *args, **kwargs):
		"""ЗЗ нэгжийн геометрийн хүрээ (4326 bbox) — газрын зургийг navigate хийнэ."""
		u = AdminUnit.objects.filter(id=pk).exclude(geom__isnull=True).first()
		if u and u.geom:
			return Response({'extent': list(u.geom.extent)}, status=200)
		return Response({'extent': None}, status=200)

	@action(detail=False, methods=['get'], url_path='locate',
			permission_classes=[IsAuthenticated])
	def locate(self, request, *args, **kwargs):
		"""Газрын зургийн харагдах хүрээ (bbox 4326) аль аймаг/сумтай огтлолцохыг
		тодорхойлно. Зөвхөн 1 нэгж бол сонгоно; 1‑с олон бол сонгохгүй (None) бөгөөд
		тэр түвшний ХИЛийг (boundary GeoJSON) тодруулж буцаана."""
		import json as _json
		from django.contrib.gis.geos import Polygon
		try:
			minx, miny, maxx, maxy = map(float, request.query_params.get('bbox').split(','))
			env = Polygon.from_bbox((minx, miny, maxx, maxy))
			env.srid = 4326
		except (TypeError, ValueError, AttributeError):
			return Response({'aimag': None, 'sum': None, 'borders': None}, status=200)

		def units(level_name):
			return list(AdminUnit.objects.select_related('parent').filter(
				level__name=level_name, geom__intersects=env).exclude(geom__isnull=True)[:20])

		def one(lst):
			if len(lst) != 1:
				return None
			u = lst[0]
			return {'id': u.id, 'unit': u.unit, 'parent': u.parent_id}

		def boundaries(lst):
			# Огтлолцох нэгжийн хилийг bbox‑оор хайчилж, хялбарчилж GeoJSON болгоно
			feats = []
			for u in lst:
				try:
					b = u.geom.boundary.intersection(env)
					if b.empty:
						continue
					b = b.simplify(0.002, preserve_topology=True)
					feats.append({'type': 'Feature', 'properties': {'unit': u.unit},
								  'geometry': _json.loads(b.geojson)})
				except Exception:
					continue
			return {'type': 'FeatureCollection', 'features': feats} if feats else None

		aimags = units('Аймаг/Нийслэл')
		sums = units('Сум/Дүүрэг')
		# Тодруулах хил: олон аймаг бол аймгийн хил; эс бол олон сум бол сумын хил
		if len(aimags) > 1:
			borders = boundaries(aimags)
		elif len(sums) > 1:
			borders = boundaries(sums)
		else:
			borders = None
		return Response({
			'aimag': one(aimags),
			'sum': one(sums),
			'borders': borders,
		}, status=200)


# ----------------------------------------------------------------------
# Иргэний нэрийн хүсэлт (RequestName)
# Төлөвийн картыг тусдаа viewset биш — core constant dropdown‑оор
# (?key=REQUEST_STATUS) дуудна.
# ----------------------------------------------------------------------

class RequestNameViewSet(PublicListMixin, viewsets.ModelViewSet):
	"""Иргэний нэрийн хүсэлт (RequestName) — CRUD, хуудаслалт, хайлт, сорттой.

	- ?status=<id>  → тухайн төлөвийн хүсэлтүүд (карт сонгоход)
	- ?user_id=<id> → тухайн хэрэглэгчийн хүсэлтүүд (профайл хуудас)
	- ?search=...   → тайлбар, нэрээр хайна
	"""
	serializer_class = RequestNameSerializer
	queryset = RequestName.objects.all()
	permission_classes = function_permission('request')
	filterset_class = GlobalFilter
	filter_backends = [DjangoFilterBackend, filters.OrderingFilter, filters.SearchFilter]
	search_fields = ['description', 'name__name', 'option__name']
	ordering_fields = [f.name for f in RequestName._meta.fields]
	ordering = ['-created_date']

	def get_queryset(self):
		# status / user_id шүүлтийг GlobalFilter гүйцэтгэнэ.
		return (
			RequestName.objects
			.select_related('name', 'age', 'type', 'status', 'user')
			.prefetch_related('purpose', 'option', 'namecontacts')
			.distinct()
		)

	def perform_create(self, serializer):
		user = self.request.user if self.request.user.is_authenticated else None
		serializer.save(user=user)

	@action(detail=True, methods=['post'], url_path='upload',
			permission_classes=[IsAuthenticated],
			parser_classes=[MultiPartParser, FormParser])
	def upload(self, request, *args, **kwargs):
		"""Нэмэлт файл хавсаргах: photos → Photo (зураг), attachs → Attach (бусад файл)."""
		obj = self.get_object()
		ct = ContentType.objects.get_for_model(RequestName)
		created = {'photos': 0, 'attachs': 0}
		for f in request.FILES.getlist('photos'):
			Photo.objects.create(file=f, content_type=ct, object_id=obj.id)
			created['photos'] += 1
		for f in request.FILES.getlist('attachs'):
			Attach.objects.create(attach=f, content_type=ct, object_id=obj.id)
			created['attachs'] += 1
		return Response({'success': True, 'created': created}, status=201)

	@action(detail=False, methods=['post'], url_path='check-user', permission_classes=[IsAuthenticated])
	def check_user(self, request, *args, **kwargs):
		"""Регистрийн дугаараар (10 тэмдэгт) ХУР системээс иргэний мэдээлэл татна.
		Хэрэглэгчийн token‑оор баталгаажуулж geodesy.gov.mn check-user руу дамжуулна."""
		register = str(request.data.get('register', '') or '').strip()
		if len(register) != 10:
			return Response({'detail': 'Регистрийн дугаар 10 тэмдэгт байх ёстой'}, status=400)
		# Хэрэглэгчийн access token (header → cookie)
		token = None
		auth = request.headers.get('Authorization', '')
		if auth.lower().startswith('bearer '):
			token = auth.split(' ', 1)[1]
		if not token:
			token = request.COOKIES.get(
				settings.SIMPLE_JWT.get('COOKIE_ACCESS', 'access_token'))
		headers = {'Authorization': f'Bearer {token}'} if token else {}
		try:
			r = requests.post(
				'https://geodesy.gov.mn/api/account/check-user/',
				json={'register': register}, headers=headers, timeout=15)
		except requests.RequestException:
			return Response({'detail': 'ХУР системтэй холбогдож чадсангүй'}, status=502)
		if r.status_code == 200:
			try:
				return Response(r.json(), status=200)
			except ValueError:
				return Response({'detail': 'Хариу буруу форматтай'}, status=502)
		return Response({'detail': 'Иргэний мэдээлэл олдсонгүй'}, status=r.status_code)

	@action(detail=False, methods=['get'], url_path='locate', permission_classes=[IsAuthenticated])
	def locate(self, request, *args, **kwargs):
		"""Солбицлоор Баг/Хороо түвшний AdminUnit олж, аймаг → сум → баг
		шатлалыг буцаана. Олдохгүй бол found=False (солбицол шалгах)."""
		try:
			lat = float(request.query_params.get('lat'))
			lon = float(request.query_params.get('lon'))
		except (TypeError, ValueError):
			return Response({'found': False, 'detail': 'Солбицол буруу'}, status=200)
		pt = Point(lon, lat, srid=4326)
		# Баг/Хороо түвшнийг Constant‑аас (нэрээр) олж id‑аар нь шүүнэ
		bag_level = Constant.objects.filter(key='UNITLEVEL', name='Баг/Хороо').first()
		qs = AdminUnit.objects.filter(geom__contains=pt)
		if bag_level:
			qs = qs.filter(level_id=bag_level.id)
		node = qs.select_related('parent', 'level').first()
		if node is None:
			return Response({'found': False}, status=200)
		chain = []
		while node is not None:
			chain.append({
				'id': node.id,
				'unit': node.unit,
				'level': node.level.name if node.level_id else '',
			})
			node = node.parent
		chain.reverse()  # аймаг → сум → баг
		return Response({'found': True, 'chain': chain}, status=200)




# ----------------------------------------------------------------------
# Дахин тооллого (ReCount) — суурин судалгааны таб. CRUD (project-р шүүнэ) +
# GeoServer WMS (ReCount.loc геометрийг газрын зураг болгож харуулах).
# ----------------------------------------------------------------------

class ReCountViewSet(PublicListMixin, viewsets.ModelViewSet):
	serializer_class = ReCountSerializer
	queryset = ReCount.objects.all()
	permission_classes = [IsAuthenticated]
	filter_backends = [DjangoFilterBackend, filters.OrderingFilter, filters.SearchFilter]
	search_fields = ['draft', 'name__name']
	ordering_fields = ['id', 'draft', 'name__name', 'status__name', 'step__name']
	ordering = ['-id']

	def get_queryset(self):
		qs = ReCount.objects.select_related('project', 'step', 'name').prefetch_related('statuses')
		project_id = self.request.query_params.get('project')
		if project_id:
			qs = qs.filter(project_id=project_id)
		# Таб бүр өөрийн үе шат (RECOUNT_STEPS) — тухайн табын recount л харагдана
		step_id = self.request.query_params.get('step')
		if step_id:
			qs = qs.filter(step_id=step_id)
		return qs

	def perform_create(self, serializer):
		instance = serializer.save()
		# Газрын зураг дээр зурсан loc (WKT эсвэл GeoJSON) өгсөн бол түүнийг хадгална
		# (байршил статус). Эс бөгөөс GeoName‑ийн geoloc‑оос онооно.
		loc_raw = self.request.data.get('loc')
		if loc_raw:
			from django.contrib.gis.geos import GEOSGeometry
			import json as _json
			try:
				val = loc_raw if isinstance(loc_raw, str) else _json.dumps(loc_raw)
				geom = GEOSGeometry(val)
				if not geom.srid:
					geom.srid = 4326
				instance.loc = geom
				instance.save(update_fields=['loc'])
				return
			except Exception:
				pass
		if instance.loc is None and instance.name_id and instance.name.geoloc:
			geom = instance.name.geoloc
			if geom.srid and geom.srid != 4326:
				geom = geom.transform(4326, clone=True)
			instance.loc = geom
			instance.save(update_fields=['loc'])

	@action(detail=False, methods=['post'], url_path='bulk')
	def bulk(self, request):
		"""Олон ReCount-г нэг дор үүсгэх (мөр мөрөөр сонгож бөөнөөр хадгалах).
		body: {project_id, items: [{name_id, draft, step_id, status_id}, ...]}.
		step_id/status_id бүх мөрд ижил байж болно (frontend switch)."""
		project_id = request.data.get('project_id') or request.data.get('project')
		items = request.data.get('items') or []
		if not isinstance(items, list) or not items:
			return Response({'detail': 'items хоосон'}, status=400)
		# Сонгосон GeoName‑ийн geoloc‑оос recount.loc‑г онооно (газрын зураг дээр
		# харагдахын тулд). 4326 руу хөрвүүлнэ.
		name_ids = [it.get('name_id') for it in items if it.get('name_id')]
		geo_map = {}
		for g in GeoName.objects.filter(id__in=name_ids).exclude(geoloc__isnull=True):
			geom = g.geoloc
			if geom.srid and geom.srid != 4326:
				geom = geom.transform(4326, clone=True)
			geo_map[g.id] = geom
		objs = [
			ReCount(
				project_id=project_id or None,
				name_id=it.get('name_id') or None,
				step_id=it.get('step_id') or None,
				draft=it.get('draft') or '',
				loc=geo_map.get(it.get('name_id')),
			)
			for it in items
		]
		created = ReCount.objects.bulk_create(objs)
		# Төлөв (M2M) — status_ids (эсвэл нэг status_id) бүрд онооно
		for obj, it in zip(created, items):
			sids = it.get('status_ids') or (
				[it.get('status_id')] if it.get('status_id') else [])
			sids = [s for s in sids if s]
			if sids:
				obj.statuses.set(sids)
		return Response({'created': len(created)}, status=201)

	@action(detail=True, methods=['post'], url_path='set-geom')
	def set_geom(self, request, pk=None):
		"""Тухайн тооллогын БАЙРШЛЫГ шинэчилнэ (QGIS plugin‑ээс засварласан
		геометр). body: {"loc": <GeoJSON geometry>} — EPSG:4326."""
		from django.contrib.gis.geos import GEOSGeometry
		import json as _json
		obj = self.get_object()
		raw = request.data.get('loc')
		if not raw:
			return Response({'detail': 'loc шаардлагатай'}, status=400)
		try:
			val = raw if isinstance(raw, str) else _json.dumps(raw)
			geom = GEOSGeometry(val)
			if not geom.srid:
				geom.srid = 4326
			if geom.srid != 4326:
				geom = geom.transform(4326, clone=True)
		except Exception as exc:
			return Response({'detail': f'Геометр буруу: {exc}'}, status=400)
		obj.loc = geom
		obj.save(update_fields=['loc'])
		return Response({'detail': 'ok'}, status=200)

	@action(detail=True, methods=['post'], url_path='reverse-geom')
	def reverse_geom(self, request, pk=None):
		"""Тухайн тооллогын ГЕОМЕТРИЙН чиглэлийг эргүүлнэ (LineString‑ийн
		цэгүүдийн дараалал урвуу). Полигонд цагираг бүрийг, цэгэнд утгагүй."""
		from django.contrib.gis.geos import (
			LineString, MultiLineString, Polygon, MultiPolygon)
		obj = self.get_object()
		g = obj.loc
		if g is None:
			return Response({'detail': 'Геометр алга'}, status=400)
		try:
			if isinstance(g, LineString):
				ng = LineString(list(g.coords)[::-1], srid=g.srid)
			elif isinstance(g, MultiLineString):
				ng = MultiLineString(
					[LineString(list(ls.coords)[::-1], srid=g.srid) for ls in g],
					srid=g.srid)
			elif isinstance(g, Polygon):
				ng = Polygon(*[list(r.coords)[::-1] for r in g], srid=g.srid)
			elif isinstance(g, MultiPolygon):
				ng = MultiPolygon(
					[Polygon(*[list(r.coords)[::-1] for r in p], srid=g.srid)
					 for p in g], srid=g.srid)
			else:
				return Response(
					{'detail': 'Зөвхөн шугам/талбайн чиглэл эргүүлнэ'}, status=400)
		except Exception as exc:
			return Response({'detail': f'Алдаа: {exc}'}, status=400)
		obj.loc = ng
		obj.save(update_fields=['loc'])
		return Response({'detail': 'ok'}, status=200)

	SCALE_25K = 163
	SCALE_100K = 165

	@action(detail=False, methods=['get'], url_path='forms')
	def forms(self, request):
		"""Маягт 1-4 (Хавсралт)-ийн дата — тухайн төслийн (+сум) ReCount‑ийг
		статусаар нь бүлэглэнэ. Мөр бүрт: УИХ‑аар батлагдсан нэр (GeoName.name),
		байр зүйн зураг дээрх нэр (draft), солбицол (lat/lon), 1:25000 ба 1:100000
		нэрлэвэр (Nomek‑оос масштаб + цэгийн орон зайгаар).
		Маягт1=ижил, Маягт2=шинэ, Маягт3=зөрүүтэй+алдаатай, Маягт4=байршил."""
		project_id = request.query_params.get('project')
		if not project_id:
			return Response({'detail': 'project шаардлагатай'}, status=400)
		qs = ReCount.objects.filter(project_id=project_id).select_related(
			'name', 'name__type').prefetch_related('statuses')
		step_id = request.query_params.get('step')
		if step_id:
			qs = qs.filter(step_id=step_id)

		# Шүүлт (аймаг/сум/дэвсгэр нэр) — ЗӨВХӨН идэвхтэй маягт (tab)‑д үйлчилнэ.
		# qs‑г шүүхгүй (бусад маягтын тоо/дата бүтэн хэвээр), мөр бүрд предикатаар
		# шалгаж зөвхөн идэвхтэй маягтын мөрүүдийг нарийсгана.
		active = request.query_params.get('tab')  # '1'..'6'
		sum_id = request.query_params.get('sum_geom')
		aimag_id = request.query_params.get('aimag_geom')
		geom_unit = None
		if sum_id:
			geom_unit = AdminUnit.objects.filter(
				id=sum_id).exclude(geom__isnull=True).first()
		elif aimag_id:
			geom_unit = AdminUnit.objects.filter(
				id=aimag_id).exclude(geom__isnull=True).first()
		gu = geom_unit.geom if geom_unit else None

		# Дэвсгэр нэрийн төрөл — сонгосон зангилаа + бүх удам (leaf‑үүд)
		type_ids = None
		type_id = request.query_params.get('type')
		if type_id:
			type_ids = {int(type_id)}
			frontier = [int(type_id)]
			for _ in range(3):  # GEONAME_TYPES 3 түвшин
				kids = list(Constant.objects.filter(
					parent_id__in=frontier).values_list('id', flat=True))
				kids = [k for k in kids if k not in type_ids]
				if not kids:
					break
				type_ids.update(kids)
				frontier = kids

		has_filter = gu is not None or type_ids is not None

		def passes(r):
			if gu is not None:
				pt = r.loc or (r.name.geoloc if r.name_id else None)
				if pt is None or not gu.intersects(pt):
					return False
			if type_ids is not None:
				if not (r.name_id and r.name.type_id in type_ids):
					return False
			return True

		def nomek_at(pt, scale_id):
			if not pt:
				return ''
			nk = Nomek.objects.filter(scale_id=scale_id, geom__contains=pt).first()
			return nk.nomek if nk else ''

		def row(r, i):
			pt = r.loc or (r.name.geoloc if r.name_id else None)
			lat = lon = None
			if pt is not None:
				c = pt if pt.geom_type == 'Point' else pt.centroid
				lon, lat = round(c.x, 6), round(c.y, 6)
			return {
				'i': i,
				'id': r.id,
				'name': (r.name.name if r.name_id else '') or '',
				'draft': r.draft or (r.name.name if r.name_id else '') or '',
				'lat': lat, 'lon': lon,
				'geom': pt.geom_type if pt is not None else '',
				# Дэвсгэр нэр: холбоотой нэрийнх → type, шинэ нэр → draft‑ийн сүүлийн үг
				'gtype': (
					(r.name.type.name if (r.name_id and r.name.type_id) else None)
					or ((r.draft or '').strip().split() or [''])[-1]
				),
				'nomek_25k': nomek_at(pt, self.SCALE_25K),
				'nomek_100k': nomek_at(pt, self.SCALE_100K),
			}

		forms = {'1': [], '2': [], '3': [], '4': [], '5': [], '6': []}
		counters = {'1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0}
		# "шинэ" төлөв → Маягт 6 (Шинээр бий болсон газар зүйн объект)
		bucket = {'ижил': '1', 'шинэ': '6', 'батлагдаагүй': '2', 'алдаатай': '3', 'байршил': '4'}
		for r in qs:
			ok = (not has_filter) or passes(r)
			# ОЛОН төлөв (statuses M2M) — recount нь төлөв бүрд тохирох маягтад
			# орно (ж: алдаатай+байршил → Маягт 3 БА 4).
			st_names = [s.name for s in r.statuses.all()]
			seen = set()
			for nm in st_names:
				b = bucket.get((nm or '').strip())
				# Идэвхтэй маягтад шүүлт хэрэгжинэ; бусдад бүтэн орно.
				if b and b not in seen and not (b == active and not ok):
					seen.add(b)
					counters[b] += 1
					forms[b].append(row(r, counters[b]))
			# Маягт 5 — хилийн заагт зөрүүтэй нэрлэгдсэн (GeoName.is_border),
			# статусаас үл хамаарна.
			if r.name_id and getattr(r.name, 'is_border', False):
				if not (active == '5' and not ok):
					counters['5'] += 1
					forms['5'].append(row(r, counters['5']))
		return Response(forms, status=200)

	@action(detail=False, methods=['get'], url_path='form-pdf')
	def form_pdf(self, request):
		"""Маягт 1-4-ийг Хавсралт загвараар А4 PDF болгож татна.
		?form=1..4&project=..&step=..&sum_geom=.. (аймаг/сум нэрийг sum_geom-оос олно)."""
		from django.http import HttpResponse
		from .pdf import build_mayagt_pdf
		form_no = request.query_params.get('form', '1')
		project_id = request.query_params.get('project')
		if not project_id:
			return Response({'detail': 'project шаардлагатай'}, status=400)
		qs = ReCount.objects.filter(project_id=project_id).select_related(
			'name', 'name__type').prefetch_related('statuses')
		step_id = request.query_params.get('step')
		if step_id:
			qs = qs.filter(step_id=step_id)
		aimag_name = sum_name = ''
		sum_id = request.query_params.get('sum_geom')
		if sum_id:
			au = AdminUnit.objects.filter(id=sum_id).first()
			if au:
				sum_name = au.unit or ''
				aimag_name = (au.parent.unit if au.parent_id else '') or ''
				if au.geom is not None:
					qs = qs.filter(loc__intersects=au.geom)

		def nomek_at(pt, scale_id):
			if not pt:
				return ''
			nk = Nomek.objects.filter(scale_id=scale_id, geom__contains=pt).first()
			return nk.nomek if nk else ''

		def row(r, i):
			pt = r.loc or (r.name.geoloc if r.name_id else None)
			lat = lon = None
			if pt is not None:
				c = pt if pt.geom_type == 'Point' else pt.centroid
				lon, lat = round(c.x, 6), round(c.y, 6)
			return {'i': i, 'name': (r.name.name if r.name_id else '') or '',
					'draft': r.draft or (r.name.name if r.name_id else '') or '', 'lat': lat, 'lon': lon,
					'gtype': (
						(r.name.type.name if (r.name_id and r.name.type_id) else None)
						or ((r.draft or '').strip().split() or [''])[-1]),
					'nomek_25k': nomek_at(pt, self.SCALE_25K),
					'nomek_100k': nomek_at(pt, self.SCALE_100K)}

		bucket = {'ижил': '1', 'шинэ': '6', 'батлагдаагүй': '2', 'алдаатай': '3', 'байршил': '4'}
		matched = []
		for r in qs:
			# ОЛОН төлөв (M2M) — аль нэг төлөв нь тухайн маягтад тохирвол орно
			bs = {bucket.get((s.name or '').strip()) for s in r.statuses.all()}
			is5 = form_no == '5' and r.name_id and getattr(r.name, 'is_border', False)
			if form_no in bs or is5:
				matched.append(r)

		# Аймаг → сум → нэрээр сортолно (сум/аймгийг цэгийн орон зайгаар олно, кэштэй)
		au_cache = {}

		def _pt(r):
			p = r.loc or (r.name.geoloc if r.name_id else None)
			if p is None:
				return None
			return p if p.geom_type == 'Point' else p.centroid

		def _sort_key(r):
			c = _pt(r)
			if c is None:
				a = s = '￿'
			else:
				k = (round(c.x, 5), round(c.y, 5))
				if k in au_cache:
					a, s = au_cache[k]
				else:
					su = (AdminUnit.objects
						  .filter(level__name='Сум/Дүүрэг', geom__contains=c)
						  .select_related('parent').first())
					a = (su.parent.unit if su and su.parent_id else '') or '￿'
					s = (su.unit if su else '') or '￿'
					au_cache[k] = (a, s)
			nm = (r.name.name if r.name_id else '') or r.draft or ''
			return (a, s, nm)

		matched.sort(key=_sort_key)

		# Толгойн аймаг/сум — sum_geom-оос ирээгүй бол датанаас (хамгийн түгээмэл)
		if not aimag_name or not sum_name:
			from collections import Counter
			units = []
			for r in matched:
				c = _pt(r)
				if c is not None:
					au = au_cache.get((round(c.x, 5), round(c.y, 5)))
					if au:
						units.append(au)
			ac = Counter(a for a, _ in units if a and a != '￿')
			sc = Counter(s for _, s in units if s and s != '￿')
			if not aimag_name and ac:
				aimag_name = ac.most_common(1)[0][0]
			if not sum_name and sc:
				sum_name = sc.most_common(1)[0][0]

		rows = [row(r, idx) for idx, r in enumerate(matched, 1)]
		pdf = build_mayagt_pdf(form_no, rows, aimag_name, sum_name)
		resp = HttpResponse(pdf, content_type='application/pdf')
		resp['Content-Disposition'] = f'attachment; filename="mayagt_{form_no}.pdf"'
		return resp

	@action(detail=False, methods=['get'], url_path='wms')
	def wms(self, request):
		"""ReCount.loc‑ийг GeoServer‑т (geoname WS) нийтэлж, тухайн төслийн
		recount‑уудын WMS GetMap мэдээллийг буцаана. Frontend зургийг (image)
		энэ мэдээллээр угсарна."""
		from apps.geoserver.apiviews import (
			GEONAME_WS, RECOUNT_VIEW, ensure_recount_view,
		)
		project_id = request.query_params.get('project')
		try:
			ensure_recount_view()
		except Exception:
			import logging
			logging.getLogger(__name__).warning('recount publish failed', exc_info=True)
		layer = f'{GEONAME_WS}:{RECOUNT_VIEW}'
		cql = f'project_id={project_id}' if project_id else None
		# Тухайн төсөлд loc‑той recount байгаа эсэх (зураг хоосон эсэхийг мэдэх)
		has_geom = ReCount.objects.filter(
			project_id=project_id, loc__isnull=False).exists() if project_id else False
		return Response({
			'wms': f'{settings.GEOSERVER_URL}/{GEONAME_WS}/wms',
			'layer': layer,
			'cql_filter': cql,
			'has_geom': has_geom,
		}, status=200)

	@action(detail=False, methods=['get'], url_path='type-tree')
	def type_tree(self, request):
		"""Тухайн төслийн GeoName‑тэй recount‑уудыг ангиллын мод (type_l1→type_l2→
		type_id)‑оор бүлэглэж, зангилаа бүрийн тоог буцаана. Мөн GeoName‑гүй
		(draft) буюу зөвхөн өөрийн geom‑той recount‑ын тоог draft_count‑аар өгнө.
		Frontend: дээд хэсэгт мод (checkbox шүүлт), доод хэсэгт draft WMS."""
		from django.db import connection
		try:
			from apps.geoserver.apiviews import ensure_recount_view
			ensure_recount_view()
		except Exception:
			pass
		pid = request.query_params.get('project')
		if not pid:
			return Response({'results': [], 'draft_count': 0})
		# Хайлтын филтэр (recount панелийн формтой уялдана) — модны тоог шүүнэ
		p = request.query_params
		conds = ['project_id=%s']
		params = [pid]
		if p.get('name'):
			conds.append('name ILIKE %s')
			params.append('%' + p['name'] + '%')
		if p.get('number'):
			conds.append('number ILIKE %s')
			params.append('%' + p['number'] + '%')
		if p.get('unit'):
			conds.append('unit_ids LIKE %s')
			params.append('% ' + p['unit'] + ' %')
		if p.get('nomek'):
			conds.append('nomek_codes ILIKE %s')
			params.append('%' + p['nomek'] + '%')
		if p.get('border') in ('1', 'true', 'True'):
			conds.append('is_border = true')
		status_ids = [s for s in (p.get('status') or '').split(',') if s.strip().isdigit()]
		if status_ids:
			# Олон-төлөв: status_ids (' 1220 1221 ')‑д аль нэг нь байвал тохирно
			conds.append('(' + ' OR '.join(['status_ids LIKE %s'] * len(status_ids)) + ')')
			params.extend(['% ' + s + ' %' for s in status_ids])
		where = ' AND '.join(conds)
		with connection.cursor() as c:
			c.execute(
				'SELECT type_l1, type_l2, type_id, COUNT(*) '
				'FROM recount_view WHERE ' + where + ' AND type_id IS NOT NULL '
				'GROUP BY type_l1, type_l2, type_id', params)
			rows = c.fetchall()
			c.execute(
				'SELECT COUNT(*) FROM recount_view '
				'WHERE ' + where + ' AND type_id IS NULL', params)
			draft_count = c.fetchone()[0]
		# оролцсон бүх constant‑ийн нэр/desc
		ids = set()
		for l1, l2, tid, _ in rows:
			for x in (l1, l2, tid):
				if x:
					ids.add(x)
		consts = {o.id: o for o in Constant.objects.filter(id__in=ids)}

		def node(cid):
			o = consts.get(cid)
			return {'id': cid, 'name': (o.name if o else str(cid)),
					'desc': (o.desc if o else ''), 'count': 0, 'children': {}}

		roots = {}
		for l1, l2, tid, cnt in rows:
			# 3 түвшний мод: l1 (үндсэн) → l2 (анхдагч) → leaf (type_id)
			top = l1 or l2 or tid
			r = roots.setdefault(top, node(top))
			r['count'] += cnt
			mid_id = l2 if (l1 and l2) else None
			if mid_id and mid_id != top:
				m = r['children'].setdefault(mid_id, node(mid_id))
				m['count'] += cnt
				parent = m
			else:
				parent = r
			if tid and tid != parent['id']:
				leaf = parent['children'].setdefault(tid, node(tid))
				leaf['count'] += cnt

		def finalize(n):
			kids = [finalize(v) for v in n['children'].values()]
			n['children'] = sorted(kids, key=lambda x: x['name'])
			n['child_count'] = len(n['children'])
			return n

		results = sorted((finalize(r) for r in roots.values()),
						 key=lambda x: x['name'])
		return Response({'results': results, 'draft_count': draft_count})


class ReCountMapViewSet(PublicListMixin, viewsets.ModelViewSet):
	serializer_class = ReCountMapSerializer
	queryset = ReCountMap.objects.all()
	permission_classes = [IsAuthenticated]
	parser_classes = [MultiPartParser, FormParser]

	def get_queryset(self):
		qs = ReCountMap.objects.all()
		project_id = self.request.query_params.get('project')
		if project_id:
			qs = qs.filter(names__project_id=project_id).distinct()
		return qs


# ----------------------------------------------------------------------
# Газар зүйн нэрийн зөвлөл (Council) + гишүүд (CouncilMember).
# Гишүүн УСТГАХГҮЙ (архив) — чөлөөлөхдөө release action‑аар end_date+баримт тавина.
# ----------------------------------------------------------------------

class CouncilViewSet(PublicListMixin, viewsets.ModelViewSet):
	serializer_class = CouncilSerializer
	queryset = Council.objects.all()
	permission_classes = [IsAuthenticated]
	filter_backends = [DjangoFilterBackend, filters.OrderingFilter, filters.SearchFilter]
	search_fields = ['name']
	ordering = ['name']

	def get_queryset(self):
		qs = Council.objects.select_related('kind', 'unit', 'status')
		p = self.request.query_params
		if p.get('unit'):
			qs = qs.filter(unit_id=p.get('unit'))
		if p.get('kind'):
			qs = qs.filter(kind_id=p.get('kind'))
		if p.get('status'):
			qs = qs.filter(status_id=p.get('status'))
		return qs


class CouncilMemberViewSet(PublicListMixin, viewsets.ModelViewSet):
	serializer_class = CouncilMemberSerializer
	queryset = CouncilMember.objects.all()
	permission_classes = [IsAuthenticated]
	filter_backends = [DjangoFilterBackend, filters.OrderingFilter, filters.SearchFilter]
	search_fields = ['full_name', 'register', 'org_title']

	def get_queryset(self):
		qs = CouncilMember.objects.select_related(
			'position', 'appoint_doc', 'release_doc', 'person')
		p = self.request.query_params
		if p.get('council'):
			qs = qs.filter(council_id=p.get('council'))
		# active=true → зөвхөн одоо хүчинтэй (end_date IS NULL); эс бол түүх бүхэлд
		if p.get('active') in ('true', 'True', '1'):
			qs = qs.filter(end_date__isnull=True)
		return qs

	def destroy(self, request, *args, **kwargs):
		# Архивын зарчим — гишүүн устгахгүй. Чөлөөлөх (release) үйлдэл хийнэ.
		return Response(
			{'detail': 'Гишүүнийг устгах боломжгүй. Баримтаар чөлөөлнө үү (release).'},
			status=405)

	@action(detail=True, methods=['post'], url_path='release')
	def release(self, request, *args, **kwargs):
		"""Гишүүнийг ЧӨЛӨӨЛНӨ — end_date + release_doc тавина (устгахгүй)."""
		from django.utils import timezone
		m = self.get_object()
		if m.end_date is not None:
			return Response({'detail': 'Аль хэдийн чөлөөлөгдсөн'}, status=400)
		release_doc = request.data.get('release_doc_id') or request.data.get('release_doc')
		if not release_doc:
			return Response({'detail': 'Чөлөөлсөн баримт (release_doc_id) шаардлагатай'}, status=400)
		end_date = request.data.get('end_date') or timezone.now().date()
		m.release_doc_id = release_doc
		m.end_date = end_date
		m.save(update_fields=['release_doc', 'end_date'])
		return Response(CouncilMemberSerializer(m).data, status=200)
