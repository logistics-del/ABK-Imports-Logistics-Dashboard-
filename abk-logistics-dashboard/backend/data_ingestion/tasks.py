from celery import shared_task
from .models import DataSourceConfig


@shared_task
def sync_all_active_sources():
    """Celery-beat entry point: pulls fresh data from every active API /
    Google Sheets source on the configured interval (see
    abk_dashboard/celery.py -> beat_schedule)."""
    from .views import _run_sync  # local import avoids a circular import at module load

    results = []
    for config in DataSourceConfig.objects.filter(is_active=True):
        result = _run_sync(config, triggered_by=None, triggered_manually=False)
        results.append({"source": config.name, **result})
    return results
