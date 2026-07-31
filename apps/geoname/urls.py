from rest_framework.routers import DefaultRouter

from .apiviews import (
    GeoNameViewSet,
    PrintMapViewSet,
    ProjectViewSet,
    ProjectAreaViewSet,
    ProjectMemberViewSet,
)


router = DefaultRouter()
router.register('geoname', GeoNameViewSet, basename='geoname')
router.register('raster', PrintMapViewSet, basename='raster')
# Төсөл (гэрээт ажил) ба түүний ажлын талбай, багийн бүрэлдэхүүн
router.register('project', ProjectViewSet, basename='project')
router.register('project-area', ProjectAreaViewSet, basename='project-area')
router.register('project-member', ProjectMemberViewSet, basename='project-member')


urlpatterns = []

urlpatterns += router.urls
