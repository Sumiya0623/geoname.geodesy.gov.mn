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
	Layer,
	# Style,
	StyleRule,
	LayerGroup,
	LayerGroupItem,
)

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

class LayerSerializer(serializers.ModelSerializer):
	table=ConstantSerializer(read_only=True)
	class Meta:
		model = Layer
		fields = [
			"id", "name", "is_raster", "is_published","url","table"]

class LayerDetailSerializer(serializers.ModelSerializer):
	store=ConstantSerializer(read_only=True)
	table=ConstantSerializer(read_only=True)
	class Meta:
		model = Layer
		fields = [
			"id", "name", "is_raster", "table", "map", "is_published",
			"store", "url"
		]

class LayerCreateOrUpdateSerializer(serializers.ModelSerializer):
	store_id=serializers.PrimaryKeyRelatedField(queryset=Constant.objects.all(), source='store', write_only=True, required=False)
	table_id=serializers.PrimaryKeyRelatedField(queryset=Constant.objects.all(), source='table', write_only=True, required=False)
	class Meta:
		model = Layer
		fields = ['id', 'is_raster', 'is_published','table_id','store_id','table','store']

class StyleRuleSerializer(serializers.ModelSerializer):
	layer_id=serializers.PrimaryKeyRelatedField(queryset=Layer.objects.all(), source='layer', write_only=True, required=False)
	filters = serializers.JSONField(required=False)
	class Meta:
		model = StyleRule
		fields= '__all__'
		read_only_fields = ['id', 'layer']
#
class LayerGroupItemSerializer(serializers.ModelSerializer):
	layer = LayerSerializer(read_only=True)
	layer_id = serializers.PrimaryKeyRelatedField(
        queryset=Layer.objects.all(),
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