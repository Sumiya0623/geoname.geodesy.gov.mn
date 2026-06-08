from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.urls import path, include
urlpatterns = [
    path('admin/', admin.site.urls),
	path('core/', include('core.urls')),
	path('n/', include('apps.geoname.urls')),
 	path('r/', include('apps.request.urls')),
	path('m/',include("apps.map.urls")),
	path('g/', include('apps.geoserver.urls')),
    path('account/', include("apps.account.urls")),
]


urlpatterns = [
    path('api/', include(urlpatterns)),
    path("__reload__/", include("django_browser_reload.urls")),
]
	

if settings.DEBUG:
	urlpatterns += static(settings.STATIC_URL, document_root=settings.STATICFILES_DIRS)
	urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
	