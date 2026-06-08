from django_filters import FilterSet
from django_filters import CharFilter, NumberFilter, DateFilter, BooleanFilter, DateFromToRangeFilter, BaseInFilter
from django.db.models import Q, TextField
from django.db.models.functions import Cast
from django.core.exceptions import FieldDoesNotExist
class OrCharFilter(CharFilter):
    def __init__(self, *args, **kwargs):
        fields = kwargs.pop('field_name')
        if not isinstance(fields, (list, tuple)):
            fields = [fields]
        self.field_names = list(fields)
        kwargs['field_name'] = self.field_names[0]
        super().__init__(*args, **kwargs)

    def filter(self, qs, value):
        if not value:
            return qs
        lookup = self.lookup_expr or 'icontains'
        needs_cast = []
        for f in self.field_names:
            try:
                field = qs.model._meta.get_field(f)
                if field.get_internal_type() in {'IntegerField', 'BigIntegerField', 'PositiveIntegerField'}:
                    needs_cast.append(f)
            except FieldDoesNotExist:
                # Тухайн нэртэй талбар байхгүй бол тухайн field-ийг алгасана.
                continue
        for f in needs_cast:
            alias = f'__{f}_as_text'
            if alias not in qs.query.annotations:
                qs = qs.annotate(**{alias: Cast(f, TextField())})
        q = Q()
        for f in self.field_names:
            alias = f'__{f}_as_text'
            if alias in qs.query.annotations:
                q |= Q(**{f'{alias}__{lookup}': value})
            else:
                q |= Q(**{f'{f}__{lookup}': value})
        return qs.filter(q)

class MultiFieldInFilter(BaseInFilter, CharFilter):
    def __init__(self, *args, **kwargs):
        fields = kwargs.pop('field_name')
        if not isinstance(fields, (list, tuple)):
            fields = [fields]
        self.field_names = list(fields)
        kwargs['field_name'] = self.field_names[0]
        super().__init__(*args, **kwargs)
    def _clean_values(self, value_list):
        vals = [str(v).strip() for v in (value_list or []) if str(v).strip() != ""]
        return vals
    def filter(self, qs, value):
        vals = self._clean_values(value)
        if not vals:
            return qs
        q = Q()
        for f in self.field_names:
            if f.endswith('__id'):
                try:
                    id_vals = [int(v) for v in vals]
                except ValueError:
                    id_vals = vals
                q |= Q(**{f"{f}__in": id_vals})
            else:
                q |= Q(**{f"{f}__in": vals})
        return qs.filter(q).distinct()
    
class GlobalCharFilter(CharFilter):
    def __init__(self, *args, **kwargs):
        kwargs.setdefault('lookup_expr', 'icontains')
        super().__init__(*args, **kwargs)

class GlobalNumberFilter(NumberFilter):
    pass
class GlobalDateFilter(DateFilter):
    pass
class GlobalBooleanFilter(BooleanFilter):
    pass

class CommaSeparatedIntegerFilter(BaseInFilter, CharFilter):
    pass
