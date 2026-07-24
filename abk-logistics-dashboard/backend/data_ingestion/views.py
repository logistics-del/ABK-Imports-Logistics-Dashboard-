from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsAdminRole
from . import api_connector, gsheet_connector, excel_importer
from .models import DataSourceConfig, SyncLog
from .serializers import DataSourceConfigSerializer, SyncLogSerializer


class DataSourceConfigViewSet(viewsets.ModelViewSet):
    """Admin-only management of REST API / Google Sheets ingestion sources."""
    queryset = DataSourceConfig.objects.all().order_by("-created_at")
    serializer_class = DataSourceConfigSerializer
    permission_classes = [IsAdminRole]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=["post"], url_path="test-connection")
    def test_connection(self, request, pk=None):
        config = self.get_object()
        if config.source_type == DataSourceConfig.SourceType.API:
            result = api_connector.test_connection(
                config.api_endpoint_url, config.api_auth_token, config.api_auth_header
            )
        else:
            result = gsheet_connector.test_connection(config)
        return Response(result, status=status.HTTP_200_OK if result.get("success") else status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"], url_path="sync-now")
    def sync_now(self, request, pk=None):
        config = self.get_object()
        result = _run_sync(config, triggered_by=request.user, triggered_manually=True)
        return Response(result)


def _run_sync(config: DataSourceConfig, triggered_by=None, triggered_manually=True):
    from django.utils import timezone

    if config.source_type == DataSourceConfig.SourceType.API:
        result = api_connector.sync_from_api(config)
    else:
        result = gsheet_connector.sync_from_gsheet(config)

    SyncLog.objects.create(
        source_type=config.source_type,
        source_name=config.name,
        data_source_config=config,
        status=result["status"],
        rows_added=result["rows_added"],
        rows_updated=result["rows_updated"],
        rows_failed=result["rows_failed"],
        error_message=result.get("error_message", ""),
        triggered_by=triggered_by,
        triggered_manually=triggered_manually,
    )
    config.last_synced_at = timezone.now()
    config.save(update_fields=["last_synced_at"])
    return result


class ExcelPreviewView(APIView):
    """POST /api/ingestion/excel/preview/  (multipart file upload)
    Returns headers, first 10 rows, and a suggested column mapping so the
    frontend can render the mapping UI before committing anything."""
    permission_classes = [IsAdminRole]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        file_obj = request.FILES.get("file")
        if not file_obj:
            return Response({"detail": "No file uploaded."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            preview = excel_importer.preview_file(file_obj.file, file_obj.name)
        except Exception as exc:  # noqa: BLE001
            return Response({"detail": f"Could not read file: {exc}"}, status=status.HTTP_400_BAD_REQUEST)
        return Response(preview)


class ExcelImportView(APIView):
    """POST /api/ingestion/excel/import/  (multipart file + field_mapping JSON)
    Performs the confirmed import and writes a SyncLog entry."""
    permission_classes = [IsAdminRole]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        import json

        file_obj = request.FILES.get("file")
        mapping_raw = request.data.get("field_mapping")
        if not file_obj or not mapping_raw:
            return Response({"detail": "file and field_mapping are both required."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            field_mapping = json.loads(mapping_raw) if isinstance(mapping_raw, str) else mapping_raw
        except json.JSONDecodeError:
            return Response({"detail": "field_mapping must be valid JSON."}, status=status.HTTP_400_BAD_REQUEST)

        result = excel_importer.import_file(file_obj.file, file_obj.name, field_mapping)

        log_status = "success" if result["rows_failed"] == 0 else (
            "partial" if (result["rows_added"] or result["rows_updated"]) else "failed"
        )
        SyncLog.objects.create(
            source_type="excel",
            source_name=file_obj.name,
            status=log_status,
            rows_added=result["rows_added"],
            rows_updated=result["rows_updated"],
            rows_failed=result["rows_failed"],
            error_message="; ".join(f"row {e['row']}: {e['error']}" for e in result["errors"][:10]),
            triggered_by=request.user,
            triggered_manually=True,
        )
        return Response(result)


class SyncLogViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only sync history panel — last sync time, source, rows affected."""
    queryset = SyncLog.objects.select_related("data_source_config", "triggered_by").all()
    serializer_class = SyncLogSerializer
    permission_classes = [IsAdminRole]
