from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Count

from core.models import Constant, GeoName, AdminUnit, Nomek

from .serializer import NameCategorySerializer

# Кирилл том үсэг → латин (нэрлэврийн М-46-22 гэх мэт)
_CYR2LAT = str.maketrans('МАВЕКНОРСТХ', 'MABEKHOPCTX')


def _subtree_ids(root_id):
    """root_id + бүх удам (GEONAME_TYPES мод)."""
    ids = [root_id]
    frontier = [root_id]
    while frontier:
        kids = list(
            Constant.objects.filter(parent_id__in=frontier)
            .exclude(id__in=ids).values_list('id', flat=True))
        if not kids:
            break
        ids.extend(kids)
        frontier = kids
    return ids


def _filtered_geoname_base(request):
    """Дэлгэрэнгүй хайлтын шүүлтүүрээр (нэр/дугаар/нэгж/нэрлэвэр/байршил/
    батлагдсан...) шүүсэн, ЗӨВХӨН БАЙРШИЛТАЙ (geom‑той) GeoName queryset.
    GeoName list‑ийн шүүлтүүрийг (GlobalFilter + get_queryset) дахин ашиглаж,
    ангиллын модны тоог хайлттай уялдуулна. Мод нь газрын зурагт харагдах
    (байршилтай) нэрийг л тоолно — сумаар шүүхэд frontend нь unit_geom
    (орон зайн) шүүлт илгээдэг тул газрын зураг дээрхтэй таарна.
    """
    from django.test import RequestFactory
    from rest_framework.request import Request
    from apps.geoname.apiviews import GeoNameViewSet
    # 'parent' нь ангиллын модны задаргаа (Constant) — GeoName‑д хамаагүй.
    # GlobalFilter‑т 'parent' талбар зарлагдсан тул шүүхийг оролдоод FieldError
    # өгдөг. Мөн page/page_size хэрэггүй. Цэвэрлэж дахин байгуулна.
    params = request.query_params.copy()
    for k in ('parent', 'page', 'page_size'):
        params.pop(k, None)
    gv = GeoNameViewSet()
    gv.request = Request(RequestFactory().get('/', data=params))
    gv.kwargs = {}
    gv.format_kwarg = None
    gv.action = 'list'
    return gv.filter_queryset(gv.get_queryset()).filter(geoloc__isnull=False)


def _views_visible_ids():
    """Газрын зурагт харуулах (is_map_active) навч + тэдгээрийн бүх өвөг ангиллын
    id‑ууд. Зөвхөн эдгээрийг модонд харуулна. Nameclass дээрх toggle
    (is_map_active) энэ шүүлтийг удирдана. Бүх навч идэвхтэй (default) бол
    бүх ангилал харагдана. Идэвхтэй навч огт байхгүй бол None (бүгд харагдана —
    санамсаргүй хоосролоос сэргийлнэ)."""
    allt = list(Constant.objects.filter(key='GEONAME_TYPES')
                .values('id', 'parent_id', 'is_map_active'))
    by_id = {c['id']: c for c in allt}
    has_child = {c['parent_id'] for c in allt if c['parent_id']}
    visible = set()
    for c in allt:
        is_leaf = c['id'] not in has_child
        if is_leaf and c['is_map_active']:
            x, seen = c, set()
            while x and x['id'] not in seen:
                seen.add(x['id'])
                visible.add(x['id'])
                x = by_id.get(x['parent_id'])
    return visible or None


class NameCategoryViewSet(viewsets.ViewSet):
    """Газрын зураг дээрх "Нэрийн ангилал" мод (GEONAME_TYPES).

    - parent байхгүй → үндсэн (parent null) ангиллууд
    - ?parent=<id> → тухайн ангиллын дэд ангиллууд
    child_count > 0 бол цааш задарна.
    """
    permission_classes = [IsAuthenticated]

    def list(self, request):
        # Хайлтын нэгдсэн view устгагдсан бол сэргээнэ (map panel ачаалахад)
        try:
            from apps.geoserver.apiviews import ensure_geoname_search_view
            ensure_geoname_search_view()
        except Exception:
            pass
        parent = request.query_params.get('parent', None)
        qs = Constant.objects.filter(key='GEONAME_TYPES').annotate(
            child_count=Count('children', distinct=True))
        if parent:
            qs = qs.filter(parent_id=parent)
        else:
            qs = qs.filter(parent__isnull=True)
        qs = list(qs.order_by('code', 'id'))
        # Зөвхөн GeoServer‑т view нийтлэгдсэн навч + тэдгээрийн өвгүүдийг харуулна.
        visible = _views_visible_ids()
        if visible is not None:
            qs = [c for c in qs if c.id in visible]
        # Зөвхөн БАЙРШИЛТАЙ (geoloc) геонэрийг тоолно — газрын зурагт харагдахтай
        # таарна. Байршилгүй (импортолсон) нэрс тоонд орохгүй.
        # Хайлтын шүүлтүүр байвал тоо хэмжээг түүгээр шинэчилнэ.
        base = _filtered_geoname_base(request)
        for c in qs:
            c.count = base.filter(type_id__in=_subtree_ids(c.id)).count()
        total = base.count()  # байршилтай (шүүсэн) нийт
        return Response(
            {'results': NameCategorySerializer(qs, many=True).data,
             'total': total},
            status=200)

    @action(detail=False, methods=['get'], url_path='locate')
    def locate(self, request):
        """Засаг захиргааны нэгж (unit) эсвэл нэрлэвэр (nomek)‑ийн төв + bbox.
        Газрын зургийг тухайн байршил руу нисгэхэд ашиглана."""
        unit = request.query_params.get('unit')
        nomek = request.query_params.get('nomek')
        geom = None
        if unit:
            u = (AdminUnit.objects.filter(id=unit)
                 .exclude(geom__isnull=True).first())
            geom = u.geom if u else None
        elif nomek:
            code = nomek.strip()
            n = (Nomek.objects.filter(nomek__iexact=code)
                 .exclude(geom__isnull=True).first()
                 or Nomek.objects.filter(nomek__iexact=code.translate(_CYR2LAT))
                 .exclude(geom__isnull=True).first())
            geom = n.geom if n else None
        if not geom:
            return Response({'found': False}, status=200)
        c = geom.centroid
        return Response({
            'found': True,
            'center': [c.x, c.y],
            'bbox': list(geom.extent),  # (minx, miny, maxx, maxy) — EPSG:4326
        }, status=200)
