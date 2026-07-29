from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.urls import path, include
from apps.geoname.inquire_views import inquire_document
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
    # Лавлагааны HTML баримт (A4). ЗААВАЛ /api/ доор байх ёстой — nginx дээр
    # зөвхөн /api/ нь Django руу очдог, бусад зам Next.js рүү очно. Frontend дээр
    # /inquire/<code> нь QR‑аас нээгддэг ШАЛГАХ хуудас тул мөргөлдөнө.
    path('api/inquire/<str:code>/', inquire_document,
         name='geoname-inquire-document'),
    # Хуучин зам (dev дээр Django шууд сонсдог порт) — нийцтэй байдлаар үлдээв
    path('inquire/<str:code>/', inquire_document,
         name='geoname-inquire-document-legacy'),
    path("__reload__/", include("django_browser_reload.urls")),
]
	

if settings.DEBUG:
	urlpatterns += static(settings.STATIC_URL, document_root=settings.STATICFILES_DIRS)
	urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
	