import requests
from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from django_filters.rest_framework import DjangoFilterBackend
from django.conf import settings
from django.db.models import (CharField, Case, Count, F, IntegerField,
                              Value, When, Q)
from django.db.models.functions import Coalesce
from django.db.models.functions import Cast, NullIf
from django.contrib.contenttypes.models import ContentType
from django.contrib.gis.geos import Point

from core.models import RemoteUser, Constant, LegalOrder, AdminUnit, GeoName, RequestName, Photo, Attach, ReCount, ReCountMap, Council, CouncilMember, Nomek
from core.mixin import PublicListMixin
from core.filters import GlobalFilter
from portal.auth import function_permission

from .serializers import (
	LegalTypeSerializer, LegalOrderSerializer, UnitDropSerializer,
	RequestNameSerializer, ReCountSerializer, ReCountMapSerializer,
	CouncilSerializer, CouncilMemberSerializer,
)

class LegalTypeViewSet(PublicListMixin, viewsets.ReadOnlyModelViewSet):
	serializer_class = LegalTypeSerializer
	permission_classes = function_permission('legal')
	def get_queryset(self):
		return (
			Constant.objects.filter(key='LEGAL_LEVELS')
			.annotate(order_count=Count('orgs', distinct=True))
			.annotate(code_txt=NullIf('code', Value('')),
			          color_num=Cast(NullIf('color', Value('')), IntegerField()))
			.order_by(F('code_txt').asc(nulls_last=True),
			          F('color_num').asc(nulls_last=True), 'id')
		)


class MappedOrderingFilter(filters.OrderingFilter):
	"""`?ordering=unit` гэх мэт FK талбарыг id‑ээр бус НЭРЭЭР нь эрэмбэлнэ.

	unit → unit_name (AdminUnit.unit), govlevel/org/type → тухайн Constant.name.
	Эдгээр нь queryset дээр annotate‑лагдсан байх ёстой."""
	field_map = {'unit': 'unit_name', 'sum': 'unit_name',
	             'aimag': 'parent_unit_name', 'govlevel': 'govlevel_name',
	             'org': 'org_name', 'type': 'type_name'}

	def remove_invalid_fields(self, queryset, fields, view, request):
		mapped = []
		for f in fields:
			desc = f.startswith('-')
			raw = self.field_map.get(f[1:] if desc else f, f[1:] if desc else f)
			mapped.append('-' + raw if desc else raw)
		return super().remove_invalid_fields(queryset, mapped, view, request)


