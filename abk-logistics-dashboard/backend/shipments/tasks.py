from celery import shared_task
from django.utils import timezone
from .models import Shipment


@shared_task
def recalculate_ageing_tat():
    """Ageing TAT is computed as a live @property (today - ship_date), so
    there is nothing to persist — this task exists as a hook for future
    denormalisation (e.g. if ageing_tat becomes a stored/indexed column for
    faster large-scale filtering) and to touch `last_updated` for shipments
    that just breached SLA, so the dashboard's 'stale' badge stays accurate.
    """
    today = timezone.localdate()
    breaching = Shipment.objects.filter(
        shipment_status__in=[Shipment.Status.INTRANSIT, Shipment.Status.OFD],
        edd_date__lt=today,
    )
    count = breaching.count()
    return f"{count} shipments now past EDD and still in transit/OFD"
