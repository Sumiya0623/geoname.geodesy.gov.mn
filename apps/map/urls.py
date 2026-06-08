from rest_framework.routers import DefaultRouter
from django.urls import path

from .apiviews import NameCategoryViewSet

router = DefaultRouter()
router.register('namecategory', NameCategoryViewSet, basename='namecategory')


urlpatterns =[
]

urlpatterns += router.urls
