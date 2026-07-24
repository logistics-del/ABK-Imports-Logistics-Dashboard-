import django_filters as filters
from .models import Shipment


class ShipmentFilter(filters.FilterSet):
    ship_date_from = filters.DateFilter(field_name="ship_date", lookup_expr="gte")
    ship_date_to = filters.DateFilter(field_name="ship_date", lookup_expr="lte")
    edd_date_from = filters.DateFilter(field_name="edd_date", lookup_expr="gte")
    edd_date_to = filters.DateFilter(field_name="edd_date", lookup_expr="lte")
    delivery_date_from = filters.DateFilter(field_name="delivery_date", lookup_expr="gte")
    delivery_date_to = filters.DateFilter(field_name="delivery_date", lookup_expr="lte")

    status = filters.BaseInFilter(field_name="shipment_status", lookup_expr="in")
    state = filters.CharFilter(field_name="state", lookup_expr="iexact")
    vendor = filters.CharFilter(field_name="vendor", lookup_expr="iexact")
    mode_of_payment = filters.CharFilter(field_name="mode_of_payment", lookup_expr="iexact")
    compliance = filters.CharFilter(field_name="compliance", lookup_expr="iexact")

    class Meta:
        model = Shipment
        fields = [
            "status", "state", "vendor", "mode_of_payment", "compliance",
            "ship_date_from", "ship_date_to", "edd_date_from", "edd_date_to",
            "delivery_date_from", "delivery_date_to",
        ]
