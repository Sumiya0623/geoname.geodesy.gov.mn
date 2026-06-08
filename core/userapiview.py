from datetime import timedelta
from rest_framework import viewsets, status, generics
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.exceptions import PermissionDenied
from notifications.models import Notification
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.parsers import MultiPartParser, FormParser,JSONParser
from rest_framework import filters
from rest_framework_simplejwt.tokens import RefreshToken
from portal.auth import function_permission
from django.conf import settings
from django.db.models import Count, Sum

from core.mixin import PublicListMixin
from core.filters import GlobalFilter


from core.models import (
	Constant,
	RemoteUser,
	SubMenuPermission,
	MailLog,
	AdminUnit
	)

from .serializers import (
	NotificationSerializer,
	MailLogSerializer,
	AdminUnitSerializer,
	AdminUnitDropDownSerializer,
	ConstantSerializer,
	ConstantUpdateOrCreateSerializer,
	ConstantDropDownSerializer,
	ConstantStatusSerializer,
	UserListSerializer,
	UserRoleUpdateOrCreateSerializer,
	ProfileDropDownSerializer,
	MenuSerializer,
	MeSerializer,
	SubMenuActionSerializer

)

sj = settings.SIMPLE_JWT
access_name  = sj.get('COOKIE_ACCESS',  'access_token')
refresh_name = sj.get('COOKIE_REFRESH', 'refresh_token')
domain   = sj.get('COOKIE_DOMAIN') or None
secure   = bool(sj.get('COOKIE_SECURE', True))
httponly = bool(sj.get('COOKIE_HTTP_ONLY', True))
samesite = str(sj.get('COOKIE_SAMESITE', 'Lax')).capitalize()
if samesite not in ('Lax', 'None', 'Strict'):
	samesite = 'Lax'
at_life = sj.get('ACCESS_TOKEN_LIFETIME', timedelta(minutes=5))
rt_life = sj.get('REFRESH_TOKEN_LIFETIME', timedelta(days=1))
access_max_age  = int(at_life.total_seconds())
refresh_max_age = int(rt_life.total_seconds())


