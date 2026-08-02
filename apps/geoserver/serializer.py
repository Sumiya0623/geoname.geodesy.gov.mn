from django.db import transaction
from rest_framework import serializers
from django.core.exceptions import ValidationError as DjangoValidationError
from core.userapiview import ConstantSerializer, ConstantDropDownSerializer
from rest_framework import serializers
from django.db import transaction
from django.http import QueryDict
import json
from core.models import (
	Constant,
	# Style,
	StyleRule,
	LayerGroup,
	LayerGroupItem,
	BaseMapLayer,
)


class BaseMapLayerSerializer(serializers.ModelSerializer):
	"""Суурь/нэмэлт давхаргын тохиргоо. roles = харах эрх бүхий role‑ууд (Constant).
	Уншихад роль дэлгэрэнгүй, бичихэд role_ids (id жагсаалт)."""
	roles = ConstantDropDownSerializer(many=True, read_only=True)
	role_ids = serializers.PrimaryKeyRelatedField(
		queryset=Constant.objects.all(), source='roles', many=True,
		write_only=True, required=False)
	params = serializers.JSONField(required=False)

	class Meta:
		model = BaseMapLayer
		fields = [
			'id', 'key', 'label', 'layer_type', 'source_type', 'workspace',
			'gs_layer', 'url', 'params', 'color', 'is_enabled', 'sort_order',
			'roles', 'role_ids', 'created_date', 'modified_date',
		]

	def validate(self, attrs):
		"""Эрэмбэ — 1‑ээс эхэлнэ, төрөл (base/overlay) дотроо ДАВХАРДАХГҮЙ.

		Эрэмбэ нь газрын зурагт давхаргын байрлалыг (zIndex) шууд тодорхойлдог
		тул 0 буюу давхардсан утга зөвшөөрөгдөхгүй."""
		inst = self.instance
		order = attrs.get('sort_order', getattr(inst, 'sort_order', 0))
		ltype = attrs.get('layer_type', getattr(inst, 'layer_type', 'base'))
		if not order:
			raise serializers.ValidationError(
				{'sort_order': 'Эрэмбэ 1‑ээс эхэлнэ (0 байж болохгүй)'})
		qs = BaseMapLayer.objects.filter(layer_type=ltype, sort_order=order)
		if inst is not None:
			qs = qs.exclude(pk=inst.pk)
		dup = qs.first()
		if dup:
			raise serializers.ValidationError({'sort_order':
				f'«{dup.label}» давхарга энэ эрэмбийг ({order}) эзэлсэн байна'})
		return attrs

class WorkspaceSerializer(serializers.ModelSerializer):
	class Meta:
		model = Constant
		fields = '__all__'

class StoreSerializer(serializers.ModelSerializer):
	parent_id=serializers.PrimaryKeyRelatedField(queryset=Constant.objects.all(), source='parent', write_only=True, required=False)
	parent=WorkspaceSerializer(read_only=True)
	class Meta:
		model = Constant
		fields = '__all__'

class StyleRuleSerializer(serializers.ModelSerializer):
	# layer нь одоо nameclass leaf (GEONAME_TYPES Constant) — view‑ийн "давхарга".
	layer_id=serializers.PrimaryKeyRelatedField(
		queryset=Constant.objects.filter(key='GEONAME_TYPES'),
		source='layer', write_only=True, required=False)
	filters = serializers.JSONField(required=False)
	class Meta:
		model = StyleRule
		fields= '__all__'
		read_only_fields = ['id', 'layer']
#
class LayerGroupItemSerializer(serializers.ModelSerializer):
	layer = ConstantSerializer(read_only=True)
	layer_id = serializers.PrimaryKeyRelatedField(
        queryset=Constant.objects.filter(key='GEONAME_TYPES'),
        source="layer", write_only=True
    )
	class Meta:
		model = LayerGroupItem
		fields = [ "id", "layer_id","layer", "order", "visible" ]

class LayerGroupSerializer(serializers.ModelSerializer):
	# workspace_id=serializers.PrimaryKeyRelatedField(queryset=Constant.objects.filter(key='WORKSPACES'), source='workspace', write_only=True, required=False)
	items = LayerGroupItemSerializer(many=True, required=False)
	class Meta:
		model = LayerGroup
		fields = ["id", "name", "items"]
	def create(self, validated_data):
		items_data = validated_data.pop("items", [])
		group = LayerGroup.objects.create(**validated_data)
		LayerGroupItem.objects.bulk_create([
			LayerGroupItem(group=group, **item) for item in items_data
		])
		return group

	def update(self, instance, validated_data):
		items_data = validated_data.pop("items", None)
		instance.name = validated_data.get("name", instance.name)
		instance.save()
		if items_data is not None:
			instance.items.all().delete()
			LayerGroupItem.objects.bulk_create([
				LayerGroupItem(group=instance, **item) for item in items_data
			])
		return instance