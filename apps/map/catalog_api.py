# -*- coding: utf-8 -*-
"""Байр зүйн каталогийн (map_*) CRUD API — Data tab-д зориулав.

Нэг generic ViewSet бүх feature model-ийг `layer` slug-аар үйлчилнэ. Codelist
(MapConstant) болон layer-уудын meta мөн энд.
    GET/POST      /api/m/catalog/<layer>/
    GET/PUT/PATCH/DELETE /api/m/catalog/<layer>/<id>/
    GET           /api/m/catalog/            → layer-уудын жагсаалт (meta)
    GET           /api/m/map-constant/?key=ROAD_CLASS  → codelist
"""

from rest_framework import serializers, viewsets, filters
from rest_framework.views import APIView
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import NotFound
from rest_framework_gis.fields import GeometryField
from django_filters.rest_framework import DjangoFilterBackend

from apps.map import map_models as MM

# slug → feature model. Frontend layer picker эндээс.
CATALOG = {
    "geodetic_point": MM.GeodeticPoint,
    "contour_line": MM.ContourLine,
    "spot_height": MM.SpotHeight,
    "relief_feature": MM.ReliefFeature,
    "watercourse": MM.Watercourse,
    "water_body": MM.WaterBody,
    "hydro_point": MM.HydroPoint,
    "landcover": MM.LandcoverArea,
    "vegetation_feature": MM.VegetationFeature,
    "road": MM.Road,
    "railway": MM.Railway,
    "transport_structure": MM.TransportStructure,
    "building": MM.Building,
    "other_construction": MM.OtherConstruction,
    "settlement_area": MM.SettlementArea,
    "admin_boundary": MM.AdminBoundary,
    "admin_area": MM.AdminArea,
    "utility_line": MM.UtilityLine,
    "utility_point": MM.UtilityPoint,
    "governmental_service": MM.GovernmentalService,
    "business_service": MM.BusinessService,
    "toponym": MM.Toponym,
}


def _codelist_map(model):
    """{FK талбарын нэр: MapConstant домэйн key} — Data tab-ийн dropdown-д."""
    out = {}
    for f in model._meta.get_fields():
        if getattr(f, "is_relation", False) and getattr(f, "related_model", None) is MM.MapConstant:
            lct = getattr(f.remote_field, "limit_choices_to", None) or {}
            out[f.name] = lct.get("key")
    return out


def _codelist_fields(model):
    return list(_codelist_map(model).keys())


def make_serializer(model):
    """Model-д тохирсон ModelSerializer динамикаар — geom нь GeoJSON, codelist FK-ийн
    дэлгэрэнгүй (code/name/color) `labels`-д, бичихдээ PK-аар."""
    cl_fields = _codelist_fields(model)

    def get_labels(self, obj):
        d = {}
        for name in cl_fields:
            v = getattr(obj, name, None)
            d[name] = ({"id": v.id, "code": v.code, "name": v.name, "color": v.color}
                       if v else None)
        return d

    Meta = type("Meta", (), {"model": model, "fields": "__all__"})
    attrs = {
        "Meta": Meta,
        "geom": GeometryField(required=False, allow_null=True),
        "labels": serializers.SerializerMethodField(),
        "get_labels": get_labels,
    }
    return type(f"{model.__name__}Serializer", (serializers.ModelSerializer,), attrs)


class CatalogViewSet(viewsets.ModelViewSet):
    """Бүх feature model-ийн CRUD — URL-ийн `layer` slug-аар model сонгоно."""
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name"]
    ordering_fields = ["id", "name"]

    def _model(self):
        m = CATALOG.get(self.kwargs.get("layer"))
        if not m:
            raise NotFound("Ийм layer алга")
        return m

    def get_queryset(self):
        model = self._model()
        qs = model.objects.all()
        p = self.request.query_params
        cat = p.get("category")            # code-оор шүүх (жишээ trunk)
        if cat and any(f == "category" for f in _codelist_fields(model)):
            qs = qs.filter(category__code=cat)
        return qs.order_by("-id")

    def get_serializer_class(self):
        return make_serializer(self._model())

    # Хадгалах бүрд name_galig-г кириллээс (MNS 5217) АВТОМАТААР үүсгэнэ.
    def _galig_kwargs(self, serializer):
        if not any(f.name == "name_galig" for f in self._model()._meta.get_fields()):
            return {}
        vd = serializer.validated_data
        name = vd.get("name", getattr(serializer.instance, "name", "") if serializer.instance else "")
        from core.geoname_import.resolver import translit
        return {"name_galig": translit(name or "")}

    def perform_create(self, serializer):
        serializer.save(**self._galig_kwargs(serializer))

    def perform_update(self, serializer):
        serializer.save(**self._galig_kwargs(serializer))

    @action(detail=False, methods=["post"], url_path="bulk-delete")
    def bulk_delete(self, request, *args, **kwargs):
        """Сонгосон мөрүүдийг олноор устгах — body: {"ids": [1,2,3]}."""
        ids = request.data.get("ids") or []
        if not isinstance(ids, list) or not ids:
            return Response({"detail": "ids хоосон эсвэл буруу"}, status=400)
        deleted, _ = self._model().objects.filter(id__in=ids).delete()
        return Response({"deleted": deleted})


