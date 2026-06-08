from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import request_form
from .apiviews import (
	LegalTypeViewSet, LegalOrderViewSet, LegalUnitViewSet,
	RequestNameViewSet,
)


router = DefaultRouter()
router.register('legal-type', LegalTypeViewSet, basename='legal-type')
router.register('legal-unit', LegalUnitViewSet, basename='legal-unit')
router.register('legal', LegalOrderViewSet, basename='legal')
router.register('request', RequestNameViewSet, basename='request')


urlpatterns = [
	# Өргөдлийн А4 маягт (PDF)
	path('request/<int:pk>/form/', request_form, name='request-form'),
]

urlpatterns += router.urls
