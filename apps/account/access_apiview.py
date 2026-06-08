import datetime
from django.utils import timezone
from rest_framework import viewsets
from core.mixin import PublicListMixin
from core.filters import GlobalFilter
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters
from rest_framework.parsers import MultiPartParser, FormParser,JSONParser
from rest_framework.permissions import IsAuthenticated, BasePermission,AllowAny
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db.models import Count, Q
from django.db.models.functions import TruncDay, TruncMonth, TruncYear, TruncHour

from core.models import (
    RequestLog,
    Error500,
    Errors,
    RemoteUser
)

from .serializers import (
    RequestLogSerializer,
    ErrorSerializer,
    Error500Serializer,
    UserStatusSerializer,
    ActionStatusSerializer
    )

class IsSuperUser(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        # таны талбарт тааруул: is_super_user (custom) эсвэл is_superuser (Django default)
        return bool(user and user.is_authenticated and (
            getattr(user, 'is_super_user', False) or getattr(user, 'is_superuser', False)
        ))

class Error400ViewSet(PublicListMixin, viewsets.ModelViewSet):
    serializer_class = ErrorSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter, filters.SearchFilter]
    queryset=Errors.objects.all().order_by('-id')
    filterset_class = GlobalFilter
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter, filters.SearchFilter]
    ordering_fields = [f.name for f in Errors._meta.fields]

class Error500ViewSet(PublicListMixin, viewsets.ModelViewSet):
    serializer_class = Error500Serializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter, filters.SearchFilter]
    queryset=Error500.objects.all().order_by('-id')
    filterset_class = GlobalFilter
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter, filters.SearchFilter]
    ordering_fields = [f.name for f in Error500._meta.fields]

class RequestLogViewSet(PublicListMixin, viewsets.ModelViewSet):
    queryset =RequestLog.objects.all().order_by('-id')
    serializer_class = RequestLogSerializer
    permission_classes = [IsAuthenticated]
    filterset_class = GlobalFilter
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter, filters.SearchFilter]
    ordering_fields = [f.name for f in RequestLog._meta.fields]+['status_code']
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    @action(detail=False,methods=["get"], url_path=r'login', permission_classes=[IsAuthenticated])
    def login(self, request, *args, **kwargs):
        qs = self.queryset.filter(
            url__in=[
                '/api/account/token/',
                '/api/account/logout/',
                '/api/account/request/login/',
            ]
        )
        qs = self.filter_queryset(qs)
        page = self.paginate_queryset(qs)
        if page is not None:
            ser = self.get_serializer(page, many=True)
            return self.get_paginated_response(ser.data)
        data=self.get_serializer(qs, many=True).data
        return Response({"results": data}, status=200)
    @action(detail=False, methods=["get"], url_path="stats")
    def stats(self, request):
        gran = request.query_params.get("interval", "hours").lower()  # day|month|year
        tz = timezone.get_current_timezone()  # эсвэл ?tz=Asia/Ulaanbaatar аваад zoneinfo гаргаж болно
        if gran == "year":
            trunc = TruncYear("datetime", tzinfo=tz)
        elif gran == "month":
            trunc = TruncMonth("datetime", tzinfo=tz)
        elif gran== "day":
            trunc = TruncDay("datetime", tzinfo=tz)
        else:
            trunc = TruncHour("datetime", tzinfo=tz)
        qs = self.filter_queryset(self.get_queryset())
        method = request.query_params.get("method")
        if method:
            qs = qs.filter(method=method)

        date_from = request.query_params.get("from", None)
        date_to   = request.query_params.get("to", None)
        if date_from:
            qs = qs.filter(datetime__gte=date_from)
        if date_to:
            qs = qs.filter(datetime__lte=date_to)
        rows = (
            qs.annotate(period=trunc)
              .values("period")
              .annotate(count=Count("id"))
              .order_by("period")
        )
        out = [{"period": r["period"].isoformat(), "count": r["count"]} for r in rows]
        return Response({"results": out}, status=200)
    def get_queryset(self):
        qs = super().get_queryset()
        status_code = self.request.query_params.get("status_code", None)
        if status_code == 'login':
            try:
                django_request = self.request._request
                qd = django_request.GET
                if hasattr(qd, "_mutable"):
                    old_mut = qd._mutable
                    qd._mutable = True
                    qd.pop("status_code", None)
                    qd._mutable = old_mut
            except Exception:
                pass

            return qs.filter(url="/api/core/user/me/", status_code=200)

        return qs
class StatusAPIView(APIView):
    permission_classes = [AllowAny]
    serializer_class = UserStatusSerializer
    action = None
    def get(self, request, *args, **kwargs):
        if self.action == 'user':
            return self._user_status(request)
        elif self.action == 'action':
            return self._action_status(request)
        return Response({"detail": "Invalid endpoint kind"}, status=400)
    
    def _user_status(self, request):
        qs = RemoteUser.objects.all()
        pk   = request.query_params.get('pk')
        if pk:
            try:
                qs = qs.filter(pk=int(pk))
            except (TypeError, ValueError):
                qs = qs.none()
        now = timezone.now()
        data = {
            'total': qs.count(),
            'today': qs.filter(last_login__date=now.date()).count(),
            'this_month': qs.filter(last_login__year=now.year,
                                    last_login__month=now.month).count(),
            'this_year': qs.filter(last_login__year=now.year).count(),
        }
        return Response({"results": UserStatusSerializer(data).data}, status=200)
    def _action_status(self, request):
        qs = RequestLog.objects.all()
        method = request.query_params.get('method')
        status_code = request.query_params.get('status_code')
        if method:
            qs = qs.filter(method=method)
        if status_code:
            try:
                qs = qs.filter(status_code=int(status_code))
            except (TypeError, ValueError):
                qs = qs.none()
        counts = qs.aggregate(
            get    = Count('id', filter=Q(method='GET')),
            post   = Count('id', filter=Q(method='POST')),
            put    = Count('id', filter=Q(method='PUT')),
            patch  = Count('id', filter=Q(method='PATCH')),
            delete = Count('id', filter=Q(method='DELETE')),
        )
        return Response({"results": ActionStatusSerializer(counts).data}, status=200)
