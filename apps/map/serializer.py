from rest_framework import serializers

from core.models import Constant


class NameCategorySerializer(serializers.ModelSerializer):
    """Нэрийн ангилал (GEONAME_TYPES) — мод.
    child_count — цааш задрах эсэх; count — энэ ангилалд хамаарах геонэрийн тоо."""
    child_count = serializers.IntegerField(read_only=True, default=0)
    count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Constant
        fields = ['id', 'name', 'code', 'desc', 'parent', 'child_count', 'count']