class ConstantViewSet(PublicListMixin, viewsets.ModelViewSet):
	serializer_class = ConstantSerializer
	queryset=Constant.objects.all().order_by('key')
	filterset_class = GlobalFilter
	permission_classes=function_permission('constant')
	parser_classes = [JSONParser, MultiPartParser, FormParser]
	filter_backends = [DjangoFilterBackend, filters.OrderingFilter, filters.SearchFilter] 
	ordering_fields = [f.name for f in Constant._meta.fields]+['parent']
	def get_permissions(self):
		if getattr(self, "action", None) == "role":
			perms = function_permission('role')
		elif getattr(self, "action", None) == "menus":
			perms = function_permission('menus')
		elif getattr(self, "action", None) == "submenus":
			perms = function_permission('submenus')
		elif getattr(self, "action", None) == "nameclass":
			perms = function_permission('nameclass')
		else:
			perms = function_permission('constant')
		return [perm() for perm in perms]
	def get_serializer_class(self):
		if self.action in ['update, partial_update, create']:
			return ConstantUpdateOrCreateSerializer
		if self.request.query_params.get('dropdown'):
			return ConstantDropDownSerializer
		return super().get_serializer_class()
	@action(detail=True, methods=['get'],url_path='role', permission_classes=[AllowAny])
	def role(self, request, *args, **kwargs):
		obj=self.get_object()
		data =ConstantSerializer(obj).data
		return Response(data, status=200)
	@action(detail=False, methods=['get'], url_path='menus',permission_classes=function_permission('menus'))
	def menus(self, request):
		parent=self.request.query_params.get('parent', None)
		if parent:
			menus = Constant.objects.filter(parent=self.request.query_params.get('parent'))
		else:
			menus = Constant.objects.filter(key='PARENT_MENUS').order_by('id')
		serializer = MenuSerializer(menus, many=True)
		return Response({"results": serializer.data}, status=200)

	@action(detail=False, methods=['get'], url_path='nameclass', permission_classes=function_permission('nameclass'))
	def nameclass(self, request):
		# Дэвсгэр нэрийн ангилал — key‑ээр үндсэн төрөл, parent‑аар дэд ангилал.
		# Мөр бүрт child_count. CRUD нь энгийн constant endpoint‑оор хийгдэнэ.
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

	@action(detail=True, methods=['get'], url_path='submenu-actions')
	def submenu_actions(self, request, *args, **kwargs):
		submenu = self.get_object()
		perms = SubMenuPermission.objects.filter(submenu=submenu).select_related('action')
		assigned_ids = list(perms.values_list('action_id', flat=True))
		available = Constant.objects.filter(key='ACTION_TYPES').exclude(id__in=assigned_ids).order_by('name')
		return Response({
			'actions': SubMenuActionSerializer(perms, many=True).data,
			'available': [{'id': c.id, 'name': c.name, 'label': c.label or c.name} for c in available],
		}, status=200)

	@action(detail=True, methods=['post'], url_path='add-action')
	def add_action(self, request, *args, **kwargs):
		submenu = self.get_object()
		if submenu.key != 'SUBMENUS':
			return Response({'detail': 'Зөвхөн дэд цэс дээр боломжтой'}, status=400)
		action_id = request.data.get('action')
		name = (request.data.get('name') or '').strip()
		label = (request.data.get('label') or name).strip()
		if action_id:
			action_const = Constant.objects.filter(id=action_id, key='ACTION_TYPES').first()
			if not action_const:
				return Response({'detail': 'Action олдсонгүй'}, status=404)
		elif name:
			action_const, _ = Constant.objects.get_or_create(key='ACTION_TYPES', name=name, defaults={'label': label or name})
		else:
			return Response({'detail': 'action эсвэл name шаардлагатай'}, status=400)
		perm, created = SubMenuPermission.objects.get_or_create(submenu=submenu, action=action_const)
		return Response(SubMenuActionSerializer(perm).data, status=201 if created else 200)

	@action(detail=True, methods=['post'], url_path='remove-action')
	def remove_action(self, request, *args, **kwargs):
		submenu = self.get_object()
		perm_id = request.data.get('permission')
		perm = SubMenuPermission.objects.filter(id=perm_id, submenu=submenu).first()
		if not perm:
			return Response({'detail': 'Олдсонгүй'}, status=404)
		perm.delete()
		return Response({'detail': 'Устгалаа'}, status=200)
	@action(detail=False, methods=['get'], url_path='submenus')
	def submenus(self, request):
		menus = Constant.objects.filter(key='SUBMENUS').order_by('id')
		if self.request.query_params.get('parent'):
			menus = menus.filter(parent=self.request.query_params.get('parent'))
		serializer = MenuSerializer(menus, many=True)
		return Response({"results": serializer.data}, status=200)
	# --- GEONAME_TYPES навч ангилал ↔ GeoServer view автомат синк ---
	# View ЗӨВХӨН хүүхэдгүй (навч) ангилалд үүснэ. Зангилаа хүүхэдтэй (parent)
	# бол view үүсэхгүй. Логик нь node‑local: тухайн зассан/нэмсэн зангилаагаа л
	# хөнддөг (удам руугаа дамждаггүй), parent засахад view үүсгэхгүй.
	def _sync_one_geoname(self, node, old_name=None):
		"""Тухайн зангилааны view‑г л зохицуулна. Навч бол үүсгэ/шинэчил,
		хүүхэдтэй бол өөрийнх нь хуучин view‑г устга."""
		try:
			from apps.geoserver.apiview import (
				is_geoname_leaf, sync_geoname_type_view,
				geoname_type_view_name, _drop_featuretype_and_view)
			if is_geoname_leaf(node):
				new_name = sync_geoname_type_view(node)
				if old_name and old_name != new_name:
					_drop_featuretype_and_view(old_name)
			else:
				# хүүхэдтэй → view байх ёсгүй
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
			from apps.geoserver.apiview import (
				geoname_type_view_name, _drop_featuretype_and_view)
			_drop_featuretype_and_view(geoname_type_view_name(parent))
		except Exception:
			pass

	def perform_update(self, serializer):
		data = serializer.validated_data
		if data.get("key") == "SUBMENUS":
			_, FuncPerm = function_permission('menus')
			perm = FuncPerm()
			if not perm.has_permission(self.request, self):
				raise PermissionDenied("Танд меню засах эрх байхгүй байна.")
		node = serializer.instance
		old_name = None
		if node and node.key == 'GEONAME_TYPES':
			try:
				from apps.geoserver.apiview import geoname_type_view_name
				old_name = geoname_type_view_name(node)  # хуучин код‑оор
			except Exception:
				old_name = None
		instance = serializer.save()
		if instance.key == 'GEONAME_TYPES':
			self._sync_one_geoname(instance, old_name=old_name)
		return instance
	def perform_create(self, serializer):
		parent = serializer.validated_data.get('parent')
		instance=serializer.save()
		if instance.key=='SUBMENUS':
			actions=self.queryset.filter(key='ACTION_TYPES')
			for action in actions:
				act, crtd=SubMenuPermission.objects.update_or_create(
					submenu=instance,
					action=action,
				)
				instance.actions.add(act)
		if instance.key == 'GEONAME_TYPES':
			# Шинэ зангилаа навч → view үүснэ; parent нь навч биш боллоо → view устна
			self._sync_one_geoname(instance)
			self._drop_parent_view(parent)
	def get_queryset(self):
		qs=self.queryset.exclude(key__in=['create', 'delete', 'update', 'list','detail']).distinct()
		if self.request.query_params.get('type') == 'dropdown' and self.request.query_params.get('parent'):
			qs=qs.order_by('name').distinct()
		return qs		
	
	@action(detail=False, methods=['get'], url_path='geoserverfields')
	def geoserverfields(self, request):
		qs = super().get_queryset()
		field_name = self.request.query_params.get('field')
		fields = qs.filter(name=field_name, key='GSCONSTANTS')
		if fields:
			field=fields.first()
			qs=qs.filter(key=field.desc).order_by('name')
			serializer = self.get_serializer(qs, many=True)		
			return Response({"results":	serializer.data}, status=200)
		else:
			return Response({"results":	[]}, status=200)

	def perform_destroy(self, instance):
		if instance.key == 'SUBMENUS':
			_, FuncPerm = function_permission('menus')
			perm = FuncPerm()
			if not perm.has_permission(self.request, self):
				raise PermissionDenied("Танд меню устгах эрх байхгүй байна.")
		# Устгахаас өмнө холбоотой навч view нэрс + parent‑ийг цуглуулна (CASCADE‑д устахаас)
		names, parent = [], None
		if instance.key == 'GEONAME_TYPES':
			try:
				from apps.geoserver.apiview import (
					geoname_leaf_descendants, geoname_type_view_name)
				names = [geoname_type_view_name(c)
						 for c in geoname_leaf_descendants(instance)]
				names.append(geoname_type_view_name(instance))  # өөрийн (stale) view ч устга
			except Exception:
				names = []
			parent = instance.parent
		result = super().perform_destroy(instance)
		if instance.key == 'GEONAME_TYPES':
			try:
				from apps.geoserver.apiview import _drop_featuretype_and_view
				for n in names:
					_drop_featuretype_and_view(n)
				# parent сүүлийн хүүхдээ алдаж навч болсон бол view авна
				if parent:
					self._sync_one_geoname(parent)
			except Exception:
				import logging
				logging.getLogger(__name__).warning("geoname view drop failed", exc_info=True)
		return result
	
