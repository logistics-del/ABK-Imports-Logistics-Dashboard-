from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    DataSourceConfigViewSet, ExcelPreviewView, ExcelImportView, SyncLogViewSet,
)

router = DefaultRouter()
router.register("sources", DataSourceConfigViewSet, basename="data-source")
router.register("sync-logs", SyncLogViewSet, basename="sync-log")

urlpatterns = [
    path("excel/preview/", ExcelPreviewView.as_view(), name="excel-preview"),
    path("excel/import/", ExcelImportView.as_view(), name="excel-import"),
    path("", include(router.urls)),
]