class LegalOrderViewSet(PublicListMixin, viewsets.ModelViewSet):
	"""Тогтоол, шийдвэрийн сан (LegalOrder) — CRUD, хуудаслалт, хайлт, сорттой.

	- ?type=<id>   → тухайн төрлийн тогтоолууд (карт сонгоход)
	- ?search=...  → нэр, дугаар, гарын үсэг, тайлбараар хайна
	- ?ordering=...→ эрэмбэлнэ (order_date, name, order_number, views ...)
	"""
	serializer_class = LegalOrderSerializer
	queryset = LegalOrder.objects.all()
	permission_classes = function_permission('legal')

	def list(self, request, *args, **kwargs):
		# Газрын зургийн legal/request view‑үүд бэлэн эсэхийг баталгаажуулна
		# (процессын амьдралд нэг л удаа гүйцэтгэнэ)
		from apps.geoserver.apiviews import ensure_map_views
		ensure_map_views()
		return super().list(request, *args, **kwargs)
	filterset_class = GlobalFilter
	filter_backends = [DjangoFilterBackend, MappedOrderingFilter, filters.SearchFilter]
	# Нэр, дугаар, ТӨРӨЛ, ОГНОО‑гоор хайна (сүүлийн 2 нь annotate‑лагдсан)
	search_fields = ['name', 'order_number', 'signer', 'description',
	                 'type_name', 'date_text']

	ordering_fields = ([f.name for f in LegalOrder._meta.fields]
	                   + ['names_count', 'unit_name', 'parent_unit_name',
	                      'govlevel_name', 'org_name', 'type_name'])
	ordering = ['-created_date']

	# PublicListMixin нь filter_backends атрибутыг биш ЭНЭ функцийг ашигладаг тул
	# FK‑г нэрээр эрэмбэлдэг MappedOrderingFilter‑ийг энд ч өгнө.
	def get_filter_backends(self):
		return [DjangoFilterBackend, MappedOrderingFilter, filters.SearchFilter]

	def get_queryset(self):
		p = self.request.query_params
		qs = (LegalOrder.objects
		      .select_related('govlevel', 'org', 'type', 'unit', 'user')
		      # Тухайн шийдвэрт холбогдсон газар зүйн нэрийн тоо (sort‑той) +
		      # FK талбаруудыг id‑ээр бус НЭРЭЭР нь эрэмбэлэх боломж
		      .annotate(names_count=Count('names', distinct=True),
		                unit_name=F('unit__unit'),
	                parent_unit_name=F('unit__parent__unit'),
		                govlevel_name=F('govlevel__name'),
		                org_name=F('org__name'),
		                type_name=F('type__name'),
		                # Огноог текстээр хайх боломжтой болгов ("2003-09")
		                date_text=Cast('order_date', CharField())))
		# Төслөөр шүүх (бэлтгэл таб): тухайн төслийн legal орд (projects M2M).
		# 'projects' param — GlobalFilter‑ийн 'project' (FK) filter‑тэй мөргөлдөхгүй.
		project_id = p.get('projects', None)
		if project_id:
			qs = qs.filter(projects__id=project_id)
			# Тухайн ТӨСЛИЙН тодруулалтад (ReCount) хамаарах нэрсээс хэд нь энэ
			# баримтад холбогдсоныг тоолно. names_count нь САНГИЙН нийт тоо
			# (нэг тогтоолд 200мянга+ нэр байж болно) тул төслийн дотор утгагүй.
			qs = qs.annotate(project_names_count=Count(
				'names', filter=Q(names__recounts__project_id=project_id),
				distinct=True))
		# Карт = govlevel (LEGAL_LEVELS түвшин, хуучин org)
		govlevel_id = p.get('govlevel', None)
		if govlevel_id:
			qs = qs.filter(govlevel_id=govlevel_id)
		# Байгууллага (LEGAL_ORGS)
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
		# ЗЗ нэгжийн НЭРЭЭР шүүх (сангаас хайх — "Сум, дүүрэг"‑ийн нэрээр)
		unit_name = (p.get('unit_name') or '').strip()
		if unit_name:
			qs = qs.filter(Q(unit__unit__icontains=unit_name)
			               | Q(unit__parent__unit__icontains=unit_name))
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
		# Модны «Нийт» зангилаа — ЗЗ нэгжгүй шийдвэрүүд
		if p.get('no_unit') in ('1', 'true', 'True'):
			qs = qs.filter(unit__isnull=True)
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

	@action(detail=False, methods=['post'], url_path='attach-by-units')
	def attach_by_units(self, request, *args, **kwargs):
		"""Төслийн ХАМРАХ засаг захиргаанд (units) харьяалагдах БҮХ шийдвэрийг
		сангаас нэг дор төсөлд холбоно. Аймаг сонгосон бол түүний доод шатны
		(сум→баг) нэгжийнхийг бүгдийг нь хамруулна.
		  POST {project: <id>} → {added, skipped, total}
		"""
		from core.models import Project
		project_id = request.data.get('project')
		if not project_id:
			return Response({'detail': 'project шаардлагатай'}, status=400)
		project = Project.objects.filter(pk=project_id).first()
		if not project:
			return Response({'detail': 'Төсөл олдсонгүй'}, status=404)
		roots = list(project.units.values_list('id', flat=True))
		if not roots:
			return Response(
				{'detail': 'Төсөлд хамрах засаг захиргаа тохируулаагүй байна.'},
				status=400)
		# Аймаг → сум → баг (3 давхар) хүртэлх удмыг цуглуулна
		ids, frontier = set(roots), roots
		for _ in range(3):
			ch = list(AdminUnit.objects.filter(parent_id__in=frontier)
			          .exclude(id__in=ids).values_list('id', flat=True))
			if not ch:
				break
			ids.update(ch)
			frontier = ch
		matched = LegalOrder.objects.filter(unit_id__in=ids)
		total = matched.count()
		fresh = list(matched.exclude(projects__id=project.id))
		if fresh:
			project.projectorders.add(*fresh)
		return Response({'added': len(fresh), 'skipped': total - len(fresh),
		                 'total': total})

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
	# UNITLEVEL Constant‑ийн нэртэй ЯГ таарах ёстой — эс бөгөөс нэгж олдохгүй
	# (газрын зурагт хил, тоо огт харагдахгүй болно).
	MAP_LEVELS = {'aimag': 'Аймаг/Нийслэл', 'sum': 'Сум/Дүүрэг',
	              'bag': 'Баг/Хороо'}

	@action(detail=False, methods=['get'], url_path='unit-tree')
	def unit_tree(self, request):
		"""Шийдвэрийн сан — модлон бүлэглэнэ.

		  Нийт (ЗЗ нэгжгүй шийдвэрүүд) → Төрөл
		  Аймаг/Нийслэл → Сум/Дүүрэг → Төрөл

		Аймагт шууд холбогдсон шийдвэрүүд «Аймгийн шийдвэр» дэд зангилаанд орно.
		?name=<хайлт> → нэр/дугаараар шүүнэ.
		"""
		name_q = (request.query_params.get('name')
		          or request.query_params.get('search') or '').strip()
		qs = LegalOrder.objects.all()
		if name_q:
			qs = qs.filter(Q(name__icontains=name_q)
			               | Q(order_number__icontains=name_q))
		rows = (qs.values('unit_id', 'unit__unit', 'unit__level__name',
		                  'unit__parent_id', 'unit__parent__unit',
		                  'type_id', 'type__name')
		          .annotate(c=Count('id')))

		roots = {}   # key → {id,name,count,children{}}
		NO_TYPE = 'Төрөл тодорхойгүй'

		def bucket(parent, key, node_id, node_name):
			return parent.setdefault(key, {
				'id': node_id, 'name': node_name, 'count': 0, 'children': {},
			})

		for r in rows:
			cnt = r['c']
			t_id = r['type_id']
			t_name = r['type__name'] or NO_TYPE
			lvl = r['unit__level__name']
			if not r['unit_id']:
				# «Нийт» — ЗЗ нэгжгүй шийдвэрүүд, шууд төрлөөр нь ангилна
				root = bucket(roots, 'none', 'none', 'Улс')
				mid = root
			elif lvl == 'Сум/Дүүрэг':
				a_id = r['unit__parent_id'] or 0
				root = bucket(roots, f'a{a_id}', f'a{a_id}',
				              r['unit__parent__unit'] or 'Аймаг тодорхойгүй')
				mid = bucket(root['children'], f's{r["unit_id"]}',
				             f's{r["unit_id"]}', r['unit__unit'] or '—')
			else:
				# Аймаг/Нийслэл (эсвэл баг) — аймгийн шууд шийдвэр
				a_id = (r['unit_id'] if lvl == 'Аймаг/Нийслэл'
				        else (r['unit__parent_id'] or 0))
				a_name = (r['unit__unit'] if lvl == 'Аймаг/Нийслэл'
				          else (r['unit__parent__unit'] or 'Аймаг тодорхойгүй'))
				root = bucket(roots, f'a{a_id}', f'a{a_id}', a_name or '—')
				mid = bucket(root['children'], f'a{a_id}-own', f'a{a_id}-own',
				             'Аймгийн шийдвэр')
			leaf = bucket(mid['children'], f't{t_id}',
			              f'{mid["id"]}-t{t_id or 0}', t_name)
			leaf['count'] += cnt
			if mid is not root:
				mid['count'] += cnt
			root['count'] += cnt

		def finalize(n):
			kids = sorted(n['children'].values(), key=lambda x: x['name'])
			n['children'] = [finalize(k) for k in kids] if kids else []
			n['child_count'] = len(n['children'])
			return n

		none_root = roots.pop('none', None)
		results = sorted((finalize(r) for r in roots.values()),
		                 key=lambda x: x['name'])
		if none_root:
			results.insert(0, finalize(none_root))
		total = sum(r['count'] for r in results)
		return Response({'results': results, 'total': total})

	@action(detail=False, methods=['get'], url_path='map-counts')
	def map_counts(self, request):
		"""Газрын зургийн overlay: тухайн түвшний ЗЗ нэгж бүрийн тогтоол/шийдвэрийн
		тоог GeoJSON болгож буцаана. Геометр = нэгжийн центроид (цэг), count = тоо.
		Захиалга нь нэгжид (аймаг/сум/баг) холбогддог тул тухайн түвшний нэгжид
		ТҮҮНД БОЛОН доод нэгжид (удам) харьяалагдах бүх захиалгыг нэгтгэнэ.
		  ?level=aimag|sum|bag  (default aimag)
		  ?bbox=minx,miny,maxx,maxy  (EPSG:4326) — зөвхөн харагдах мужийн нэгж
		    (баг/сум олон тул zoom‑д зориулан хэрэглэнэ)
		  ?empty=1 → шийдвэргүй (count=0) нэгжийг ч буцаана. Ингэснээр газрын
		    зурагт БҮХ хил саарлаар харагдаж, шийдвэртэй нь л тодорно.
		Үгүй бол зөвхөн тоо > 0 нэгжийг буцаана."""
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

		include_empty = request.query_params.get('empty') in ('1', 'true', 'True')
		features = []
		for u in units.iterator():
			cnt = total.get(u.id, 0)
			if not cnt and not include_empty:
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

	def list(self, request, *args, **kwargs):
		# Газрын зургийн legal/request view‑үүд бэлэн эсэхийг баталгаажуулна
		from apps.geoserver.apiviews import ensure_map_views
		ensure_map_views()
		return super().list(request, *args, **kwargs)
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
			.prefetch_related('purpose', 'option', 'namecontacts__person')
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
		# Зураг бүрийн ЗОВХИС (зураг дарсан зүг) — `descs` нь `photos`-той ижил
		# дараалалтай ирнэ. Маягт дээр зовхистой зураг «Гэрэл зураг», зовхисгүй
		# нь «Байршлын зураг» хэсэгт ордог тул энэ утга чухал.
		descs = (request.data.getlist('descs')
		         if hasattr(request.data, 'getlist') else [])
		for i, f in enumerate(request.FILES.getlist('photos')):
			Photo.objects.create(
				file=f, content_type=ct, object_id=obj.id,
				desc=(descs[i].strip() if i < len(descs) else '') or None)
			created['photos'] += 1
		for f in request.FILES.getlist('attachs'):
			Attach.objects.create(attach=f, content_type=ct, object_id=obj.id)
			created['attachs'] += 1
		return Response({'success': True, 'created': created}, status=201)

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


