from rest_framework import  serializers

from core.serializers import (
     ProfileDropDownSerializer
 )
from django.db.models import Count, Q

from core.models import (
    Error500,
    Errors,
    Project,
    RequestLog,
    Constant,

)


class RequestLogSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source="user.full_name", default="")
    class Meta:
        model = RequestLog
        fields = '__all__'
class UserLoginSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source="user.full_name", default="-")
    class Meta:
        model = RequestLog
        fields=['id', 'user_name', 'url', 'method', 'status_code', 'datetime']

class ErrorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Errors
        exclude = ['headers']

class Error500Serializer(serializers.ModelSerializer):
    class Meta:
        model = Error500
        exclude = ['headers']

class UserStatusSerializer(serializers.Serializer):
    total = serializers.IntegerField()
    today = serializers.IntegerField()
    this_month = serializers.IntegerField()
    this_year = serializers.IntegerField()

class StatusSerializer(serializers.Serializer):
    count=serializers.IntegerField(read_only=True)
    status=serializers.CharField(read_only=True)

class ActionStatusSerializer(serializers.Serializer):
    get = serializers.CharField(read_only=True)
    patch = serializers.CharField(read_only=True)
    put = serializers.CharField(read_only=True)
    post = serializers.CharField(read_only=True)
    delete = serializers.CharField(read_only=True)

class ProjectSerializer(serializers.ModelSerializer):
	org=ProfileDropDownSerializer(read_only=True)
	# Бэлтгэл табын chip‑үүд: ЗӨВХӨН энэ төсөлд бүртгэгдсэн (≥1 legal орд бүхий)
	# LEGAL_TYPES төрлүүд + орд тоо. Зөвхөн detail (retrieve) дээр (жагсаалтад null).
	registered_types = serializers.SerializerMethodField()

	class Meta:
		model = Project
		fields = '__all__'

	def get_registered_types(self, obj):
		view = self.context.get('view')
		if not view or getattr(view, 'action', None) != 'retrieve':
			return None
		types = (
			Constant.objects.filter(key='LEGAL_TYPES')
			.annotate(order_count=Count('legalorgs', filter=Q(legalorgs__projects=obj), distinct=True))
			.filter(order_count__gt=0)
			.order_by('id')
		)
		return [
			{
				'id': t.id,
				'name': t.name,
				'label': t.label or t.name,
				'code': t.code,
				'order_count': t.order_count,
			}
			for t in types
		]