class GlobalFilter(FilterSet):
        # Profile Fields
    user = GlobalCharFilter(field_name='user__first_name')
    user_id = GlobalNumberFilter(field_name='user')  # бүртгэсэн хэрэглэгчийн FK id-аар шүүх

    user__first_name = GlobalCharFilter(field_name='user__first_name')
    name_or_register =  OrCharFilter(
        field_name=('user__first_name', 'user__register'),
        lookup_expr='icontains',
    )
    measurement__measured_date = GlobalDateFilter(field_name='measurement__measured_date')
    measurement__point__name = OrCharFilter( 
        field_name=('measurement__point__name', 'measurement__point__number'),
        lookup_expr='icontains',)
    measurement__point=GlobalNumberFilter(field_name='measurement__point__id')
    unit__in = CommaSeparatedIntegerFilter(field_name='unit')
    email = GlobalCharFilter(field_name='user__email')
    register = GlobalCharFilter()
    is_new = GlobalBooleanFilter(field_name='is_new')
    is_citizen = GlobalBooleanFilter(field_name='is_citizen')
    register = GlobalCharFilter(field_name='user__register')
    group = GlobalNumberFilter(field_name='group')  # filter by group ID
    geomtype = GlobalNumberFilter(field_name='geomtype')  # filter by group ID
    order=GlobalNumberFilter(field_name='order') 
    parent=GlobalNumberFilter(field_name='parent')
    uniqid = GlobalCharFilter()
    level__parent__parent=GlobalNumberFilter(field_name='level__parent__parent')
    level__parent=GlobalNumberFilter(field_name='level__parent')
    level=GlobalNumberFilter(field_name='level')
    level__parent__parent__name=GlobalCharFilter(field_name='level__parent__parent__name')
    level__parent__name=GlobalCharFilter(field_name='level__parent__name')
    level__name=GlobalCharFilter(field_name='level__name')
    parent__parent__unit=GlobalNumberFilter(field_name='parent__parent__unit')
    parent__unit=GlobalNumberFilter(field_name='parent__unit')
    unit=GlobalNumberFilter(field_name='unit')
    location__unit__parent__parent=GlobalNumberFilter(field_name='location__unit__parent__parent')
    location__unit__parent=GlobalNumberFilter(field_name='location__unit__parent')
    docType=GlobalNumberFilter(field_name='docType')
    parent=GlobalNumberFilter(field_name='parent')
    path = GlobalCharFilter()
    minscale = GlobalNumberFilter()
    maxscale = GlobalNumberFilter()
    code = GlobalCharFilter()
    description = GlobalCharFilter()
    is_real=GlobalBooleanFilter()
    role = GlobalNumberFilter(field_name='role__id')
    name = GlobalCharFilter(field_name='name')
    number = GlobalCharFilter(field_name='number')
    name_or_number =  OrCharFilter(
        field_name=('name', 'number'),
        lookup_expr='icontains',
    )
    network_in = MultiFieldInFilter(
        field_name=('network__parent__id', 'children__network__parent__id','parent__network__parent__id'),
        lookup_expr='in',
    )
    status_code=GlobalCharFilter(field_name='status_code', lookup_expr='startswith')
    roles_in = CommaSeparatedIntegerFilter(field_name='roles__id', lookup_expr='in')
    unit_in = CommaSeparatedIntegerFilter(field_name='unit__id', lookup_expr='in')
    names_in = GlobalCharFilter(field_name='names__name')
    name_id_in = CommaSeparatedIntegerFilter(field_name='names__id', lookup_expr='in')
    class_in = CommaSeparatedIntegerFilter(field_name='network__id', lookup_expr='in')
    nomek_in = CommaSeparatedIntegerFilter(field_name='nomek__id', lookup_expr='in')
    system_in = CommaSeparatedIntegerFilter(field_name='system__id', lookup_expr='in')
    status_in = CommaSeparatedIntegerFilter(field_name='status__id', lookup_expr='in')
    point_nomek_in=CommaSeparatedIntegerFilter(field_name='point__nomek__id', lookup_expr='in')
    point_unit_query=GlobalCharFilter(field_name='point__unit__id',lookup_expr='icontains')
    point_unit_in = CommaSeparatedIntegerFilter(field_name='point__unit__id', lookup_expr='in')
    installed=GlobalDateFilter(field_name='installed')
    count=GlobalNumberFilter(field_name='count')
    nomek100=GlobalCharFilter(field_name='nomek100')
    point_id=GlobalNumberFilter(field_name='point')

    measurement_system_in = CommaSeparatedIntegerFilter(field_name='measurements__system__id', lookup_expr='in')
    measurement_network_in = CommaSeparatedIntegerFilter(field_name='measurements__network__parent__id', lookup_expr='in')
    measurement_class_in= CommaSeparatedIntegerFilter(field_name='measurements__network__id', lookup_expr='in')
    point_name_or_number =  OrCharFilter(
        field_name=('point__name', 'point__number'),
        lookup_expr='icontains',
    )
    measurement_point_name_or_number =  OrCharFilter(
        field_name=('measurement__point__name', 'measurement__point__number'),
        lookup_expr='icontains',
    )
    store=GlobalNumberFilter(field_name='store')
    table__name=GlobalCharFilter(field_name='table__name')
    store__name=GlobalCharFilter(field_name='store__name')
    column_name=GlobalCharFilter(field_name='column_name')
    column=GlobalCharFilter(field_name='column')
    geomtype=GlobalCharFilter(field_name='geomtype')


    key=GlobalCharFilter()
    layer=GlobalNumberFilter(field_name='layer')
    is_list=GlobalBooleanFilter()
    attribute = GlobalNumberFilter(field_name='attribute')
    menu = GlobalNumberFilter(field_name='menu')
    job = GlobalNumberFilter(field_name='job')
    status = GlobalNumberFilter(field_name='status')
    itrf = GlobalNumberFilter(field_name='itrf')
    year = GlobalNumberFilter(field_name='year')
    doy = GlobalNumberFilter(field_name='doy')

    point__name=GlobalCharFilter(field_name='point__name')
    point__number=GlobalCharFilter(field_name='point__number')
    project=GlobalNumberFilter(field_name='project__id')
    project__name=GlobalCharFilter(field_name='project__name')

    status_code=GlobalNumberFilter(field_name='status_code')
    method=GlobalCharFilter(field_name='method')
    remote_ip=GlobalCharFilter(field_name='remote_ip')
    url=GlobalCharFilter(field_name='url')
    datetime=GlobalDateFilter(field_name='datetime')


    first_name = GlobalCharFilter()
    last_name = GlobalCharFilter()
    email = GlobalCharFilter()
    code = GlobalCharFilter()
    is_active = BooleanFilter()
    
    measured_start_date = DateFilter(field_name='measurements__measured_date', lookup_expr='gte')
    measured_end_date = DateFilter(field_name='measurements__measured_date', lookup_expr='lte')

    created_date = DateFilter(field_name='created_date', lookup_expr='gte')
    end_date = DateFilter(field_name='created_date', lookup_expr='lte')
    
    modified_date = DateFromToRangeFilter()
    joined_date = DateFromToRangeFilter()
    date_joined = DateFromToRangeFilter()
    start_date = DateFromToRangeFilter()
    madeyear=DateFromToRangeFilter()
    start_date = GlobalDateFilter()


    serial= GlobalCharFilter()
    website = GlobalCharFilter()
    phone = GlobalCharFilter()
    mobile = GlobalCharFilter()

    # Monpos & Points
    marker_num = GlobalCharFilter()
    name = GlobalCharFilter()
    point_doy= GlobalCharFilter(field_name='job__doy')
    point_year= GlobalCharFilter(field_name='job__year')
    job = GlobalCharFilter(field_name='job__id')
    is_static = GlobalBooleanFilter()
    geodeticnetwork_name = GlobalCharFilter(field_name='geodeticnetwork__name')
    itrf_name=GlobalCharFilter(field_name='itrf__name')
    status_name=GlobalCharFilter(field_name='status__name')
    location_unit1 = GlobalCharFilter(field_name='location__unit1')
    location_unit2 = GlobalCharFilter(field_name='location__unit2')
    items__point__in = CommaSeparatedIntegerFilter(field_name='items__point__id', lookup_expr='in')
