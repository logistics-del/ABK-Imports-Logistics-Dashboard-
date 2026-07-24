from django.conf import settings
from django.db import models
from django.utils import timezone


INDIAN_STATES = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa",
    "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala",
    "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland",
    "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
    "Uttar Pradesh", "Uttarakhand", "West Bengal",
    "Andaman and Nicobar Islands", "Chandigarh",
    "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir",
    "Ladakh", "Lakshadweep", "Puducherry",
]


class Shipment(models.Model):
    class Status(models.TextChoices):
        HIT = "HIT", "HIT"
        MISS = "MISS", "MISS"
        RTS = "RTS", "RTS"
        INTRANSIT = "INTRANSIT", "Total Intransit"
        OFD = "OFD", "Out for Delivery"
        DELIVERED = "DELIVERED", "Delivered"
        EXCEPTION = "EXCEPTION", "Exception"
        NDR = "NDR", "NDR"

    class PaymentMode(models.TextChoices):
        COD = "COD", "COD"
        CASH = "CASH", "Cash"
        PREPAID = "PREPAID", "Prepaid"

    class Compliance(models.TextChoices):
        CUSTOMER_ISSUE = "CUSTOMER_ISSUE", "Customer Issue"
        VENDOR_ISSUE = "VENDOR_ISSUE", "Vendor Issue"
        OTHER_ISSUE = "OTHER_ISSUE", "Other Issue"

    class DataSource(models.TextChoices):
        API = "api", "API"
        EXCEL = "excel", "Excel Upload"
        GSHEET = "gsheet", "Google Sheets"
        MANUAL = "manual", "Manual Entry"

    invoice_number = models.CharField(max_length=100, unique=True, db_index=True)
    month = models.CharField(max_length=20, blank=True)
    ship_date = models.DateField()
    edd_date = models.DateField(help_text="Estimated Delivery Date")
    delivery_date = models.DateField(null=True, blank=True)

    shipment_status = models.CharField(max_length=20, choices=Status.choices, db_index=True)
    vendor = models.CharField(max_length=100, blank=True, db_index=True)

    city = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=100, db_index=True)

    customer_mobile = models.CharField(max_length=15, blank=True)
    mode_of_payment = models.CharField(max_length=20, choices=PaymentMode.choices, default=PaymentMode.PREPAID)

    remarks = models.TextField(blank=True)
    compliance = models.CharField(max_length=30, choices=Compliance.choices, blank=True)

    data_source = models.CharField(max_length=20, choices=DataSource.choices, default=DataSource.MANUAL)
    last_updated = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="shipment_edits"
    )

    class Meta:
        ordering = ["-ship_date"]
        indexes = [
            models.Index(fields=["state", "shipment_status"]),
            models.Index(fields=["vendor", "shipment_status"]),
        ]

    def __str__(self):
        return f"{self.invoice_number} [{self.shipment_status}]"

    @property
    def ageing_tat(self):
        """Days since dispatch. For delivered/RTS shipments this is measured
        up to the delivery date; otherwise it is measured up to today."""
        end = self.delivery_date or timezone.localdate()
        return max((end - self.ship_date).days, 0)

    @property
    def is_on_time(self):
        if self.delivery_date:
            return self.delivery_date <= self.edd_date
        return None


class AuditLog(models.Model):
    """Tracks every edit made to a shipment's editable fields (remarks /
    compliance) — who changed what, and when."""

    shipment = models.ForeignKey(Shipment, on_delete=models.CASCADE, related_name="audit_logs")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    field_changed = models.CharField(max_length=50)
    old_value = models.TextField(blank=True)
    new_value = models.TextField(blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-timestamp"]

    def __str__(self):
        return f"{self.shipment.invoice_number}: {self.field_changed} changed by {self.user}"
