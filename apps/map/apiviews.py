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
            from apps.geoserver.apiview import ensure_geoname_search_view
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
        for c in qs:
            c.count = GeoName.objects.filter(
                type_id__in=_subtree_ids(c.id)).count()
        total = GeoName.objects.count()  # системийн нийт геонэр
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
