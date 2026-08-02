from django.conf.urls import handler403, handler404, handler500
from django.conf.urls.static import static
from django.conf import settings
from django.urls import path, include

from rest_framework.routers import DefaultRouter


handler401 = 'core.views.view_401'
handler403 = 'core.views.view_403'
handler404 = 'core.views.view_404'
handler500 = 'core.views.view_500'

from .person import PersonView
from .userapiview import (
    UserViewSet,
    ConstantViewSet,
    NotificationViewSet,
    MailLogViewSet,
    AdminUnitViewSet,
    StatusView,
)

router = DefaultRouter()
router.register(r'constant', ConstantViewSet, basename='constant')
router.register('notification', NotificationViewSet)
router.register('maillog', MailLogViewSet)
router.register('unit', AdminUnitViewSet)
router.register(r'user', UserViewSet,basename='user')


urlpatterns =[
    path('status/', StatusView.as_view(), name='core-status'),
    # Регистрээр хүн хайх/бүртгэх — БҮХ модулийн НЭГ цэг
    path('person/', PersonView.as_view(), name='core-person'),
    ]
urlpatterns += router.urls