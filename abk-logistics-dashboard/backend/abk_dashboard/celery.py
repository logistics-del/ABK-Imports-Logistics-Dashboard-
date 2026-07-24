import os
from celery import Celery
from celery.schedules import crontab
from decouple import config

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "abk_dashboard.settings")

app = Celery("abk_dashboard")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()

REFRESH_MINUTES = config("AUTO_REFRESH_INTERVAL_MINUTES", default=20, cast=int)

app.conf.beat_schedule = {
    "sync-all-active-data-sources": {
        "task": "data_ingestion.tasks.sync_all_active_sources",
        "schedule": REFRESH_MINUTES * 60,
    },
    "recalculate-ageing-tat": {
        "task": "shipments.tasks.recalculate_ageing_tat",
        "schedule": crontab(minute=0),  # hourly
    },
}
app.conf.timezone = config("TIME_ZONE", default="Asia/Kolkata")


@app.task(bind=True)
def debug_task(self):
    print(f"Request: {self.request!r}")
