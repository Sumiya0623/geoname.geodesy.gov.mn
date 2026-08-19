from rest_framework.routers import DefaultRouter

from .apiviews import (
    GeoNameViewSet,
    NameCategoryViewSet,
    PrintMapViewSet,
    ProjectViewSet,
    ProjectAreaViewSet,
    ProjectMemberViewSet,
)
from .namestat import NameStatViewSet


router = DefaultRouter()
router.register('geoname', GeoNameViewSet, basename='geoname')
router.register('namecategory', NameCategoryViewSet, basename='namecategory')
# Нүүр хуудасны газрын зураг — нэгж бүрийн нэрийн тоо (нэвтрэлтгүй)
router.register('name-stat', NameStatViewSet, basename='name-stat')
router.register('raster', PrintMapViewSet, basename='raster')
# Төсөл (гэрээт ажил) ба түүний ажлын талбай, багийн бүрэлдэхүүн
router.register('project', ProjectViewSet, basename='project')
router.register('project-area', ProjectAreaViewSet, basename='project-area')
router.register('project-member', ProjectMemberViewSet, basename='project-member')


urlpatterns = []

urlpatterns += router.urls
