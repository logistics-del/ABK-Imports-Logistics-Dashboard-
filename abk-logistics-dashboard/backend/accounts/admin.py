from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = ("username", "email", "role", "is_active_dashboard_user", "is_staff")
    list_filter = ("role", "is_active_dashboard_user", "is_staff")
    fieldsets = UserAdmin.fieldsets + (
        ("Dashboard Access", {"fields": ("role", "phone_number", "is_active_dashboard_user")}),
    )