class AdminUnitViewSet(PublicListMixin, viewsets.ModelViewSet):
	"""Засаг захиргааны нэгж (AdminUnit) — мод (Аймаг→Сум→Баг), parent‑аар lazy ачаална.

	- ?parent=<id> → тухайн нэгжийн дэд нэгжүүд (хоосон бол parent__isnull = язгуур)
	- subcount     → хүүхдийн тоо (мод дэлгэх товч)
	- /dropdown    → сонголтод (parent эсвэл түвшнээр)
	"""
	serializer_class = AdminUnitSerializer
	queryset = AdminUnit.objects.all()
	filterset_class = GlobalFilter
	permission_classes = [IsAuthenticated]
	parser_classes = [JSONParser, MultiPartParser, FormParser]
	filter_backends = [DjangoFilterBackend, filters.OrderingFilter, filters.SearchFilter]
	ordering_fields = [f.name for f in AdminUnit._meta.fields]

	def get_serializer_class(self):
		if self.action == 'dropdown':
			return AdminUnitDropDownSerializer
		return AdminUnitSerializer

	@action(detail=False, methods=['get'])
	def dropdown(self, request):
		qs = AdminUnit.objects.exclude(level_id=296)
		parent_unit = request.query_params.get('parent')
		filter_level = request.query_params.get('select__level')
		if parent_unit:
			qs = qs.filter(parent=parent_unit)
		elif filter_level:
			qs = qs.filter(level__in=[284, 285]).order_by('-level').distinct()
		else:
			qs = qs.filter(level__id=284).order_by('unit').distinct()
		return Response({'results': self.get_serializer(qs, many=True).data}, status=200)

	def get_queryset(self):
		qs = AdminUnit.objects.exclude(level_id=296)
		if self.action == 'list':
			unit = self.request.query_params.get('parent')
			if unit:
				qs = qs.filter(parent=unit)
			else:
				qs = qs.filter(parent__isnull=True)
			qs = qs.annotate(subcount=Count('children', distinct=True)).order_by('unit')
		return qs


