import json
from rest_framework import serializers
from django.contrib.gis.geos import Point, GEOSGeometry
from django.contrib.contenttypes.models import ContentType

from core.models import Constant, GeoName, LegalOrder, Photo, Attach, PrintMap


class PrintMapSerializer(serializers.ModelSerializer):
    """Хэвлэлийн эх (PDF) жагсаалт — он, аймаг/сум, нэрийн тоо, хэвлэсэн хэрэглэгч."""
    file_url = serializers.SerializerMethodField()
    units_text = serializers.SerializerMethodField()
    user_name = serializers.SerializerMethodField()
    year = serializers.SerializerMethodField()

    class Meta:
        model = PrintMap
        fields = ['id', 'title', 'units_text', 'name_count', 'is_border',
                  'scale', 'file_url', 'user_name', 'created_date', 'year']

    def get_file_url(self, obj):
        try:
            if not obj.file:
                return None
            url = obj.file.url  # харьцангуй: /api/media/...
            request = self.context.get('request')
            # backend (8002) дээр media байгаа тул ABSOLUTE болгоно (frontend 3002 биш)
            return request.build_absolute_uri(url) if request else url
        except Exception:
            return None

    def get_units_text(self, obj):
        us = list(obj.units.all())
        if not us:
            return ''
        aimag = us[0].parent.unit if us[0].parent_id else ''
        sums = ', '.join(u.unit for u in us)
        return f'{aimag} — {sums}' if aimag else sums

    def get_user_name(self, obj):
        u = obj.user
        return (getattr(u, 'full_name', None) or getattr(u, 'username', None)
                or str(u)) if u else ''

    def get_year(self, obj):
        return obj.created_date.year if obj.created_date else None


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
        } for o in obj.legalorders.all()]

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


class GeoNameDropSerializer(serializers.ModelSerializer):
	"""Газар зүйн нэр сонголт (FK dropdown) — хөнгөн."""
	class Meta:
		model = GeoName
		fields = ['id', 'name', 'number']


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
	geom_type = serializers.SerializerMethodField()  # Point/LineString/Polygon...
	# Эрх зүйн баримт бичиг (M2M LegalOrder)
	orders = LegalOrderMiniSerializer(many=True, read_only=True)
	order_ids = serializers.PrimaryKeyRelatedField(
		queryset=LegalOrder.objects.all(), source='orders',
		many=True, write_only=True, required=False)
	# Импортын эх сурвалжийн төлөв (GeoNameSource): хянах шаардлагатай эсэх, итгэл
	needs_review = serializers.SerializerMethodField()
	confidence = serializers.SerializerMethodField()
	source = serializers.SerializerMethodField()
	# Засаг захиргааны нэгж (аймаг/сум) — M2M
	units = serializers.SerializerMethodField()

	class Meta:
		model = GeoName
		fields = [
			'id', 'name', 'number', 'type', 'type_id',
			'is_approved', 'lat', 'lon', 'geom', 'geom_type', 'orders', 'order_ids',
			'user_name', 'created_date',
			'needs_review', 'confidence', 'source', 'units',
		]
		read_only_fields = ['user_name', 'created_date']

	def get_units(self, obj):
		# Аймаг/Нийслэл эхэнд, дараа нь сум/дүүрэг
		def lvl(u):
			return 0 if (u.level and 'Аймаг' in (u.level.name or '')) else 1
		return [{'id': u.id, 'name': u.unit,
		         'level': u.level.name if u.level else None}
		        for u in sorted(obj.unit.all(), key=lvl)]

	def _src(self, obj):
		# Кэшлэх (needs_review/confidence/source нэг л query дуудна)
		if not hasattr(obj, '_src_cache'):
			obj._src_cache = obj.sources.first()
		return obj._src_cache

	def get_needs_review(self, obj):
		s = self._src(obj)
		return s.needs_review if s else None

	def get_confidence(self, obj):
		s = self._src(obj)
		return s.confidence if s else None

	def get_source(self, obj):
		s = self._src(obj)
		if not s:
			return None
		return {'volume': s.volume, 'page': s.page, 'line': s.line}

	def get_lat(self, obj):
		return obj.geoloc.y if obj.geoloc and obj.geoloc.geom_type == 'Point' else None

	def get_lon(self, obj):
		return obj.geoloc.x if obj.geoloc and obj.geoloc.geom_type == 'Point' else None

	def get_geom(self, obj):
		return json.loads(obj.geoloc.geojson) if obj.geoloc else None

	def get_geom_type(self, obj):
		return obj.geoloc.geom_type if obj.geoloc else None

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
