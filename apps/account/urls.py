from django.urls import path
from rest_framework.routers import DefaultRouter

router = DefaultRouter()
from .access_apiview import (
    Error500ViewSet,
    Error400ViewSet,
    RequestLogViewSet,
    StatusAPIView
)
router.register('request', RequestLogViewSet, basename='request-log')
router.register('500', Error500ViewSet, basename='500')
router.register('400', Error400ViewSet, basename='400')

urlpatterns =[
    path('status/user/',   StatusAPIView.as_view(action='user'),   name='user-status'),
    path('status/action/', StatusAPIView.as_view(action='action'), name='action-status'),
]
urlpatterns += router.urls