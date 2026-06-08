from rest_framework.routers import DefaultRouter

from .apiviews import GeoNameViewSet


router = DefaultRouter()
router.register('geoname', GeoNameViewSet, basename='geoname')


urlpatterns = []

urlpatterns += router.urls
