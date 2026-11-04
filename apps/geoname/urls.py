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
from .mlapi import MlDetectionViewSet, MlTaskViewSet, MlReviewViewSet


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
# Скан топо зургаас нэр таних (nameqc) — таамаглал засах, шошголох дараалал
router.register('ml-detection', MlDetectionViewSet, basename='ml-detection')
router.register('ml-task', MlTaskViewSet, basename='ml-task')
router.register('ml-review', MlReviewViewSet, basename='ml-review')


urlpatterns = []

urlpatterns += router.urls
