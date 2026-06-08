from rest_framework.response import Response
from rest_framework import filters
from django_filters.rest_framework import DjangoFilterBackend
from .filters import GlobalFilter

class PublicListMixin:
    def get_filter_backends(self):
        return [DjangoFilterBackend, filters.OrderingFilter, filters.SearchFilter]

    def get_filterset_class(self):
        return GlobalFilter

    def filter_queryset(self, queryset):
        if self.action == 'list':
            for backend in list(self.get_filter_backends()):
                queryset = backend().filter_queryset(self.request, queryset, self)
        return queryset

    def paginate_queryset(self, queryset):
        paginate = self.request.query_params.get('pagination', 'true').lower()
        if paginate == 'false':
            return None
        paginator = self.paginator
        return paginator.paginate_queryset(queryset, self.request, self)

    def list(self, request, *args, **kwargs):
        self.filter_backends = self.get_filter_backends()
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(queryset, many=True)
        return Response({"results": serializer.data})