from rest_framework import serializers
from .models import Shipment, AuditLog


class ShipmentSerializer(serializers.ModelSerializer):
    ageing_tat = serializers.ReadOnlyField()
    is_on_time = serializers.ReadOnlyField()
    updated_by_username = serializers.CharField(source="updated_by.username", read_only=True)

    class Meta:
        model = Shipment
        fields = [
            "id", "invoice_number", "month", "ship_date", "edd_date", "delivery_date",
            "shipment_status", "vendor", "ageing_tat", "is_on_time", "city", "state",
            "customer_mobile", "mode_of_payment", "remarks", "compliance",
            "data_source", "last_updated", "created_at", "updated_by_username",
        ]
        read_only_fields = ["id", "last_updated", "created_at", "updated_by_username"]


class ShipmentInlineEditSerializer(serializers.ModelSerializer):
    """Restricted serializer used by the inline-edit PATCH endpoint — only
    remarks & compliance are editable from the shipment table UI."""

    class Meta:
        model = Shipment
        fields = ["remarks", "compliance"]


class AuditLogSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    invoice_number = serializers.CharField(source="shipment.invoice_number", read_only=True)

    class Meta:
        model = AuditLog
        fields = ["id", "invoice_number", "username", "field_changed", "old_value", "new_value", "timestamp"]
