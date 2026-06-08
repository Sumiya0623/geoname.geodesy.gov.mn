from django.contrib import admin
from django.apps import apps
# Register your models here.
class ListAdminMixin(object):
    def __init__(self, model, admin_site):
        self.list_display = [field.name for field in model._meta.fields if not field.name.lower()=='content']
        super(ListAdminMixin, self).__init__(model, admin_site)
        
models = apps.get_models()
for model in models:
    if model._meta.app_label == 'token_blacklist':
        continue
    if model.__name__.lower() in ['notification', 'periodictask','clockedschedule','crontabschedule','solarschedule','intervalschedule','application','accesstoken','grant','idtoken','refreshtoken']:
        continue
    admin_class = type('AdminClass', (ListAdminMixin, admin.ModelAdmin), {})
    try:
        admin.site.register(model, admin_class)
    except admin.sites.AlreadyRegistered:
        pass
