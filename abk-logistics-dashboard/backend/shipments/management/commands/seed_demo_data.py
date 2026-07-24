"""Generates realistic demo shipment data so the dashboard can be exercised
end-to-end without waiting on a real API / Google Sheet connection.

Usage:
    python manage.py seed_demo_data --count 800
"""
import random
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from shipments.models import Shipment, INDIAN_STATES

VENDORS = [
    "DP World", "BlueDart", "Safexpress", "Gati KWE", "Delhivery",
    "V-Xpress", "Movin", "DTDC Express", "Xpressbees", "Shadowfax",
]

CITY_BY_STATE = {
    "Maharashtra": ["Mumbai", "Pune", "Nagpur"],
    "Karnataka": ["Bengaluru", "Mysuru"],
    "Delhi": ["New Delhi"],
    "Tamil Nadu": ["Chennai", "Coimbatore"],
    "West Bengal": ["Kolkata", "Siliguri"],
    "Telangana": ["Hyderabad"],
    "Gujarat": ["Ahmedabad", "Surat"],
    "Kerala": ["Kochi", "Thiruvananthapuram"],
    "Haryana": ["Gurugram", "Faridabad"],
    "Punjab": ["Ludhiana", "Amritsar"],
}

# Weighted so the demo data resembles the shape of a real HIT-heavy book.
STATUS_WEIGHTS = [
    (Shipment.Status.HIT, 55), (Shipment.Status.DELIVERED, 15),
    (Shipment.Status.MISS, 12), (Shipment.Status.INTRANSIT, 8),
    (Shipment.Status.OFD, 4), (Shipment.Status.RTS, 3),
    (Shipment.Status.EXCEPTION, 2), (Shipment.Status.NDR, 1),
]
PAYMENT_WEIGHTS = [
    (Shipment.PaymentMode.PREPAID, 60), (Shipment.PaymentMode.COD, 30), (Shipment.PaymentMode.CASH, 10),
]
COMPLIANCE_CHOICES = ["", "", "CUSTOMER_ISSUE", "VENDOR_ISSUE", "OTHER_ISSUE"]


def weighted_choice(weighted):
    population, weights = zip(*weighted)
    return random.choices(population, weights=weights, k=1)[0]


class Command(BaseCommand):
    help = "Seed the database with demo shipment records for testing the dashboard."

    def add_arguments(self, parser):
        parser.add_argument("--count", type=int, default=500)
        parser.add_argument("--clear", action="store_true", help="Delete existing shipments first")

    def handle(self, *args, **options):
        count = options["count"]
        if options["clear"]:
            deleted, _ = Shipment.objects.all().delete()
            self.stdout.write(self.style.WARNING(f"Deleted {deleted} existing shipment rows."))

        today = timezone.localdate()
        created = 0
        for i in range(count):
            state = random.choice(INDIAN_STATES)
            city = random.choice(CITY_BY_STATE.get(state, [state]))
            ship_date = today - timedelta(days=random.randint(1, 90))
            edd_date = ship_date + timedelta(days=random.randint(2, 7))
            status = weighted_choice(STATUS_WEIGHTS)

            delivery_date = None
            if status in (Shipment.Status.HIT, Shipment.Status.DELIVERED):
                delivery_date = edd_date - timedelta(days=random.randint(0, 2))
            elif status == Shipment.Status.MISS:
                delivery_date = edd_date + timedelta(days=random.randint(1, 5))
            elif status == Shipment.Status.RTS:
                delivery_date = edd_date + timedelta(days=random.randint(2, 10))

            invoice_number = f"ABK-DEMO-{today.strftime('%Y%m')}-{i:05d}"
            Shipment.objects.update_or_create(
                invoice_number=invoice_number,
                defaults=dict(
                    month=ship_date.strftime("%B %Y"),
                    ship_date=ship_date,
                    edd_date=edd_date,
                    delivery_date=delivery_date,
                    shipment_status=status,
                    vendor=random.choice(VENDORS),
                    city=city,
                    state=state,
                    customer_mobile=f"9{random.randint(100000000, 999999999)}",
                    mode_of_payment=weighted_choice(PAYMENT_WEIGHTS),
                    remarks="",
                    compliance=random.choice(COMPLIANCE_CHOICES),
                    data_source=Shipment.DataSource.MANUAL,
                ),
            )
            created += 1

        self.stdout.write(self.style.SUCCESS(f"Seeded {created} demo shipments."))
