from rest_framework.routers import DefaultRouter
from django.urls import path

from .apiviews import NameCategoryViewSet
from .catalog_api import CatalogViewSet, CatalogMetaView, MapConstantViewSet

router = DefaultRouter()
router.register('namecategory', NameCategoryViewSet, basename='namecategory')
router.register('map-constant', MapConstantViewSet, basename='map-constant')

catalog_list = CatalogViewSet.as_view({'get': 'list', 'post': 'create'})
catalog_bulk = CatalogViewSet.as_view({'post': 'bulk_delete'})
catalog_detail = CatalogViewSet.as_view({
    'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'})

urlpatterns = [
    path('catalog/', CatalogMetaView.as_view()),               # layer-уудын meta
    path('catalog/<str:layer>/bulk-delete/', catalog_bulk),    # олноор устгах
    path('catalog/<str:layer>/', catalog_list),                # list / create
    path('catalog/<str:layer>/<int:pk>/', catalog_detail),     # CRUD
]

urlpatterns += router.urls
