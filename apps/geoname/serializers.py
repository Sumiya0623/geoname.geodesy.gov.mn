import json
from rest_framework import serializers
from django.contrib.gis.geos import Point, GEOSGeometry
from django.contrib.contenttypes.models import ContentType

from core.models import Constant, GeoName, LegalOrder, Photo, Attach


def _file_url(f):
    try:
        return f.url if f else None
    except Exception:
        return None


class GeoNameFullSerializer(serializers.ModelSerializer):
    """Дэлгэрэнгүй (retrieve) — ангилал(level1/2/3), солбицол, нэгж, нэрлэвэр,
    зураг, баримт материал, хүсэлт, эрх зүйн баримт бичиг."""
    type_path = serializers.SerializerMethodField()
    lat = serializers.SerializerMethodField()
    lon = serializers.SerializerMethodField()
    geom_type = serializers.SerializerMethodField()
    units = serializers.SerializerMethodField()
    nomeks = serializers.SerializerMethodField()
    orders = serializers.SerializerMethodField()
    photos = serializers.SerializerMethodField()
    attaches = serializers.SerializerMethodField()
    requests = serializers.SerializerMethodField()

    class Meta:
        model = GeoName
        fields = ['id', 'name', 'number', 'is_approved', 'created_date',
                  'lat', 'lon', 'geom_type', 'type_path', 'units', 'nomeks',
                  'orders', 'photos', 'attaches', 'requests']

    def get_type_path(self, obj):
        chain, c, seen = [], obj.type, set()
        while c and c.id not in seen:
            seen.add(c.id)
            chain.append({'id': c.id, 'name': c.name, 'code': c.code})
            c = c.parent
        chain.reverse()
        return chain

    def get_lat(self, obj):
        return obj.geoloc.y if obj.geoloc and obj.geoloc.geom_type == 'Point' else None

    def get_lon(self, obj):
        return obj.geoloc.x if obj.geoloc and obj.geoloc.geom_type == 'Point' else None

    def get_geom_type(self, obj):
        return obj.geoloc.geom_type if obj.geoloc else None

    def get_units(self, obj):
        return [{'id': u.id, 'name': u.unit} for u in obj.unit.all()]

    def get_nomeks(self, obj):
        return [{'id': n.id, 'code': n.nomek} for n in obj.nomek.all()]

    def get_orders(self, obj):
        return [{
            'id': o.id, 'name': o.name,
            'order_number': getattr(o, 'order_number', None),
            'order_date': getattr(o, 'order_date', None),
        } for o in obj.orders.all()]

    def _generic_qs(self, model, obj):
        ct = ContentType.objects.get_for_model(GeoName)
        return model.objects.filter(content_type=ct, object_id=obj.id)

    def get_photos(self, obj):
        return [{'id': p.id, 'url': _file_url(p.file)}
                for p in self._generic_qs(Photo, obj)]

    def get_attaches(self, obj):
        return [{
            'id': a.id, 'url': _file_url(a.attach),
            'name': (a.attach.name.split('/')[-1] if a.attach else None),
        } for a in self._generic_qs(Attach, obj)]

    def get_requests(self, obj):
        return [{
            'id': r.id,
            'description': getattr(r, 'description', None),
            'status': r.status.name if getattr(r, 'status', None) else None,
            'purpose': r.purpose.name if getattr(r, 'purpose', None) else None,
            'created_date': r.created_date,
        } for r in obj.requestnames.all()]


class LegalOrderMiniSerializer(serializers.ModelSerializer):
	"""Эрх зүйн баримт бичиг (LegalOrder) — товч.

	org = LEGAL_TYPES, type = ORDER_TYPES — засах үед dropdown‑уудыг сэргээхэд id‑аар ирнэ.
	"""
	type_name = serializers.CharField(source='type.name', read_only=True, default=None)
	org_name = serializers.CharField(source='org.name', read_only=True, default=None)

	class Meta:
		model = LegalOrder
		fields = ['id', 'name', 'order_number', 'order_date', 'org', 'org_name', 'type', 'type_name']


class ConstantMiniSerializer(serializers.ModelSerializer):
	class Meta:
		model = Constant
		fields = ['id', 'name', 'code', 'color']


class GeoNameTypeCardSerializer(serializers.ModelSerializer):
	"""GEONAME_TYPES үндсэн төрөл (карт). geoname_count = удам дахь GeoName тоо."""
	geoname_count = serializers.IntegerField(read_only=True, default=0)

	class Meta:
		model = Constant
		fields = ['id', 'name', 'code', 'color', 'geoname_count']


class GeoNameSerializer(serializers.ModelSerializer):
	type = ConstantMiniSerializer(read_only=True)
	type_id = serializers.PrimaryKeyRelatedField(
		queryset=Constant.objects.filter(key='GEONAME_TYPES'),
		source='type', write_only=True, required=False, allow_null=True)
	user_name = serializers.CharField(source='user.full_name', read_only=True)
	# geoloc — Point бол lat/lon‑оор; шугам/талбай бол geom (GeoJSON)‑оор.
	lat = serializers.SerializerMethodField()
	lon = serializers.SerializerMethodField()
	geom = serializers.SerializerMethodField()
	# Эрх зүйн баримт бичиг (M2M LegalOrder)
	orders = LegalOrderMiniSerializer(many=True, read_only=True)
	order_ids = serializers.PrimaryKeyRelatedField(
		queryset=LegalOrder.objects.all(), source='orders',
		many=True, write_only=True, required=False)

	class Meta:
		model = GeoName
		fields = [
			'id', 'name', 'number', 'type', 'type_id',
			'is_approved', 'lat', 'lon', 'geom', 'orders', 'order_ids',
			'user_name', 'created_date',
		]
		read_only_fields = ['user_name', 'created_date']

	def get_lat(self, obj):
		return obj.geoloc.y if obj.geoloc and obj.geoloc.geom_type == 'Point' else None

	def get_lon(self, obj):
		return obj.geoloc.x if obj.geoloc and obj.geoloc.geom_type == 'Point' else None

	def get_geom(self, obj):
		return json.loads(obj.geoloc.geojson) if obj.geoloc else None

	def _apply_geoloc(self, validated_data):
		# geom (GeoJSON) ирвэл түүгээр; эс бөгөөс lat/lon‑оос Point.
		geom = self.initial_data.get('geom')
		if geom not in (None, ''):
			try:
				geo = geom if isinstance(geom, str) else json.dumps(geom)
				g = GEOSGeometry(geo)
				if not g.srid:
					g.srid = 4326
				validated_data['geoloc'] = g
				return validated_data
			except Exception:
				pass
		lat = self.initial_data.get('lat')
		lon = self.initial_data.get('lon')
		try:
			if lat not in (None, '') and lon not in (None, ''):
				validated_data['geoloc'] = Point(float(lon), float(lat), srid=4326)
		except (TypeError, ValueError):
			pass
		return validated_data

	def create(self, validated_data):
		return super().create(self._apply_geoloc(validated_data))

	def update(self, instance, validated_data):
		return super().update(instance, self._apply_geoloc(validated_data))