# ----------------------------------------------------------------------
# Импортолсон нэрийг БАТЛАГДСАН нэртэй тааруулах.
#
# Дүрэм (хэрэглэгчтэй тохирсон):
#   • Байршлаар нь СУМ/ДҮҮРГИЙГ тодорхойлно (ST_Intersects).
#   • Тэр сумын БАТЛАГДСАН нэрсээс ижил нэрийг хайна (том/жижиг үсэг,
#     захын хоосон зайг үл тооно).
#   • 0 таарвал  → батлагдаагүй, draft хэвээр, тайланд орно.
#   • 1 таарвал  → холбоно.
#   • Олон таарвал → geoloc‑той нь дундаас ХАМГИЙН ОЙРыг холбоно; аль нь ч
#     geoloc‑гүй бол сонгох боломжгүй тул тайланд «олон таарсан» гэж гарна.
#   • Холбогдсон нэр нь ӨМНӨ НЬ geoloc‑той бөгөөд шинэ байршил босго (500 м)
#     хэтэрвэл «байршил зөрүүтэй» тайланд орно. Зөрүүг ГЕОМЕТРИЙН ТӨРЛӨӨР:
#     цэг → зай (м), шугам → уртын зөрүү, талбай → талбайн зөрүү.
#   Бүх хэмжилт geography (сфероид) дээр — 4326 градусын утга биш.
# ----------------------------------------------------------------------

def _match_approved(items, dist_limit=500.0):
	"""items: [{'i': индекс, 'draft': нэр, 'geom': GEOSGeometry(4326)}, ...]

	→ {индекс: {'name_id':…, 'sum_id':…, 'sum':…}}, unmatched[], ambiguous[], moved[]
	"""
	from django.db import connection
	if not items:
		return {}, [], [], []
	with connection.cursor() as c:
		# 1) Байршил → сум (нэг асуулгаар бүгдийг)
		vals, params = [], []
		for it in items:
			vals.append('(%s, ST_GeomFromEWKB(%s))')
			params += [it['i'], it['geom'].centroid.ewkb]
		c.execute(
			'SELECT v.i, au.id, au.unit FROM (VALUES ' + ','.join(vals) + ') v(i, pt) '
			'JOIN core_adminunit au ON au.geom IS NOT NULL '
			'     AND ST_Intersects(au.geom, v.pt) '
			'JOIN core_constant lvl ON lvl.id = au.level_id '
			"WHERE lvl.name = 'Сум/Дүүрэг'", params)
		unit_of = {}
		for i, uid, uname in c.fetchall():
			unit_of.setdefault(i, (uid, uname))

		# 2) Тэдгээр сум × нэрсийн БАТЛАГДСАН нэр дэвшигчид
		sum_ids = sorted({u[0] for u in unit_of.values()})
		names = sorted({(it['draft'] or '').strip().lower()
		                for it in items if (it['draft'] or '').strip()})
		cand = {}
		if sum_ids and names:
			c.execute(
				'SELECT gu.adminunit_id, lower(btrim(g.name)), g.id, g.geoloc '
				'FROM core_geoname g '
				'JOIN core_geoname_unit gu ON gu.geoname_id = g.id '
				'WHERE g.is_approved AND gu.adminunit_id = ANY(%s) '
				'  AND lower(btrim(g.name)) = ANY(%s)', [sum_ids, names])
			from django.contrib.gis.geos import GEOSGeometry
			for uid, nm, gid, loc in c.fetchall():
				cand.setdefault((uid, nm), []).append(
					(gid, GEOSGeometry(loc) if loc else None))

	matched, unmatched, ambiguous = {}, [], []
	for it in items:
		nm = (it['draft'] or '').strip().lower()
		u = unit_of.get(it['i'])
		hits = cand.get((u[0], nm), []) if (u and nm) else []
		if not hits:
			unmatched.append({'index': it['i'], 'draft': it['draft'],
			                  'unit': (u[1] if u else None)})
			continue
		if len(hits) == 1:
			gid = hits[0][0]
		else:
			# geoloc‑той нь дундаас хамгийн ойр — эс бөгөөс сонгох боломжгүй
			cen = it['geom'].centroid
			withloc = [(g, l) for g, l in hits if l is not None]
			if not withloc:
				ambiguous.append({'index': it['i'], 'draft': it['draft'],
				                  'unit': (u[1] if u else None),
				                  'count': len(hits)})
				continue
			gid = min(withloc, key=lambda t: cen.distance(t[1]))[0]
		matched[it['i']] = {'name_id': gid, 'sum_id': u[0], 'sum': u[1]}

	# 3) Байршлын зөрүү — ЗӨВХӨН өмнө нь geoloc‑той нэртэй холбогдсонд
	moved = []
	pairs = [(it, matched[it['i']]) for it in items if it['i'] in matched]
	if pairs:
		vals, params = [], []
		for it, m in pairs:
			vals.append('(%s, ST_GeomFromEWKB(%s), %s)')
			params += [it['i'], it['geom'].ewkb, m['name_id']]
		with connection.cursor() as c:
			c.execute(
				'SELECT v.i, GeometryType(v.g), '
				'  ST_Distance(ST_Centroid(v.g)::geography, '
				'              ST_Centroid(g.geoloc)::geography), '
				'  ST_Length(v.g::geography), ST_Length(g.geoloc::geography), '
				'  ST_Area(v.g::geography),   ST_Area(g.geoloc::geography) '
				'FROM (VALUES ' + ','.join(vals) + ') v(i, g, gid) '
				'JOIN core_geoname g ON g.id = v.gid '
				'WHERE g.geoloc IS NOT NULL', params)
			by_i = {it['i']: it for it, _ in pairs}
			for i, gt, dist, ln, lo, an, ao in c.fetchall():
				if dist is None or dist <= dist_limit:
					continue
				gt = (gt or '').upper()
				if 'POLYGON' in gt:
					unit, delta = 'га', abs((an or 0) - (ao or 0)) / 10000.0
				elif 'LINE' in gt:
					unit, delta = 'м', abs((ln or 0) - (lo or 0))
				else:
					unit, delta = 'м', dist
				moved.append({'index': i, 'draft': by_i[i]['draft'],
				              'name_id': matched[i]['name_id'],
				              'dist': round(dist, 1), 'geom_type': gt,
				              'delta': round(delta, 1), 'unit': unit})
	return matched, unmatched, ambiguous, moved


