from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    ShipmentViewSet, KPISummaryView, HeatmapDataView,
    StateExportView, VendorPerformanceView,
)

router = DefaultRouter()
router.register("shipments", ShipmentViewSet, basename="shipment")

urlpatterns = [
    path("kpi-summary/", KPISummaryView.as_view(), name="kpi-summary"),
    path("heatmap/", HeatmapDataView.as_view(), name="heatmap"),
    path("vendor-performance/", VendorPerformanceView.as_view(), name="vendor-performance"),
    path("export-state/<str:state_name>/", StateExportView.as_view(), name="export-state"),
    path("", include(router.urls)),
]
