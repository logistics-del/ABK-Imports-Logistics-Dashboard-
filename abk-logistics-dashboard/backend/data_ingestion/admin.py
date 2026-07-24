from django.contrib import admin
from .models import DataSourceConfig, SyncLog


@admin.register(DataSourceConfig)
class DataSourceConfigAdmin(admin.ModelAdmin):
    list_display = ("name", "source_type", "is_active", "sync_interval_minutes", "last_synced_at")
    list_filter = ("source_type", "is_active")


@admin.register(SyncLog)
class SyncLogAdmin(admin.ModelAdmin):
    list_display = ("source_type", "source_name", "status", "rows_added", "rows_updated", "rows_failed", "timestamp")
    list_filter = ("source_type", "status")
    readonly_fields = [f.name for f in SyncLog._meta.fields]
