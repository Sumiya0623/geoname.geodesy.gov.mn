import os
from django.contrib.contenttypes.models import ContentType
from django.conf import settings

def file_upload_path(instance, filename):
    content_type = ContentType.objects.get_for_model(instance)
    model=content_type.model_class()
    model_name = model._meta.model_name
    upload_dir = os.path.join('upload_files', str(model_name))
    full_dir = os.path.join(settings.MEDIA_ROOT, upload_dir)
    os.makedirs(full_dir, exist_ok=True)
    last_pk = model.objects.order_by('-pk').first()
    last_pk_value = last_pk.pk if last_pk else 1
    file_extension = os.path.splitext(filename)[1]
    new_filename = f"{last_pk_value}{file_extension}"
    return os.path.join(upload_dir, new_filename)

def photo_upload_path(instance, filename):
    content_type = ContentType.objects.get_for_model(instance)
    model=content_type.model_class()
    model_name = model._meta.model_name
    upload_dir = os.path.join('upload_photos', str(model_name))
    full_dir = os.path.join(settings.MEDIA_ROOT, upload_dir)
    os.makedirs(full_dir, exist_ok=True)
    last_pk = model.objects.order_by('-pk').first()
    last_pk_value = last_pk.pk if last_pk else 1
    file_extension = os.path.splitext(filename)[1]
    new_filename = f"{last_pk_value}{file_extension}"
    return os.path.join(upload_dir, new_filename)
