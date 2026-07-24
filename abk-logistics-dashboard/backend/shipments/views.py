from datetime import timedelta

from django.http import FileResponse
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets, filters as drf_filters, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsAdminOrReadOnly
from .filters import ShipmentFilter
from .models import Shipment, AuditLog, INDIAN_STATES
from .serializers import ShipmentSerializer, ShipmentInlineEditSerializer, AuditLogSerializer
from .utils import build_pending_cases_workbook, PENDING_ACTIVE_STATUSES

STATUS_LIST = [c[0] for c in Shipment.Status.choices]


class ShipmentViewSet(viewsets.ModelViewSet):
    """
    Full CRUD for shipments.
    - Admins: create/update/delete + bulk import (via data_ingestion app).
    - Viewers: read-only, plus the inline-edit action which is itself
      restricted to remarks/compliance for whichever role is allowed
      to edit (Admins by default per the spec's role matrix).
    """
    queryset = Shipment.objects.all()
    serializer_class = ShipmentSerializer
    permission_classes = [IsAdminOrReadOnly]
    filter_backends = [DjangoFilterBackend, drf_filters.SearchFilter, drf_filters.OrderingFilter]
    filterset_class = ShipmentFilter
    search_fields = ["invoice_number", "customer_mobile"]
    ordering_fields = ["ship_date", "edd_date", "delivery_date", "last_updated"]

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)

    @action(detail=True, methods=["patch"], url_path="inline-edit", permission_classes=[IsAuthenticated])
    def inline_edit(self, request, pk=None):
        """PATCH /api/shipments/shipments/{id}/inline-edit/
        Allows editing remarks & compliance from the table UI, logging an
        AuditLog entry for every changed field."""
        shipment = self.get_object()
        serializer = ShipmentInlineEditSerializer(shipment, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        for field in ("remarks", "compliance"):
            if field in serializer.validated_data:
                old_value = getattr(shipment, field) or ""
                new_value = serializer.validated_data[field] or ""
                if old_value != new_value:
                    AuditLog.objects.create(
                        shipment=shipment, user=request.user, field_changed=field,
                        old_value=old_value, new_value=new_value,
                    )

        serializer.save(updated_by=request.user)
        return Response({"detail": "Saved", "shipment": ShipmentSerializer(shipment).data})

    @action(detail=False, methods=["get"], url_path="audit-log")
    def audit_log(self, request):
        qs = AuditLog.objects.select_related("shipment", "user").all()[:200]
        return Response(AuditLogSerializer(qs, many=True).data)


class KPISummaryView(APIView):
    """
    GET /api/shipments/kpi-summary/?<same filters as ShipmentViewSet>
    Returns counts + % share + trend arrow (vs. the immediately preceding
    period of equal length, based on ship_date) for every status card.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        base_qs = ShipmentFilter(request.GET, queryset=Shipment.objects.all()).qs
        total = base_qs.count()

        counts = {s: base_qs.filter(shipment_status=s).count() for s in STATUS_LIST}

        prev_counts = self._previous_period_counts(request)

        cards = []
        for status_code in STATUS_LIST:
            count = counts[status_code]
            pct = round((count / total) * 100, 2) if total else 0.0
            prev = prev_counts.get(status_code, 0)
            if prev == 0:
                trend = "flat" if count == 0 else "up"
                trend_pct = 0.0
            else:
                trend_pct = round(((count - prev) / prev) * 100, 2)
                trend = "up" if count > prev else ("down" if count < prev else "flat")
            cards.append({
                "status": status_code,
                "label": dict(Shipment.Status.choices)[status_code],
                "count": count,
                "percent": pct,
                "trend": trend,
                "trend_percent": trend_pct,
            })

        return Response({
            "total_shipments": total,
            "cards": cards,
            "last_updated": timezone.now(),
        })

    @staticmethod
    def _previous_period_counts(request):
        date_from = request.GET.get("ship_date_from")
        date_to = request.GET.get("ship_date_to")
        if not (date_from and date_to):
            return {}
        try:
            d_from = timezone.datetime.fromisoformat(date_from).date()
            d_to = timezone.datetime.fromisoformat(date_to).date()
        except ValueError:
            return {}
        span = (d_to - d_from).days + 1
        prev_to = d_from - timedelta(days=1)
        prev_from = prev_to - timedelta(days=span - 1)

        params = request.GET.copy()
        params["ship_date_from"] = prev_from.isoformat()
        params["ship_date_to"] = prev_to.isoformat()
        prev_qs = ShipmentFilter(params, queryset=Shipment.objects.all()).qs
        return {s: prev_qs.filter(shipment_status=s).count() for s in STATUS_LIST}


class HeatmapDataView(APIView):
    """
    GET /api/shipments/heatmap/?metric=hit_rate|miss_rate&<filters>
    Returns per-state shipment counts + HIT/MISS rate for the India choropleth.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        metric = request.GET.get("metric", "hit_rate")
        base_qs = ShipmentFilter(request.GET, queryset=Shipment.objects.all()).qs

        data = []
        for state in INDIAN_STATES:
            state_qs = base_qs.filter(state__iexact=state)
            total = state_qs.count()
            hit = state_qs.filter(shipment_status=Shipment.Status.HIT).count()
            miss = state_qs.filter(shipment_status=Shipment.Status.MISS).count()
            rts = state_qs.filter(shipment_status=Shipment.Status.RTS).count()
            hit_rate = round((hit / total) * 100, 2) if total else None
            miss_rate = round((miss / total) * 100, 2) if total else None
            data.append({
                "state": state,
                "total": total,
                "hit": hit,
                "miss": miss,
                "rts": rts,
                "hit_rate": hit_rate,
                "miss_rate": miss_rate,
                "value": hit_rate if metric == "hit_rate" else miss_rate,
            })

        return Response({"metric": metric, "states": data})


class StateExportView(APIView):
    """
    GET /api/shipments/export-state/<state_name>/
    Streams an .xlsx of all pending/active shipments for the given state.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, state_name):
        qs = Shipment.objects.filter(
            state__iexact=state_name, shipment_status__in=PENDING_ACTIVE_STATUSES
        ).order_by("ship_date")

        buffer = build_pending_cases_workbook(qs, state_name)
        date_str = timezone.localdate().isoformat()
        filename = f"ABK_Pending_Cases_{state_name.replace(' ', '_')}_{date_str}.xlsx"
        response = FileResponse(
            buffer,
            as_attachment=True,
            filename=filename,
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        return response


class VendorPerformanceView(APIView):
    """GET /api/shipments/vendor-performance/ — HIT/MISS/RTS breakdown per
    vendor, for the vendor comparison chart in the frontend."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        base_qs = ShipmentFilter(request.GET, queryset=Shipment.objects.all()).qs
        vendors = base_qs.exclude(vendor="").values_list("vendor", flat=True).distinct()

        data = []
        for vendor in vendors:
            v_qs = base_qs.filter(vendor=vendor)
            total = v_qs.count()
            hit = v_qs.filter(shipment_status=Shipment.Status.HIT).count()
            data.append({
                "vendor": vendor,
                "total": total,
                "hit": hit,
                "miss": v_qs.filter(shipment_status=Shipment.Status.MISS).count(),
                "rts": v_qs.filter(shipment_status=Shipment.Status.RTS).count(),
                "hit_rate": round((hit / total) * 100, 2) if total else 0,
            })
        return Response(sorted(data, key=lambda d: -d["total"]))
