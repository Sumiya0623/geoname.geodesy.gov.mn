from rest_framework import serializers

from core.models import Constant


class NameCategorySerializer(serializers.ModelSerializer):
    """Нэрийн ангилал (GEONAME_TYPES) — мод.
    child_count — цааш задрах эсэх; count — энэ ангилалд хамаарах геонэрийн тоо.
    view_name — 3‑р түвшний навч бол GeoServer дээрх per‑type view/style нэр
    (газрын зурагт STYLES‑д ашиглана), эс бөгөөс None."""
    child_count = serializers.IntegerField(read_only=True, default=0)
    count = serializers.IntegerField(read_only=True, default=0)
    view_name = serializers.SerializerMethodField()

    class Meta:
        model = Constant
        fields = ['id', 'name', 'code', 'desc', 'parent', 'child_count',
                  'count', 'view_name']

    def get_view_name(self, obj):
        # Хүүхэдтэй бол навч биш (child_count аннотацийг ашиглана).
        if getattr(obj, 'child_count', 0):
            return None
        try:
            from apps.geoserver.apiviews import (
                is_geoname_leaf, geoname_type_view_name)
            if is_geoname_leaf(obj):
                return geoname_type_view_name(obj)
        except Exception:
            pass
        return None
