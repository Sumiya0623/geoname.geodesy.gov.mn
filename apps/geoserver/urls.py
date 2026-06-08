from rest_framework.routers import DefaultRouter
from django.urls import path

from .apiview import (
    WorkSpaceViewSet,
    StoreViewSet,
    LayerViewSet,
    # StyleViewSet, 
    StyleRuleViewSet,
    LayerGroupViewSet,
    LayerGroupItemViewSet
)

router = DefaultRouter()
router.register('ws', WorkSpaceViewSet,basename='workspace')
router.register('st', StoreViewSet)
router.register('fs', LayerViewSet)
# router.register(r"style", StyleViewSet, basename="style")
router.register(r"rule", StyleRuleViewSet, basename="style-rule")
router.register(r"group", LayerGroupViewSet, basename="layer-group")
router.register(r"item", LayerGroupItemViewSet, basename="layer-group-item")

# # router.register('journal', JournalViewSet)
# router.register('photo', PhotoViewSet)
# router.register('act', ActViewSet)

urlpatterns =[
    # path('act/<int:pk>/download/', act_download, name='act-download'),
]

urlpatterns += router.urls