class MailLogViewSet(PublicListMixin, viewsets.ModelViewSet):
	"""Системээс илгээсэн имэйлүүдийн админ хяналт — /dashboard/notification."""
	serializer_class = MailLogSerializer
	queryset = MailLog.objects.select_related('category').all()
	permission_classes = [IsAuthenticated]
	filter_backends = [DjangoFilterBackend, filters.OrderingFilter, filters.SearchFilter]
	ordering_fields = [f.name for f in MailLog._meta.fields]
	search_fields = ['to_email', 'to_user', 'subject', 'body']

	def _is_admin(self):
		return self.request.user.roles.filter(name__in=settings.ADMIN_LIST).exists()

	def get_queryset(self):
		# Зөвхөн админ бүх системийн имэйлийг хянана
		if not self._is_admin():
			return MailLog.objects.none()
		qs = MailLog.objects.select_related('category').all()
		category = self.request.query_params.get('category')
		status_param = self.request.query_params.get('status')
		if category:
			qs = qs.filter(category_id=category)
		if status_param:
			qs = qs.filter(status=status_param)
		return qs.order_by('-created_at')

	@action(detail=False, methods=['get'], url_path='status')
	def status(self, request, *args, **kwargs):
		"""Card-уудын тоолол: Бүгд + ангилал бүр."""
		from core.mail_constants import ensure_mail_categories
		if not self._is_admin():
			return Response({'results': []}, status=200)
		categories = ensure_mail_categories()
		base = MailLog.objects.all()
		results = [{
			'id': '',
			'name': 'Бүгд',
			'color': 'primary',
			'count': base.count(),
		}]
		for cat in categories:
			if not cat:
				continue
			results.append({
				'id': cat.id,
				'name': cat.name,
				'color': cat.color or 'default',
				'count': base.filter(category=cat).count(),
			})
		return Response({'results': results}, status=200)

	@action(detail=False, methods=['post'], url_path='bulk-delete')
	def bulk_delete(self, request):
		if not self._is_admin():
			return Response({'detail': 'Forbidden'}, status=403)
		ids = request.data.get('ids', [])
		deleted, _ = MailLog.objects.filter(id__in=ids).delete()
		return Response({'deleted': deleted})


