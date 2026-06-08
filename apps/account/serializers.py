from rest_framework import  serializers

from core.serializers import (
     ProfileDropDownSerializer
 )
from core.models import (
    Error500,
    Errors,
    Project,
    RequestLog,

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
	class Meta:
		model = Project
		fields = '__all__'  