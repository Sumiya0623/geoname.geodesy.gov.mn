
import datetime, requests

from django.conf import settings
from django.utils import timezone
from django.db import transaction
from django.utils.dateparse import parse_datetime, parse_date

from rest_framework import viewsets,filters
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from core.mixin import PublicListMixin
from portal.auth import function_permission
from core.filters import GlobalFilter

from .serializers import (
    ProjectSerializer,
    ProjectAreaSerializer
)
from core.models import (
    Project,
    ProjectArea,
	RemoteUser
)




class ProjectViewSet(PublicListMixin, viewsets.ModelViewSet):
	serializer_class =ProjectSerializer
	queryset=Project.objects.all()
	filterset_class = GlobalFilter
	permission_classes = [IsAuthenticated]
	filter_backends = [DjangoFilterBackend, filters.OrderingFilter, filters.SearchFilter]
	ordering_fields = [f.name for f in Project._meta.fields]+['projectId']

	# ── Төслийн хамрах ЗЗ нэгж (units M2M) — ТУСДАА эрхээр хамгаалсан ──
	# Роль дээр 'agreement' submenu‑гийн unit_add / unit_remove үйлдэл шаардана.
	def _unit_ids(self, request):
		raw = request.data.get('units')
		if raw is None:
			raw = request.data.get('unit_ids')
		if raw is None:
			return []
		if not isinstance(raw, (list, tuple)):
			raw = [raw]
		out = []
		for v in raw:
			try:
				out.append(int(v))
			except (TypeError, ValueError):
				continue
		return out

	@action(detail=True, methods=['post'], url_path='unit-add',
	        permission_classes=function_permission('agreement'))
	def unit_add(self, request, *args, **kwargs):
		"""Төсөлд засаг захиргааны нэгж НЭМЭХ (эрх: agreement/unit_add)."""
		project = self.get_object()
		ids = self._unit_ids(request)
		if not ids:
			return Response({'detail': 'units шаардлагатай'}, status=400)
		project.units.add(*ids)
		return Response({'detail': 'Нэмэгдлээ',
		                 'units': list(project.units.values_list('id', flat=True))})

	@action(detail=True, methods=['post'], url_path='unit-remove',
	        permission_classes=function_permission('agreement'))
	def unit_remove(self, request, *args, **kwargs):
		"""Төслөөс засаг захиргааны нэгж ХАСАХ (эрх: agreement/unit_remove)."""
		project = self.get_object()
		ids = self._unit_ids(request)
		if not ids:
			return Response({'detail': 'units шаардлагатай'}, status=400)
		project.units.remove(*ids)
		return Response({'detail': 'Хасагдлаа',
		                 'units': list(project.units.values_list('id', flat=True))})
	@transaction.atomic
	@action(detail=False, methods=['post'], url_path='sync')
	def sync(self, request, *args, **kwargs):
		"""Регистрийн дугаараар (10 тэмдэгт) ХУР системээс иргэний мэдээлэл татна.
		Хэрэглэгчийн token‑оор баталгаажуулж geodesy.gov.mn check-user руу дамжуулна."""
		user = request.user
		token = None
		auth = request.headers.get('Authorization', '')
		if auth.lower().startswith('bearer '):
			token = auth.split(' ', 1)[1]
		if not token:
			token = request.COOKIES.get(
				settings.SIMPLE_JWT.get('COOKIE_ACCESS', 'access_token'))
		try:
			headers = {
				'Content-Type': 'application/json',
				'Authorization': f'Bearer {token}' 
			}
			r = requests.post(
				f'{settings.PROJECT_DOMAIN}/api/client/project/geoname/',
				json={'register': user.register}, headers=headers, timeout=15)
		except requests.RequestException:
			return Response({'detail': 'ХУР системтэй холбогдож чадсангүй'}, status=502)
		if r.status_code == 200:
			try:
				data = r.json()	
				print(data)			
				for row in data.get("results", []):
					company = row.get("company") or {}
					org = None
					if company.get("register"):
						org = RemoteUser.objects.filter(register=company["register"]).first()
						signed_date = row.get("signed_date")
						end_date = row.get("end_date")
						if isinstance(signed_date, str):
								dt = parse_datetime(signed_date)
								if dt is None:
										d = parse_date(signed_date)
										if d:
												dt = datetime.datetime.combine(d, datetime.datetime.min.time())
								signed_date = dt
						if isinstance(end_date, str):
								dt = parse_datetime(end_date)
								if dt is None:
										d = parse_date(end_date)
										if d:
												dt = datetime.datetime.combine(d, datetime.datetime.min.time())
								end_date = dt
						if signed_date and timezone.is_naive(signed_date):
								signed_date = timezone.make_aware(
										signed_date,
										timezone.get_current_timezone()
								)

						if end_date and timezone.is_naive(end_date):
								end_date = timezone.make_aware(
										end_date,
										timezone.get_current_timezone()
								)

						proj, crtd = Project.objects.update_or_create(
								org=org,
								name=row.get("name") or "",
								dugaar=row.get("dugaar") or "",
								defaults={
										"percent": row.get("total_percent") or 0,
										"signed_date": signed_date,
										"end_date": end_date,
										"oldid": row.get("id"),
								},
						)
				return Response({'status': 'success'}, status=200)
			except ValueError:
				return Response({'detail': 'Хариу буруу форматтай'}, status=502)
		return Response({'detail': 'Гэрээт ажлын дэд системээс мэдээлэл олдсонгүй'}, status=r.status_code)

	def get_queryset(self):
		qs = super().get_queryset()
		user = self.request.user
		if not self.request.user.roles.filter(name__in=settings.ADMIN_LIST).exists():
			if user.is_citizen:
				qs = qs.filter(org=user.org)
			else:
				qs = qs.filter(org=user)
		return qs


class ProjectAreaViewSet(PublicListMixin, viewsets.ModelViewSet):
	"""Төслийн ажлын талбай (ProjectArea) — газрын зураг дээр зурсан polygon.

	Том хэмжээний зураглалын ажлыг талбайчлан хуваарилж, дуусгасан эсэхийг
	(is_finished) тэмдэглэхэд ашиглана. ?project=<id> ‑ээр шүүнэ.

	Эрх: SUBMENUS code='project-area' (Зураглах талбай удирдах) —
	list/detail = харах, create = нэмэх, update = засах, delete = устгах.
	"""
	serializer_class = ProjectAreaSerializer
	queryset = ProjectArea.objects.select_related('project', 'user')
	permission_classes = function_permission('project-area')
	filter_backends = [filters.OrderingFilter]
	ordering_fields = ['id', 'created_date', 'is_finished']
	ordering = ['id']

	def get_queryset(self):
		qs = super().get_queryset()
		project = self.request.query_params.get('project')
		if project:
			qs = qs.filter(project_id=project)
		return qs

	def perform_create(self, serializer):
		user = self.request.user if self.request.user.is_authenticated else None
		serializer.save(user=user)
