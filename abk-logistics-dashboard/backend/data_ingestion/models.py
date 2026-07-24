from django.conf import settings
from django.db import models


class DataSourceConfig(models.Model):
    """Configuration for a REST API or Google Sheets ingestion source.
    Excel uploads are one-off actions and don't need a persisted config,
    but every import (of any source type) writes a SyncLog row below."""

    class SourceType(models.TextChoices):
        API = "api", "REST API"
        GSHEET = "gsheet", "Google Sheets"

    name = models.CharField(max_length=150)
    source_type = models.CharField(max_length=20, choices=SourceType.choices)
    is_active = models.BooleanField(default=True)
    sync_interval_minutes = models.PositiveIntegerField(default=20)

    # REST API fields
    api_endpoint_url = models.URLField(blank=True)
    api_auth_token = models.CharField(max_length=500, blank=True)
    api_auth_header = models.CharField(max_length=100, default="Authorization")

    # Google Sheets fields
    gsheet_id = models.CharField(max_length=200, blank=True)
    gsheet_worksheet_name = models.CharField(max_length=150, blank=True, default="Sheet1")
    gsheet_service_account_json = models.FileField(upload_to="gsheet_credentials/", blank=True, null=True)

    # Shared: maps external field name -> internal Shipment field name, e.g.
    # {"Invoice No": "invoice_number", "Courier": "vendor", ...}
    field_mapping = models.JSONField(default=dict, blank=True)

    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_synced_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.name} ({self.source_type})"


class SyncLog(models.Model):
    class SourceType(models.TextChoices):
        API = "api", "REST API"
        EXCEL = "excel", "Excel Upload"
        GSHEET = "gsheet", "Google Sheets"

    class Status(models.TextChoices):
        SUCCESS = "success", "Success"
        PARTIAL = "partial", "Partial Success"
        FAILED = "failed", "Failed"

    source_type = models.CharField(max_length=20, choices=SourceType.choices)
    source_name = models.CharField(max_length=150, blank=True)
    data_source_config = models.ForeignKey(
        DataSourceConfig, null=True, blank=True, on_delete=models.SET_NULL, related_name="sync_logs"
    )
    status = models.CharField(max_length=20, choices=Status.choices)
    rows_added = models.PositiveIntegerField(default=0)
    rows_updated = models.PositiveIntegerField(default=0)
    rows_failed = models.PositiveIntegerField(default=0)
    error_message = models.TextField(blank=True)
    triggered_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    triggered_manually = models.BooleanField(default=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-timestamp"]

    def __str__(self):
        return f"{self.source_type} sync @ {self.timestamp:%Y-%m-%d %H:%M} — {self.status}"
