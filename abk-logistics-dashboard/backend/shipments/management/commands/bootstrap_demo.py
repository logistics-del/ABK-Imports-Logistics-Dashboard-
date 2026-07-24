"""Runs automatically on every deploy (via Render's Pre-Deploy Command) so
that a free hosted instance — which has no Shell/SSH access — still ends up
with a working login and some sample data, without anyone needing a
terminal. Safe to run repeatedly: it only creates things that don't
already exist.
"""
import os

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import BaseCommand

from shipments.models import Shipment


class Command(BaseCommand):
    help = "Idempotently create a demo admin user and seed sample shipments if the database is empty."

    def handle(self, *args, **options):
        User = get_user_model()
        username = os.environ.get("DEMO_ADMIN_USERNAME", "admin")
        email = os.environ.get("DEMO_ADMIN_EMAIL", "admin@example.com")
        password = os.environ.get("DEMO_ADMIN_PASSWORD", "ABKDemo2026!")

        if not User.objects.filter(username=username).exists():
            User.objects.create_superuser(
                username=username, email=email, password=password, role="admin"
            )
            self.stdout.write(self.style.SUCCESS(f"Created demo admin user '{username}'."))
        else:
            self.stdout.write(f"User '{username}' already exists — skipping creation.")

        if not Shipment.objects.exists():
            call_command("seed_demo_data", count=800)
            self.stdout.write(self.style.SUCCESS("Seeded 800 demo shipments."))
        else:
            self.stdout.write("Shipments already present — skipping demo data seed.")
