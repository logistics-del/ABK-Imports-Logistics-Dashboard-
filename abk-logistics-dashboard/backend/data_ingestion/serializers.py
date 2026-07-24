from rest_framework import serializers
from .models import DataSourceConfig, SyncLog


class DataSourceConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = DataSourceConfig
        fields = [
            "id", "name", "source_type", "is_active", "sync_interval_minutes",
            "api_endpoint_url", "api_auth_token", "api_auth_header",
            "gsheet_id", "gsheet_worksheet_name", "gsheet_service_account_json",
            "field_mapping", "created_by", "created_at", "updated_at", "last_synced_at",
        ]
        read_only_fields = ["id", "created_by", "created_at", "updated_at", "last_synced_at"]
        extra_kwargs = {"api_auth_token": {"write_only": True}}


class SyncLogSerializer(serializers.ModelSerializer):
    triggered_by_username = serializers.CharField(source="triggered_by.username", read_only=True, default=None)

    class Meta:
        model = SyncLog
        fields = [
            "id", "source_type", "source_name", "data_source_config", "status",
            "rows_added", "rows_updated", "rows_failed", "error_message",
            "triggered_by_username", "triggered_manually", "timestamp",
        ]
