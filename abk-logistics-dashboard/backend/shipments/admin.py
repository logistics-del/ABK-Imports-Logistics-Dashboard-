from django.contrib import admin
from .models import Shipment, AuditLog


@admin.register(Shipment)
class ShipmentAdmin(admin.ModelAdmin):
    list_display = ("invoice_number", "shipment_status", "vendor", "state", "ship_date", "edd_date", "delivery_date")
    list_filter = ("shipment_status", "state", "vendor", "mode_of_payment", "data_source")
    search_fields = ("invoice_number", "customer_mobile")
    date_hierarchy = "ship_date"


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ("shipment", "user", "field_changed", "timestamp")
    list_filter = ("field_changed",)
    readonly_fields = [f.name for f in AuditLog._meta.fields]
