import os

from celery import Celery
from celery.schedules import crontab
from django.apps import apps
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "portal.settings")
app = Celery("portal", backend="redis")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks(lambda: [n.name for n in apps.get_app_configs()])

BASE_REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379")
app.conf.broker_url = BASE_REDIS_URL

# Celery beat schedule
app.conf.beat_schedule = {
    "auto-accept-acts-daily": {
        "task": "portal.utils.tasks.auto_accept_acts",
        "schedule": crontab(hour=3, minute=0),  # Өдөр бүр 03:00
    },
}