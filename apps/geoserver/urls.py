from rest_framework.routers import DefaultRouter
from django.urls import path

from .apiviews import (
    WorkSpaceViewSet,
    NameClassViewSet,
    StoreViewSet,
    # StyleViewSet,
    StyleRuleViewSet,
    LayerGroupViewSet,
    LayerGroupItemViewSet,
    BaseMapLayerViewSet,
)

router = DefaultRouter()
router.register('ws', WorkSpaceViewSet,basename='workspace')
router.register('nameclass', NameClassViewSet, basename='nameclass')
router.register('st', StoreViewSet)
# router.register(r"style", StyleViewSet, basename="style")
router.register(r"rule", StyleRuleViewSet, basename="style-rule")
router.register(r"group", LayerGroupViewSet, basename="layer-group")
router.register(r"item", LayerGroupItemViewSet, basename="layer-group-item")
router.register(r"basemap", BaseMapLayerViewSet, basename="basemap")

# # router.register('journal', JournalViewSet)
# router.register('photo', PhotoViewSet)
# router.register('act', ActViewSet)

urlpatterns =[
    # path('act/<int:pk>/download/', act_download, name='act-download'),
]

urlpatterns += router.urls