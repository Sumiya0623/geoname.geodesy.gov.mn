from rest_framework.routers import DefaultRouter

from .apiviews import GeoNameViewSet, PrintMapViewSet


router = DefaultRouter()
router.register('geoname', GeoNameViewSet, basename='geoname')
router.register('raster', PrintMapViewSet, basename='raster')


urlpatterns = []

urlpatterns += router.urls
