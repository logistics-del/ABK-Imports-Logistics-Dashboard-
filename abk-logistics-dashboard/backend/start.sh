#!/bin/sh
   set -e
   python manage.py makemigrations accounts shipments data_ingestion --noinput
   python manage.py migrate --noinput
   python manage.py collectstatic --noinput
   python manage.py bootstrap_demo
   exec gunicorn abk_dashboard.wsgi:application --bind 0.0.0.0:${PORT:-8000} --workers 2