class NotificationViewSet(PublicListMixin, viewsets.ModelViewSet):
	serializer_class = NotificationSerializer
	queryset=Notification.objects.all()
	permission_classes = [IsAuthenticated]
	filter_backends = [DjangoFilterBackend, filters.OrderingFilter, filters.SearchFilter] 
	def get_queryset(self):
		return Notification.objects.order_by('-timestamp').filter(recipient=self.request.user)
	def list(self, request, *args, **kwargs):
		queryset = self.get_queryset()
		page = self.paginate_queryset(queryset)
		unread_count = queryset.filter(unread=True).count()
		if page is not None:
			serializer = self.get_serializer(page, many=True)
			paginated_response = self.get_paginated_response(serializer.data)
			paginated_response.data['unread_count'] = unread_count
			return paginated_response
		serializer = self.get_serializer(queryset, many=True)
		return Response({
			'count': len(serializer.data),
			'results': serializer.data,
			'unread_count': unread_count
		})

	@action(detail=False, methods=['post'], url_path='bulk-delete')
	def bulk_delete(self, request):
		ids = request.data.get('ids', [])
		if not ids:
			return Response({"detail": "ids талбар хоосон байна."}, status=status.HTTP_400_BAD_REQUEST)
		deleted, _ = self.get_queryset().filter(id__in=ids).delete()
		return Response({"detail": f"{deleted} мэдэгдэл устгагдлаа."}, status=status.HTTP_200_OK)

	@action(detail=False, methods=['post'], url_path='bulk-read')
	def bulk_read(self, request):
		ids = request.data.get('ids', [])
		if not ids:
			return Response({"detail": "ids талбар хоосон байна."}, status=status.HTTP_400_BAD_REQUEST)
		updated = self.get_queryset().filter(id__in=ids, unread=True).update(unread=False)
		return Response({"detail": f"{updated} мэдэгдэл уншсан болголоо."}, status=status.HTTP_200_OK)

class UserViewSet(PublicListMixin, viewsets.ModelViewSet):
	serializer_class = UserListSerializer
	queryset=RemoteUser.objects.all()
	permission_classes=function_permission('user')
	filterset_class = GlobalFilter
	filter_backends = [DjangoFilterBackend, filters.OrderingFilter, filters.SearchFilter] 
	ordering_fields = [f.name for f in RemoteUser._meta.fields]+['roles_in','name_or_register']
	def get_permissions(self):
		perms = function_permission('user')
		return [perm() for perm in perms]
	@action(detail=False, methods=['get'], url_path='me',permission_classes=[AllowAny])
	def me(self, request):
		if request.user.is_authenticated:
			serializer = MeSerializer(request.user, context={'request': request})
			return Response(serializer.data)
		return Response({'ok': False}, status=401)
	@action(detail=False, methods=['post'],url_path='logout')
	def logout(self, request):
		refresh = sj.get('COOKIE_REFRESH', 'refresh_token')
		domain = sj.get('COOKIE_DOMAIN') or None
		try:
			token = RefreshToken(refresh)
			token.blacklist()
		except Exception:
			# Token байхгүй эсвэл өмнө нь ашиглагдсан байж болно – лог бичээд үргэлжилнэ.
			import logging
			logging.getLogger(__name__).info("Refresh token blacklist failed or token missing", exc_info=True)
		resp = Response({'ok': True}, status=200)
		resp.delete_cookie(access_name,  path='/', domain=domain)
		resp.delete_cookie(refresh_name, path='/', domain=domain)
		return resp
	def get_serializer_class(self):
		if self.action == 'me':
			return MeSerializer
		if self.action in ['create', 'partial_update', 'update']:
			return UserRoleUpdateOrCreateSerializer
		return UserListSerializer
	@action(detail=False, methods=['get'], url_path='related',permission_classes=function_permission('related'))
	def related(self, request):
		qs = self.get_queryset()
		user = request.user
		pagination=self.request.query_params.get('pagination', 'true').lower()
		if not self.request.user.roles.filter(name__in=settings.ADMIN_LIST).exists():
			if user.is_citizen and user.org:
				qs = qs.filter(org=user.org)
			elif user.is_citizen and not user.org:
				qs = qs.filter(id=user.id)
			else:
				qs = qs.filter(org=user)
		for backend in list(self.get_filter_backends()):
			qs = backend().filter_queryset(self.request, qs, self)
		if pagination == 'false':
			return Response(ProfileDropDownSerializer(qs.filter(is_citizen=True, is_active=True), many=True).data)
		page = self.paginate_queryset(qs)       # page бол queryset эсвэл None
		if page is not None:
			serializer = self.get_serializer(page, many=True)
			return self.get_paginated_response(serializer.data)
		serializer = self.get_serializer(qs, many=True)
		return Response(serializer.data)


