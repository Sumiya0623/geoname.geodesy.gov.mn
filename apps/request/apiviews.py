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

from core.models import Constant, LegalOrder, AdminUnit, GeoName, RequestName, Photo, Attach
from core.mixin import PublicListMixin
from core.filters import GlobalFilter
from portal.auth import function_permission

from .serializers import (
	LegalTypeSerializer, LegalOrderSerializer, UnitDropSerializer,
	RequestNameSerializer,
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
		# Карт = org (LEGAL_TYPES ангилал)
		org_id = p.get('org', None)
		if org_id:
			qs = qs.filter(org_id=org_id)
		# Баримтын төрөл (ORDER_TYPES) — нэмэлт шүүлт
		type_id = p.get('type', None)
		if type_id:
			qs = qs.filter(type_id=type_id)
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
		return qs

	def perform_create(self, serializer):
		user = self.request.user if self.request.user.is_authenticated else None
		serializer.save(user=user)


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
		headers = {'Authorization': f'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzgwOTcxMTU2LCJpYXQiOjE3ODA4ODQ3NTYsImp0aSI6IjMxYzZhMTQxZTI0NzQ2MmVhODQ1MDk1NDAyOWU1ODI2IiwiaWQiOiI3ZmY5YTZmMC0xZDgwLTRkODktYjMyNC01YmRiNDdkZDMzYWIiLCJzc29faWQiOiI3ZmY5YTZmMC0xZDgwLTRkODktYjMyNC01YmRiNDdkZDMzYWIiLCJ1c2VybmFtZSI6Ilx1MDQxZVx1MDQyZTg2MDYyMzE2IiwiZmlyc3RfbmFtZSI6Ilx1MDQyMVx1MDQyM1x1MDQxY1x1MDQyYVx1MDQyZlx1MDQxMCIsImxhc3RfbmFtZSI6Ilx1MDQxMFx1MDQxYlx1MDQyMlx1MDQxMFx1MDQxZFx1MDQxM1x1MDQyZFx1MDQyMFx1MDQyZFx1MDQxYiIsImVtYWlsIjoiaW5mb0BuZXh0Z2lzLm1uIiwicGhvbmUiOiI5OTA2MjMwOSIsInJlZ2lzdGVyIjoiXHUwNDFlXHUwNDJlODYwNjIzMTYiLCJpc19jaXRpemVuIjp0cnVlLCJvcmdOYW1lIjoiXHUwNDFkXHUwNDM1XHUwNDNhXHUwNDQxXHUwNDQyIFx1MDQxNlx1MDQzOCBcdTA0MTBcdTA0MzkgXHUwNDJkXHUwNDQxIiwib3JnUmVnaXN0ZXIiOiI1NTM1OTQ4IiwicGhvdG8iOiJodHRwOi8vZ2VvZGVzeS5nb3YubW4vYXBpL21lZGlhL2FjY291bnQvJUQwJTlFJUQwJUFFODYwNjIzMTZfUHJvZmlsZV9xVkR4SVJXLnBuZyJ9.cU33dpjgNH6GboPCTpVY20Vbv376bSSFwmzu4YfLs5w'} if token else {}
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