# INSPIRE 4-түвшин: Theme → Application Schema → Feature Type → Attribute/Codelist
THEME_NAMES = {
    10: "Суурь хяналтын сүлжээ", 20: "Өндөршил", 30: "Ус зүй",
    40: "Газрын бүрхэвч", 50: "Тээврийн сүлжээ", 60: "Барилга",
    70: "Засаг захиргаа", 80: "Инженерийн шугам ба үйлчилгээ", 90: "Газарзүйн нэр",
}
# slug → (INSPIRE application schema нэр, монгол тайлбар)
SCHEMAS = {
    "geodetic_point": ("GeodeticNetwork", "Геодезийн сүлжээ"),
    "contour_line": ("ElevationVectorElements", "Өндөршлийн вектор"),
    "spot_height": ("ElevationVectorElements", "Өндөршлийн вектор"),
    "relief_feature": ("ElevationVectorElements", "Өндөршлийн вектор"),
    "watercourse": ("HydroPhysicalWaters", "Гадаргын ус"),
    "water_body": ("HydroPhysicalWaters", "Гадаргын ус"),
    "hydro_point": ("HydroPhysicalWaters", "Гадаргын ус"),
    "landcover": ("LandCoverVector", "Газрын бүрхэвч"),
    "vegetation_feature": ("LandCoverVector", "Газрын бүрхэвч"),
    "road": ("RoadTransportNetwork", "Авто замын сүлжээ"),
    "railway": ("RailTransportNetwork", "Төмөр замын сүлжээ"),
    "transport_structure": ("CommonTransportElements", "Нийтлэг тээврийн элемент"),
    "building": ("Buildings", "Барилга байгууламж"),
    "other_construction": ("Buildings", "Барилга байгууламж"),
    "settlement_area": ("PopulatedPlaces", "Суурин газар"),
    "admin_boundary": ("AdministrativeUnits", "Засаг захиргааны нэгж"),
    "admin_area": ("AdministrativeUnits", "Засаг захиргааны нэгж"),
    "utility_line": ("UtilityNetworksCommon", "Инженерийн шугам сүлжээ"),
    "utility_point": ("UtilityNetworksCommon", "Инженерийн шугам сүлжээ"),
    "governmental_service": ("GovernmentalServices", "Төрийн үйлчилгээ"),
    "business_service": ("BusinessServices", "Худалдаа, үйлчилгээ"),
    "toponym": ("GeographicalNames", "Газарзүйн нэр"),
}


# Feature type → GeoServer render давхарга (v_map_*, basemap ws). Style энэ давхаргад.
RENDER_LAYER = {
    "road": "v_map_road", "building": "v_map_building", "toponym": "v_map_toponym",
    "watercourse": "v_map_watercourse", "water_body": "v_map_water_body",
    "railway": "v_map_railway", "landcover": "v_map_landcover",
    "vegetation_feature": "v_map_tree", "utility_line": "v_map_power",
    "other_construction": "v_map_barrier",
}


class CatalogMetaView(APIView):
    """Каталогийн Feature Type-ууд + INSPIRE Theme/Schema бүтэц — Catalog табд."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # INSPIRE бүтэц MapConstant-д дата (статик биш): FEATURE_TYPE→SCHEMA→THEME
        ft_map = {c.code: c for c in MM.MapConstant.objects.filter(key="FEATURE_TYPE")
                  .select_related("parent", "parent__parent")}
        out = []
        for slug, model in CATALOG.items():
            geom = model._meta.get_field("geom")
            ft = ft_map.get(slug)
            schema_c = ft.parent if ft else None
            theme_c = schema_c.parent if schema_c else None
            out.append({
                "slug": slug,
                "name": str(model._meta.verbose_name),
                "code": model.FEATURE_CODE,
                "theme": theme_c.code if theme_c else str(model.FEATURE_THEME),
                "theme_name": theme_c.name if theme_c else "—",
                "schema": schema_c.code if schema_c else "Other",
                "schema_label": schema_c.name if schema_c else "Бусад",
                "render_layer": RENDER_LAYER.get(slug),   # v_map_* (style энд) эсвэл null
                "geom_type": geom.geom_type,
                "count": model.objects.count(),
                "codelist_fields": [{"field": k, "key": v}
                                    for k, v in _codelist_map(model).items()],
            })
        out.sort(key=lambda x: x["code"])
        return Response({"results": out})


class MapConstantSerializer(serializers.ModelSerializer):
    class Meta:
        model = MM.MapConstant
        fields = "__all__"


class MapConstantViewSet(viewsets.ModelViewSet):
    """Codelist CRUD — dropdown-д зориулж key-ээр шүүнэ (?key=ROAD_CLASS)."""
    permission_classes = [IsAuthenticated]
    serializer_class = MapConstantSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["code", "name", "name_en"]
    ordering_fields = ["key", "sort_order", "code"]

    def get_queryset(self):
        qs = MM.MapConstant.objects.all()
        key = self.request.query_params.get("key")
        if key:
            qs = qs.filter(key=key)
        active = self.request.query_params.get("active")
        if active in ("1", "true", "True"):
            qs = qs.filter(active=True)
        return qs.order_by("key", "sort_order", "code")

    @action(detail=False, methods=["get"], url_path="keys")
    def keys(self, request):
        """Домэйн (key)-үүд + тоо — Catalog табын шүүлтэд."""
        from django.db.models import Count
        rows = (MM.MapConstant.objects.values("key")
                .annotate(n=Count("id")).order_by("key"))
        return Response({"results": list(rows)})