MUI_COLOR_PALETTE = ["secondary", "info", "success", "warning", "error"]
def _assign_colors_from_tail(items, palette=MUI_COLOR_PALETTE, skip_first=True):
    if not isinstance(items, list) or not items:
        return items
    idx = 0
    start = 1 if skip_first else 0
    for i in range(len(items) - 1, start - 1, -1):
        if items[i].get("color"):   # аль хэдийн color байвал орхино
            continue
        items[i]["color"] = palette[idx % len(palette)]
        idx += 1
    return items

class StatusView(generics.ListAPIView):
	permission_classes = [AllowAny]
	serializer_class = ConstantStatusSerializer
	filter_backends = [DjangoFilterBackend, filters.OrderingFilter, filters.SearchFilter]
	filterset_class = GlobalFilter
	ordering_fields = [f.name for f in Constant._meta.fields]+['count']
	def get_queryset(self):
		qs = Constant.objects.all()
		filter_type = self.request.query_params.get('key')
		year=self.request.GET.get('year',None)
		user=self.request.user
		if filter_type == 'Biylelt':
			qs = Constant.objects.filter(key='Biylelt')
			if not self.request.user.roles.filter(name__in=settings.ADMIN_LIST).exists():
				qs = qs.filter(biylelts__company=self.request.user)
			if year:
				qs = qs.filter(biylelts__signed_date__year=year)
			qs = qs.annotate(count=Count('biylelts'))
		elif filter_type == 'REPORT_STEPS':
			qs = Constant.objects.filter(key='REPORT_STEPS')
			if not self.request.user.roles.filter(name__in=settings.ADMIN_LIST).exists():
				qs = qs.filter(steps__job__company=user).annotate(count=Count('steps'))
			else:
				qs = qs.annotate(count=Count('steps'))
		elif filter_type == 'FILE_REPORT_STEPS':
			qs = Constant.objects.filter(key='REPORT_STEPS')
			if not self.request.user.roles.filter(name__in=settings.ADMIN_LIST).exists():
				qs = qs.filter(steps__job__company=user).annotate(count=Count('steps__files'))
			else:
				qs = qs.annotate(count=Count('steps'))
		elif filter_type == 'USER_ROLES':
			qs = Constant.objects.filter(key='ROLES')
			if not self.request.user.roles.filter(name__in=settings.ADMIN_LIST).exists():
				if user.is_citizen:
					if user.org:
						qs=qs.filter(users__org=user.org)
					else:
						qs=qs.filter(users=user)
				else:
					qs=qs.filter(users__org=user)
			qs = qs.annotate(count=Count('roles'))
		elif filter_type == 'REQUEST_STATUS':
			qs = Constant.objects.filter(key='REQUEST_STATUS').annotate(count=Count('requeststatuses'))
		qs = qs.values('id', 'name', 'count')
		return qs
	def list(self, request, *args, **kwargs):
		queryset = self.get_queryset()
		year=self.request.GET.get('year',None)
		if not year:
			total = queryset.aggregate(total=Sum('count'))['total'] or 0
			serializer = self.get_serializer(queryset, many=True)
			data = [{"id": "", "name": "Нийт", "color": "primary", "count": total}, *serializer.data]
			data = _assign_colors_from_tail(data, palette=MUI_COLOR_PALETTE, skip_first=True)
		else:
			data = self.get_serializer(queryset, many=True).data
			data = _assign_colors_from_tail(data, palette=MUI_COLOR_PALETTE, skip_first=False)
		return Response({"results": data}, status=200)