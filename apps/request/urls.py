from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import request_form
from .apiviews import (
	LegalTypeViewSet, LegalOrderViewSet, LegalUnitViewSet,
	RequestNameViewSet, ReCountViewSet, ReCountMapViewSet,
	CouncilViewSet, CouncilMemberViewSet,
)


router = DefaultRouter()
router.register('legal-type', LegalTypeViewSet, basename='legal-type')
router.register('legal-unit', LegalUnitViewSet, basename='legal-unit')
router.register('legal', LegalOrderViewSet, basename='legal')
router.register('request', RequestNameViewSet, basename='request')
router.register('recount', ReCountViewSet, basename='recount')
router.register('recountmap', ReCountMapViewSet, basename='recountmap')
router.register('council', CouncilViewSet, basename='council')
router.register('council-member', CouncilMemberViewSet, basename='council-member')


urlpatterns = [
	# Өргөдлийн А4 маягт (PDF)
	path('request/<int:pk>/form/', request_form, name='request-form'),
]

urlpatterns += router.urls
