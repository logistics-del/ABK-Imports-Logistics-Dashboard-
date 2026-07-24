from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """Custom user with a role for Admin / Viewer access control."""

    class Role(models.TextChoices):
        ADMIN = "admin", "Admin"
        VIEWER = "viewer", "Viewer"

    role = models.CharField(max_length=20, choices=Role.choices, default=Role.VIEWER)
    phone_number = models.CharField(max_length=15, blank=True)
    is_active_dashboard_user = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    @property
    def is_admin_role(self):
        return self.role == self.Role.ADMIN

    def __str__(self):
        return f"{self.username} ({self.role})"