class ReCountViewSet(PublicListMixin, viewsets.ModelViewSet):
	serializer_class = ReCountSerializer
	queryset = ReCount.objects.all()
	permission_classes = [IsAuthenticated]
	filter_backends = [DjangoFilterBackend, filters.OrderingFilter, filters.SearchFilter]
	search_fields = ['draft', 'name__name', 'name__number']
	# Ангиллын 3 түвшнээр эрэмбэлэх — queryset дээр annotate‑лагдсан
	ordering_fields = ['id', 'draft', 'name__name', 'name__number',
	                   'step__name', 'type_l1', 'type_l2', 'type_l3']
	ordering = ['-id']

	def get_queryset(self):
		qs = (ReCount.objects
		      .select_related('project', 'step', 'name', 'name__type',
		                      'name__type__parent', 'name__type__parent__parent')
		      .prefetch_related('statuses')
		      # Ангиллын түвшин бүрийн НЭР — эрэмбэлэхэд. type нь НАВЧ тул
		      # язгуураас (l1) тоолохын тулд гүнээс хамааруулан сонгоно:
		      #   gp байвал → l1=gp, l2=p,  l3=type
		      #   p  байвал → l1=p,  l2=type
		      #   эс бөгөөс → l1=type
		      .select_related('type', 'type__parent', 'type__parent__parent')
		      .annotate(
		          type_l1=Coalesce('name__type__parent__parent__name',
		                           'name__type__parent__name',
		                           'name__type__name',
		                           # GeoName‑гүй (draft) тодруулалт — өөрийн type
		                           'type__parent__parent__name',
		                           'type__parent__name',
		                           'type__name'),
		          type_l2=Case(
		              When(name__type__parent__parent__isnull=False,
		                   then=F('name__type__parent__name')),
		              When(name__type__parent__isnull=False,
		                   then=F('name__type__name')),
		              When(type__parent__parent__isnull=False,
		                   then=F('type__parent__name')),
		              When(type__parent__isnull=False,
		                   then=F('type__name')),
		              default=Value(None), output_field=CharField()),
		          type_l3=Case(
		              When(name__type__parent__parent__isnull=False,
		                   then=F('name__type__name')),
		              When(type__parent__parent__isnull=False,
		                   then=F('type__name')),
		              default=Value(None), output_field=CharField()),
		      ))
		project_id = self.request.query_params.get('project')
		if project_id:
			qs = qs.filter(project_id=project_id)
		# Таб бүр өөрийн үе шат (RECOUNT_STEPS) — тухайн табын recount л харагдана
		step_id = self.request.query_params.get('step')
		if step_id:
			qs = qs.filter(step_id=step_id)
		# Нэрийн АНГИЛАЛ — сонгосон түвшин + түүний бүх удам
		type_id = self.request.query_params.get('type')
		if type_id == 'none':
			# АНГИЛАЛГҮЙ — GeoName‑ийн ч, тодруулалтын ч төрөл тодорхойлоогүй
			qs = qs.filter(name__type__isnull=True, type__isnull=True)
		elif type_id:
			from apps.geoname.apiviews import descendant_type_ids
			ids = descendant_type_ids(type_id)
			qs = qs.filter(Q(name__type_id__in=ids) | Q(type_id__in=ids))
		# ТӨЛӨВ — олон сонголт (таслалаар). Аль нэг нь таарвал орно.
		# 'none' тэмдэгт → төлөв ОГТ тодорхойлоогүй (хоосон) тооллогууд.
		st = (self.request.query_params.get('statuses') or '').strip()
		if st:
			parts = [x.strip() for x in st.split(',') if x.strip()]
			ids = [int(x) for x in parts if x.isdigit()]
			cond = Q()
			if ids:
				cond |= Q(statuses__id__in=ids)
			if 'none' in parts:
				cond |= Q(statuses__isnull=True)
			if cond:
				qs = qs.filter(cond).distinct()
		# ЗАСАГ ЗАХИРГААНЫ НЭГЖ — сонгосон нэгж + доод шатны удам. Батлагдсан
		# нэрийн M2M‑ээр, эс бөгөөс тодруулалтын байршил (loc) нэгжид багтахаар.
		unit_id = self.request.query_params.get('unit')
		if unit_id:
			from apps.geoname.apiviews import descendant_unit_ids
			ids = descendant_unit_ids(unit_id)
			cond = Q(name__unit__id__in=ids)
			au = AdminUnit.objects.filter(id=unit_id).exclude(
				geom__isnull=True).first()
			if au is not None:
				cond |= Q(loc__intersects=au.geom)
			qs = qs.filter(cond).distinct()
		# ХИЛИЙН ЦЭС (GeoName.is_border)
		if self.request.query_params.get('is_border') in ('1', 'true', 'True'):
			qs = qs.filter(name__is_border=True)
		# ГЕОМЕТРИЙН ТӨРӨЛ — тодруулалтын loc, эс бөгөөс нэрийн geoloc
		gtype = (self.request.query_params.get('geom_type') or '').strip()
		if gtype:
			from django.contrib.gis.db.models.functions import GeometryType
			qs = qs.annotate(
				g_type=Coalesce(GeometryType('loc'), GeometryType('name__geoloc'))
			).filter(g_type__iendswith=gtype)
		# ҮҮСГЭСЭН ХЭРЭГЛЭГЧ
		user_id = self.request.query_params.get('user')
		if user_id:
			qs = qs.filter(user_id=user_id)
		# БАЙРШИЛГҮЙ — тооллогын loc ч, нэрийн geoloc ч байхгүй
		if self.request.query_params.get('no_geom') in ('1', 'true', 'True'):
			qs = qs.filter(loc__isnull=True).filter(
				Q(name__isnull=True) | Q(name__geoloc__isnull=True))
		return qs

	@action(detail=False, methods=['get'], url_path='users')
	def users(self, request):
		"""Тухайн төслийн тодруулалт ҮҮСГЭСЭН хэрэглэгчид (шүүлтийн сонголт).

		  ?project=<id>[&step=<id>] → {results: [{id, full_name, photo}]}
		"""
		qs = self.get_queryset().exclude(user__isnull=True)
		rows = (qs.values('user_id', 'user__first_name', 'user__last_name',
		                  'user__username', 'user__photo')
		        .distinct().order_by('user__last_name', 'user__first_name'))
		seen, out = set(), []
		for r in rows:
			uid = r['user_id']
			if uid in seen:
				continue
			seen.add(uid)
			full = (f"{r['user__last_name'] or ''} {r['user__first_name'] or ''}".strip()
			        or r['user__username'] or str(uid))
			out.append({'id': uid, 'full_name': full,
			            'photo': r['user__photo'] or None})
		return Response({'results': out}, status=200)

	@action(detail=False, methods=['get'], url_path='type-summary')
	def type_summary(self, request):
		"""Тодруулалтын ҮНДСЭН ангиллын тоо — ЖАГСААЛТТАЙ ЯГ ИЖИЛ шүүлтээр.

		Хүснэгтийн дээд мөрөнд (таб) харуулна: ?project=&step=&statuses=&search=
		→ {total, results: [{id, name, count}]}. Ангиллын id нь ҮНДСЭН (level‑1)
		Constant‑ийн id тул таб дарахад ?type=<id>‑ээр шүүнэ.
		"""
		qs = self.filter_queryset(self.get_queryset())
		rows = {}
		total = 0
		# Навчнаас язгуур руу — 3 түвшин хүртэл (GEONAME_TYPES)
		for r in qs.values_list('name__type_id',
		                        'name__type__parent_id',
		                        'name__type__parent__parent_id',
		                        'type_id', 'type__parent_id',
		                        'type__parent__parent_id'):
			total += 1
			# GeoName‑тэй бол түүний төрөл, эс бөгөөс тодруулалтын өөрийн төрөл
			root = r[2] or r[1] or r[0] or r[5] or r[4] or r[3] or 0
			rows[root] = rows.get(root, 0) + 1
		ids = [k for k in rows if k]
		names = {c.id: c.name for c in Constant.objects.filter(id__in=ids)}
		results = sorted(
			({'id': k, 'name': names.get(k, 'Ангилалгүй') if k else 'Ангилалгүй',
			  'count': v}
			 for k, v in rows.items()),
			key=lambda x: -x['count'])
		return Response({'total': total, 'results': results}, status=200)

	@action(detail=False, methods=['post'], url_path='import-by-units')
	def import_by_units(self, request, *args, **kwargs):
		"""Батлагдсан нэрийн сангаас — төслийн хамрах ЗЗ нэгжид (аймаг сонгосон
		бол доод шатны сум/баг хүртэл) багтах БҮХ батлагдсан нэрийг тухайн
		төслийн дахин тооллого (ReCount) руу нэг дор импортлоно.

		  POST {project: <id>, step: <id|optional>} → {added, skipped, total}
		Аль хэдийн бүртгэгдсэн нэрийг давхардуулахгүй.
		"""
		from core.models import Project
		from apps.geoname.apiviews import descendant_unit_ids
		project_id = request.data.get('project')
		if not project_id:
			return Response({'detail': 'project шаардлагатай'}, status=400)
		project = Project.objects.filter(pk=project_id).first()
		if not project:
			return Response({'detail': 'Төсөл олдсонгүй'}, status=404)
		roots = list(project.units.values_list('id', flat=True))
		if not roots:
			return Response(
				{'detail': 'Төсөлд хамрах засаг захиргаа тохируулаагүй байна.'},
				status=400)
		# Нэгжийн ГИШҮҮНЧЛЭЛ (M2M) ба ОРОН ЗАЙН давхцлаар аль алинаар нь цуглуулна
		ids = set()
		for root in roots:
			ids |= set(GeoName.objects
			           .filter(is_approved=True,
			                   unit__id__in=descendant_unit_ids(root))
			           .values_list('id', flat=True))
			au = (AdminUnit.objects.filter(id=root)
			      .exclude(geom__isnull=True).first())
			if au:
				ids |= set(GeoName.objects
				           .filter(is_approved=True, geoloc__intersects=au.geom)
				           .values_list('id', flat=True))
		total = len(ids)
		exists = set(ReCount.objects.filter(project=project, name_id__in=ids)
		             .values_list('name_id', flat=True))
		fresh = [i for i in ids if i not in exists]
		step_id = request.data.get('step') or None
		if fresh:
			user = request.user if request.user.is_authenticated else None
			ReCount.objects.bulk_create(
				[ReCount(project=project, name_id=i, step_id=step_id, user=user)
				 for i in fresh], batch_size=1000)
		return Response({'added': len(fresh), 'skipped': total - len(fresh),
		                 'total': total})

	@action(detail=False, methods=['post'], url_path='bulk-import')
	def bulk_import(self, request, *args, **kwargs):
		"""QGIS plugin — ХЭРЭГЛЭГЧИЙН давхаргаас сонгосон обьектуудыг тухайн
		төслийн тооллого руу НЭГ хүсэлтээр оруулна.

		  POST {
		    project: <id>, step: <id|null>, type: <id|null>,
		    status_ids: [<id>, ...],            # ЗААВАЛ — дор хаяж нэг төлөв
		    skip_existing: true|false,          # анхдагч: true
		    items: [{draft, is_border, loc: <GeoJSON geometry>}, ...]
		  } → {added, skipped, errors: [{index, detail}, ...]}

		Feature бүрд нэг хүсэлт явуулбал 2000+ хүсэлт болж удаан бөгөөд дунд нь
		тасарвал хагас орно — тиймээс багцаар НЭГ гүйлгээнд бичнэ.

		Давхардал: тухайн төсөлд ИЖИЛ нэр + ИЖИЛ байршилтай (≈1 м) мөр байвал
		алгасна (skip_existing) — импортыг дахин ажиллуулахад давхардахгүй.
		"""
		from django.contrib.gis.geos import GEOSGeometry
		from django.db import transaction
		import json as _json
		from core.models import Project

		MAX_ITEMS = 20000
		project_id = request.data.get('project')
		if not project_id:
			return Response({'detail': 'project шаардлагатай'}, status=400)
		project = Project.objects.filter(pk=project_id).first()
		if not project:
			return Response({'detail': 'Төсөл олдсонгүй'}, status=404)
		status_ids = [s for s in (request.data.get('status_ids') or []) if s]
		if not status_ids:
			return Response({'detail': 'Дор хаяж нэг ТӨЛӨВ сонгоно уу.'},
			                status=400)
		items = request.data.get('items') or []
		if not isinstance(items, list):
			return Response({'detail': 'items нь жагсаалт байх ёстой'}, status=400)
		if not items:
			return Response({'detail': 'items хоосон байна'}, status=400)
		if len(items) > MAX_ITEMS:
			return Response(
				{'detail': f'Нэг удаад дээд тал нь {MAX_ITEMS} мөр импортлоно '
				           f'({len(items)} ирлээ).'}, status=400)

		step_id = request.data.get('step') or None
		type_id = request.data.get('type') or None
		skip_existing = request.data.get('skip_existing', True)
		# «Алдаагүй» төлөвтэй ирсэн нэрсийг БАТЛАГДСАН нэр гэж үзэж, байршлаар
		# нь сум тодорхойлон холбоно. Хүсэлтэд илэрхий заагаагүй бол сонгосон
		# төлөвүүдээс автоматаар тогтооно.
		match_approved = request.data.get('match_approved')
		if match_approved is None:
			match_approved = Constant.objects.filter(
				id__in=status_ids, key='RECOUNT_STATUS',
				name__icontains='Алдаагүй').exists()
		try:
			dist_limit = float(request.data.get('dist_limit') or 500.0)
		except (TypeError, ValueError):
			dist_limit = 500.0

		def key(draft, geom):
			"""Давхардлын түлхүүр — нэр + байршлын төв (5 орон ≈ 1 м)."""
			if geom is None:
				return ((draft or '').strip().lower(), None, None)
			c = geom.centroid
			return ((draft or '').strip().lower(), round(c.x, 5), round(c.y, 5))

		# key → аль хэдийн байгаа тодруулалтын id (энэ багц дотроос давхардсан
		# бол None). Алгассан шалтгааныг ЯЛГАЖ мэдээлэхэд хэрэгтэй.
		seen = {}
		if skip_existing:
			for rid, d, loc in (ReCount.objects.filter(project=project)
			                    .values_list('id', 'draft', 'loc')):
				seen.setdefault(key(d, loc), rid)

		user = request.user if request.user.is_authenticated else None
		rows, errors, skipped_items, parsed = [], [], [], []
		for i, it in enumerate(items):
			if not isinstance(it, dict):
				errors.append({'index': i, 'detail': 'мөр нь объект байх ёстой'})
				continue
			draft = (it.get('draft') or '').strip() or None
			raw = it.get('loc')
			geom = None
			if raw:
				try:
					val = raw if isinstance(raw, str) else _json.dumps(raw)
					geom = GEOSGeometry(val)
					if not geom.srid:
						geom.srid = 4326
					if geom.srid != 4326:
						geom = geom.transform(4326, clone=True)
				except Exception as exc:
					errors.append({'index': i, 'detail': f'Геометр буруу: {exc}'})
					continue
			if not draft and geom is None:
				errors.append({'index': i, 'detail': 'нэр ч, байршил ч алга'})
				continue
			parsed.append({'i': i, 'draft': draft, 'geom': geom,
			               'is_border': bool(it.get('is_border'))})
			continue

		# --- Батлагдсан нэртэй тааруулах (сонголттой) ---
		matched, unmatched, ambiguous, moved = {}, [], [], []
		if match_approved:
			try:
				matched, unmatched, ambiguous, moved = _match_approved(
					[p for p in parsed if p['draft'] and p['geom'] is not None],
					dist_limit)
			except Exception as exc:
				import logging
				logging.getLogger(__name__).exception('match_approved failed')
				errors.append({'index': -1,
				               'detail': 'Тааруулалт амжилтгүй: %s' % exc})

		# Аль хэдийн тухайн төсөлд бүртгэгдсэн БАТЛАГДСАН нэрсийг давхардуулахгүй
		linked_seen = set()
		if skip_existing and matched:
			linked_seen = set(
				ReCount.objects.filter(project=project,
				                       name_id__in=[m['name_id'] for m
				                                    in matched.values()])
				.values_list('name_id', flat=True))

		for it in parsed:
			i, draft, geom = it['i'], it['draft'], it['geom']
			m = matched.get(i)
			if m:
				if skip_existing and m['name_id'] in linked_seen:
					skipped_items.append({
						'index': i, 'draft': draft,
						'lon': round(geom.centroid.x, 6) if geom else None,
						'lat': round(geom.centroid.y, 6) if geom else None,
						'reason': 'exists', 'recount_id': None,
						'name_id': m['name_id']})
					continue
				linked_seen.add(m['name_id'])
				rows.append(ReCount(
					project=project, step_id=step_id, type_id=type_id,
					name_id=m['name_id'], draft=draft, loc=geom, user=user,
					is_border=bool(it.get('is_border'))))
				continue
			k = key(draft, geom)
			if skip_existing and k in seen:
				# Аль хэдийн БД‑д байсан уу, эсвэл ЭНЭ багц дотроо давхардсан уу
				prev = seen[k]
				c = geom.centroid if geom is not None else None
				skipped_items.append({
					'index': i, 'draft': draft,
					'lon': (round(c.x, 6) if c else None),
					'lat': (round(c.y, 6) if c else None),
					'reason': ('exists' if prev else 'batch'),
					'recount_id': prev,
				})
				continue
			seen[k] = None                # энэ багцад шинээр нэмэгдэж буй
			rows.append(ReCount(
				project=project, step_id=step_id, type_id=type_id,
				draft=draft, loc=geom, user=user,
				is_border=bool(it.get('is_border')),
			))

		added = 0
		if rows:
			with transaction.atomic():
				ReCount.objects.bulk_create(rows, batch_size=500)
				added = len(rows)
				# M2M нь bulk_create‑аар бичигдэхгүй тул through‑ээр нэг дор
				through = ReCount.statuses.through
				through.objects.bulk_create(
					[through(recount_id=r.id, constant_id=s)
					 for r in rows for s in status_ids],
					batch_size=1000, ignore_conflicts=True)
		return Response({
			'added': added, 'skipped': len(skipped_items),
			# ── Тайлан (plugin .txt болгож татуулна) ──
			'total': len(items),
			'matched': len(matched),          # батлагдсан нэртэй холбогдсон
			'unmatched': unmatched,           # сумандаа батлагдсан нэр олдоогүй
			'ambiguous': ambiguous,           # олон таарсан, сонгох боломжгүй
			'moved': moved,                   # байршил босгоос их зөрсөн
			'dist_limit': dist_limit,
			# Алгассан бүр — plugin дээр жагсааж, дээр нь дарахад зурагт очно.
			# reason: exists = төсөлд аль хэдийн бүртгэлтэй,
			#         batch  = импортын ЭНЭ багц дотроо давхардсан
			'skipped_items': skipped_items[:2000],
			'errors': errors[:50], 'error_count': len(errors),
		})

	def perform_create(self, serializer):
		# GeoName‑гүй (draft) тодруулалт ЗААВАЛ ангилалтай байх ёстой —
		# ангилалгүй нэр бүртгэгдэхээс сэргийлнэ.
		d = self.request.data
		if not d.get('name_id') and not d.get('type_id'):
			from rest_framework.exceptions import ValidationError
			raise ValidationError({'detail': 'Ангилал (type_id) сонгоно уу'})
		# Үүсгэсэн хэрэглэгчийг тэмдэглэнэ (жагсаалтын «Үүсгэсэн» багана)
		user = self.request.user if self.request.user.is_authenticated else None
		instance = serializer.save(user=user)
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

	def perform_update(self, serializer):
		# Сүүлд хөндсөн хэрэглэгчийг ч тэмдэглэнэ («Үүсгэсэн» багана)
		user = self.request.user if self.request.user.is_authenticated else None
		instance = serializer.save(**({'user': user} if user else {}))
		# Байрлал засах — PATCH {loc: GeoJSON/WKT} ирвэл recount.loc‑г шинэчилнэ
		# (recount_view геометр = COALESCE(loc, name.geoloc) тул цэг хөдөлнө).
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
			except Exception:
				pass

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
		bulk_user = request.user if request.user.is_authenticated else None
		objs = [
			ReCount(
				project_id=project_id or None,
				name_id=it.get('name_id') or None,
				step_id=it.get('step_id') or None,
				draft=it.get('draft') or '',
				loc=geo_map.get(it.get('name_id')),
				user=bulk_user,
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

	# ---------- Тодруулалтын зураг (Photo — generic FK, ReCount дээр) ----------

	def _photo_ct(self):
		return ContentType.objects.get_for_model(ReCount)

	@action(detail=True, methods=['post'], url_path='add-photo',
	        parser_classes=[MultiPartParser, FormParser])
	def add_photo(self, request, pk=None):
		"""Тодруулалтад хээрийн зураг нэмэх — multipart 'file' (+ desc: зовхис).

		Зургийг GeoName‑ийнхтэй ижилээр 800×800 тунгалаг padding‑тай PNG болгоно.
		Draft (GeoName‑гүй) тодруулалтад ч хавсаргаж болно.
		"""
		obj = self.get_object()
		f = request.FILES.get('file')
		if not f:
			return Response({'detail': 'Зураг оруулна уу'}, status=400)
		import io
		from PIL import Image
		from django.core.files.base import ContentFile
		TARGET = 800
		try:
			img = Image.open(f).convert('RGBA')
			img.thumbnail((TARGET, TARGET), Image.LANCZOS)
			canvas = Image.new('RGBA', (TARGET, TARGET), (0, 0, 0, 0))
			canvas.paste(img, ((TARGET - img.width) // 2, (TARGET - img.height) // 2))
			buf = io.BytesIO()
			canvas.save(buf, format='PNG')
			base = (f.name.rsplit('.', 1)[0] if f.name else 'photo') or 'photo'
			png = ContentFile(buf.getvalue(), name=f'{base}.png')
		except Exception:
			png = f  # хөрвүүлж чадахгүй бол эх файлаар
		desc = (request.data.get('desc') or '').strip() or None
		p = Photo.objects.create(file=png, content_type=self._photo_ct(),
		                         object_id=obj.id, desc=desc)
		url = p.file.url if p.file else None
		return Response({'id': p.id, 'url': request.build_absolute_uri(url) if url else None,
		                 'desc': p.desc}, status=201)

	@action(detail=True, methods=['post'], url_path='del-photo')
	def del_photo(self, request, pk=None):
		"""Тодруулалтын зураг устгах — body {photo_id}."""
		obj = self.get_object()
		Photo.objects.filter(id=request.data.get('photo_id'),
		                     content_type=self._photo_ct(),
		                     object_id=obj.id).delete()
		return Response({'detail': 'ok'}, status=200)

	SCALE_25K = 163
	SCALE_100K = 165

	def _status_form_map(self):
		"""{RECOUNT_STATUS.id: 'маягтын дугаар'} — Constant.desc‑ээс.

		Төлвийн нэр, тоо цаашид өөрчлөгдөж болзошгүй тул код дотор статик
		жагсаалт барихгүй: маягтын харьяаллыг Тогтмол дээрээс л удирдана.
		"""
		out = {}
		for c in Constant.objects.filter(key='RECOUNT_STATUS'):
			d = (c.desc or '').strip()
			if d.isdigit():
				out[c.id] = d
		return out

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
		# `tab` заагаагүй үед (ж: «Нэр холбох» панель — маягт бүхнээс нэр
		# сонгодог тул идэвхтэй маягт гэж байхгүй) шүүлт БҮХ маягтад
		# үйлчилнэ. Заасан үед хуучин зан: зөвхөн идэвхтэй маягт нарийсна.
		filter_all = has_filter and not active

		def passes(r):
			if gu is not None:
				pt = pts_by_rid.get(r.id)
				if pt is None or not gu.intersects(pt):
					return False
			if type_ids is not None:
				if not (r.name_id and r.name.type_id in type_ids):
					return False
			return True

		# ── Нэрлэвэр (Nomek) — БҮХ цэгийг нэг дор (масштаб тус бүрд 1 query).
		# Өмнө нь мөр бүрд 2 орон зайн query явж (2N) маягтууд маш удаан
		# ачаалагддаг байсан.
		rows_all = list(qs)
		pts_by_rid = {}
		for r in rows_all:
			pt = r.loc or (r.name.geoloc if r.name_id else None)
			if pt is not None and pt.geom_type != 'Point':
				pt = pt.centroid
			pts_by_rid[r.id] = pt

		def _pkey(p):
			return (round(p.x, 6), round(p.y, 6))

		nomek_cache = {self.SCALE_25K: {}, self.SCALE_100K: {}}
		uniq_pts = {}
		for p in pts_by_rid.values():
			if p is not None:
				uniq_pts.setdefault(_pkey(p), p)
		if uniq_pts:
			from django.contrib.gis.geos import MultiPoint
			mp = MultiPoint(list(uniq_pts.values()), srid=4326)
			for sid in (self.SCALE_25K, self.SCALE_100K):
				cache = nomek_cache[sid]
				for nk in Nomek.objects.filter(
						scale_id=sid, geom__intersects=mp).only('nomek', 'geom'):
					prep = nk.geom.prepared
					for k, p in uniq_pts.items():
						if k not in cache and prep.contains(p):
							cache[k] = nk.nomek

		def nomek_at(pt, scale_id):
			if pt is None:
				return ''
			return nomek_cache.get(scale_id, {}).get(_pkey(pt), '')

		def row(r, i):
			pt = pts_by_rid.get(r.id)
			lat = lon = None
			if pt is not None:
				lon, lat = round(pt.x, 6), round(pt.y, 6)
			return {
				'i': i,
				'id': r.id,
				# Холбоотой GeoName‑ий id — маягтаас шууд «баримт холбох»‑д хэрэгтэй
				# (мөрийн id нь ReCount‑ийнх тул нэрийг заахгүй).
				'name_id': r.name_id,
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
		# Төлөв → маягт: Constant(RECOUNT_STATUS).desc дээр МАЯГТЫН ДУГААР
		# (зөвхөн тоо) бичигдсэн байна. Нэр/текст өөрчлөгдөхөөс хамаарахгүй —
		# бүх буулгалт DB‑ээс удирдагдана.
		bucket = self._status_form_map()
		for r in rows_all:
			ok = (not has_filter) or passes(r)
			# ОЛОН төлөв (statuses M2M) — recount нь төлөв бүрд тохирох маягтад
			# орно (ж: алдаатай+байршил → Маягт 3 БА 4).
			seen = set()
			for st in r.statuses.all():
				b = bucket.get(st.id)
				# filter_all үед бүх маягтад, эсэхгүй бол зөвхөн идэвхтэйд.
				if b and b not in seen and not (
						(filter_all or b == active) and not ok):
					seen.add(b)
					counters[b] += 1
					forms[b].append(row(r, counters[b]))
			# ТЭМДЭГЛЭЛ: Маягт 5‑д ЗӨВХӨН тухайн төлөв (Тогтмол дээр desc='5')
			# бүхий тодруулалт орно. GeoName.is_border нь зөвхөн нэрийн шинж
			# чанар (хилийн цэс) тул маягтын харьяаллыг тодорхойлохгүй.

		# Маягт 9 — «газарчнаар ажилласан иргэний нотолгоо». Тодруулалтаас биш,
		# төслийн БАГИЙН БҮРЭЛДЭХҮҮН (ProjectMember)‑ээс бүрдэнэ.
		forms['9'] = self._member_rows(project_id, sum_id, aimag_id)
		return Response(forms, status=200)

	def _member_rows(self, project_id, sum_id=None, aimag_id=None):
		"""Хавсралт 9‑ийн мөрүүд — төслийн багийн бүрэлдэхүүн (сумаар шүүнэ)."""
		from core.models import ProjectMember
		mq = (ProjectMember.objects.filter(project_id=project_id)
		      .select_related('unit', 'unit__parent', 'position', 'person'))
		if sum_id:
			mq = mq.filter(unit_id=sum_id)
		elif aimag_id:
			mq = mq.filter(Q(unit_id=aimag_id) | Q(unit__parent_id=aimag_id))
		out = []
		for i, m in enumerate(mq.order_by('unit__unit', 'id'), start=1):
			out.append({
				'i': i, 'id': m.id,
				# Хүний мэдээлэл — зөвхөн RemoteUser (person) дээрээс
				'name': (m.person.full_name if m.person_id else ''),
				'register': (m.person.register if m.person_id else ''),
				'phone': (m.person.phone if m.person_id else '') or '',
				'position': m.position.name if m.position_id else '',
				'unit': m.unit.unit if m.unit_id else '',
			})
		return out

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

		# Цэг + нэрлэвэрийг урьдчилж багцаар (масштаб тус бүрд 1 query)
		rows_all = list(qs)
		pts_by_rid = {}
		for r in rows_all:
			p = r.loc or (r.name.geoloc if r.name_id else None)
			if p is not None and p.geom_type != 'Point':
				p = p.centroid
			pts_by_rid[r.id] = p

		def _pkey(p):
			return (round(p.x, 6), round(p.y, 6))

		nomek_cache = {self.SCALE_25K: {}, self.SCALE_100K: {}}
		uniq_pts = {}
		for p in pts_by_rid.values():
			if p is not None:
				uniq_pts.setdefault(_pkey(p), p)
		if uniq_pts:
			from django.contrib.gis.geos import MultiPoint
			mp = MultiPoint(list(uniq_pts.values()), srid=4326)
			for sid in (self.SCALE_25K, self.SCALE_100K):
				cache = nomek_cache[sid]
				for nk in Nomek.objects.filter(
						scale_id=sid, geom__intersects=mp).only('nomek', 'geom'):
					prep = nk.geom.prepared
					for k, pp in uniq_pts.items():
						if k not in cache and prep.contains(pp):
							cache[k] = nk.nomek

		def nomek_at(pt, scale_id):
			if pt is None:
				return ''
			return nomek_cache.get(scale_id, {}).get(_pkey(pt), '')

		def row(r, i):
			pt = pts_by_rid.get(r.id)
			lat = lon = None
			if pt is not None:
				lon, lat = round(pt.x, 6), round(pt.y, 6)
			return {'i': i, 'name': (r.name.name if r.name_id else '') or '',
					'draft': r.draft or (r.name.name if r.name_id else '') or '', 'lat': lat, 'lon': lon,
					'gtype': (
						(r.name.type.name if (r.name_id and r.name.type_id) else None)
						or ((r.draft or '').strip().split() or [''])[-1]),
					'nomek_25k': nomek_at(pt, self.SCALE_25K),
					'nomek_100k': nomek_at(pt, self.SCALE_100K)}

		# Маягт 9 — багийн бүрэлдэхүүн (тодруулалттай хамааралгүй)
		if str(form_no) == '9':
			m_rows = self._member_rows(project_id, sum_id,
			                           request.query_params.get('aimag_geom'))
			pdf = build_mayagt_pdf('9', m_rows, aimag_name, sum_name)
			resp = HttpResponse(pdf, content_type='application/pdf')
			resp['Content-Disposition'] = 'attachment; filename="mayagt_9.pdf"'
			return resp

		# Төлөв → маягт (Constant.desc = маягтын дугаар) — DB‑ээс удирдагдана
		bucket = self._status_form_map()
		matched = []
		for r in rows_all:
			# ОЛОН төлөв (M2M) — аль нэг төлөв нь тухайн маягтад тохирвол орно
			bs = {bucket.get(s.id) for s in r.statuses.all()}
			if form_no in bs:
				matched.append(r)

		# Аймаг → сум → нэрээр сортолно (сум/аймгийг цэгийн орон зайгаар олно, кэштэй)
		au_cache = {}

		def _pt(r):
			p = r.loc or (r.name.geoloc if r.name_id else None)
			if p is None:
				return None
			return p if p.geom_type == 'Point' else p.centroid

		# Сум/дүүргийг мөр бүрд query хийлгүй НЭГ УДАА багцаар тодорхойлно
		# (өмнө нь мөр тутамд орон зайн query явж PDF удаан үүсдэг байсан).
		_sort_pts = {}
		for r in matched:
			c = _pt(r)
			if c is not None:
				_sort_pts.setdefault((round(c.x, 5), round(c.y, 5)), c)
		if _sort_pts:
			from django.contrib.gis.geos import MultiPoint
			mp2 = MultiPoint(list(_sort_pts.values()), srid=4326)
			for su in (AdminUnit.objects
					   .filter(level__name='Сум/Дүүрэг', geom__intersects=mp2)
					   .select_related('parent')):
				prep = su.geom.prepared
				a = (su.parent.unit if su.parent_id else '') or '￿'
				sname = (su.unit or '') or '￿'
				for k, c in _sort_pts.items():
					if k not in au_cache and prep.contains(c):
						au_cache[k] = (a, sname)

		def _sort_key(r):
			c = _pt(r)
			if c is None:
				a = s = '￿'
			else:
				k = (round(c.x, 5), round(c.y, 5))
				a, s = au_cache.get(k, ('￿', '￿'))
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

	@action(detail=False, methods=['get'], url_path='unit-tree')
	def unit_tree(self, request):
		"""Тодруулалтын сан — БҮХ recount‑ыг Засаг захиргааны нэгжээр
		(Аймаг → Сум → recount нэр) модлон бүлэглэнэ. Навч бүр нэг recount
		(id, name). project дамжуулбал зөвхөн тухайн төслөөр шүүнэ.
		Батлагдсан нэрсийн газрын зураг дээр 2‑р таб (project‑гүй) ашиглана."""
		from django.db import connection
		# recount_view WMS‑ийг GeoServer‑т нийтэлсэн байлгана (тодруулах давхаргад)
		try:
			from apps.geoserver.apiviews import ensure_recount_view
			ensure_recount_view()
		except Exception:
			pass
		pid = request.query_params.get('project')
		name_q = (request.query_params.get('name') or '').strip()
		# ЗӨВХӨН геометртэй тодруулалт — тооллогын өөрийн loc, эс бөгөөс
		# холбогдсон нэрийн geoloc байх ёстой (газрын зурагт зурагдана).
		conds = ["lvl.name = 'Сум/Дүүрэг'",
		         '(r.loc IS NOT NULL OR g.geoloc IS NOT NULL)']
		params = []
		if pid:
			conds.append('r.project_id = %s')
			params.append(pid)
		if name_q:
			conds.append('COALESCE(g.name, r.draft) ILIKE %s')
			params.append('%' + name_q + '%')
		where = ' AND '.join(conds)
		sql = (
			'SELECT r.id AS rid, COALESCE(g.name, r.draft) AS rname, '
			's.id AS sum_id, s.unit AS sum_name, '
			'a.id AS aimag_id, a.unit AS aimag_name '
			'FROM core_recount r '
			'JOIN core_geoname g ON g.id = r.name_id '
			'JOIN core_geoname_unit gu ON gu.geoname_id = g.id '
			'JOIN core_adminunit s ON s.id = gu.adminunit_id '
			'JOIN core_constant lvl ON lvl.id = s.level_id '
			'LEFT JOIN core_adminunit a ON a.id = s.parent_id '
			'WHERE ' + where + ' '
			'ORDER BY a.unit, s.unit, rname'
		)
		with connection.cursor() as c:
			c.execute(sql, params)
			rows = c.fetchall()
		# Аймаг → Сум → recount навч
		roots = {}
		for rid, rname, sum_id, sum_name, aimag_id, aimag_name in rows:
			a_key = aimag_id if aimag_id is not None else 0
			a_name = aimag_name or 'Аймаг тодорхойгүй'
			root = roots.setdefault(a_key, {
				'id': 'a%s' % a_key, 'name': a_name, 'count': 0, 'children': {},
			})
			root['count'] += 1
			sm = root['children'].setdefault(sum_id, {
				'id': 's%s' % sum_id, 'name': sum_name or '—',
				'count': 0, 'children': [], 'child_count': 0,
			})
			sm['count'] += 1
			# recount навчийг буцаахгүй (сум дараад unit_ids‑ээр шүүдэг тул зөвхөн тоо)

		def finalize(n):
			kids = list(n['children'].values()) if isinstance(n['children'], dict) else n['children']
			n['children'] = sorted(kids, key=lambda x: x['name'])
			n['child_count'] = len(n['children'])
			return n

		results = sorted((finalize(r) for r in roots.values()),
						 key=lambda x: x['name'])
		return Response({'results': results})


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
	# Нэр + төрөл, нэгж, төлвөөр хайна
	search_fields = ['name', 'kind__name', 'unit__unit', 'status__name']
	# Хүснэгтийн толгойгоор эрэмбэлэх (холбоост талбарууд ч)
	ordering_fields = [f.name for f in Council._meta.fields] + [
		'kind__name', 'unit__unit', 'unit__parent__unit', 'status__name']
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
	queryset = CouncilMember.objects.select_related('person', 'position', 'appoint_doc', 'release_doc')
	permission_classes = [IsAuthenticated]
	filter_backends = [DjangoFilterBackend, filters.OrderingFilter, filters.SearchFilter]
	search_fields = ['person__last_name', 'person__first_name', 'person__register', 'org_title']

	def destroy(self, request, *args, **kwargs):
		"""Гишүүнийг устгана — АЛДААТАЙ бүртгэлийг арилгах зориулалттай.

		Ердийн урсгалд томилгоо нь архив (append‑only) тул чөлөөлөхдөө
		`release` (end_date + release_doc)‑ыг ашиглана. Устгалт нь буруу
		оруулсан мөрийг л цэвэрлэнэ.
		"""
		return super().destroy(request, *args, **kwargs)

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
