"""Google Sheets ingestion connector, using a service-account JSON key for
auth (uploaded by the admin per-source, or falling back to the app-wide
GOOGLE_SERVICE_ACCOUNT_FILE setting)."""
import gspread
from django.conf import settings
from google.oauth2.service_account import Credentials

from .mapping_utils import map_row, upsert_shipment_row

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets.readonly",
    "https://www.googleapis.com/auth/drive.readonly",
]


def _get_client(service_account_path: str):
    creds = Credentials.from_service_account_file(service_account_path, scopes=SCOPES)
    return gspread.authorize(creds)


def _resolve_credentials_path(config):
    if config.gsheet_service_account_json and hasattr(config.gsheet_service_account_json, "path"):
        return config.gsheet_service_account_json.path
    return settings.GOOGLE_SERVICE_ACCOUNT_FILE


def test_connection(config):
    cred_path = _resolve_credentials_path(config)
    if not cred_path:
        return {"success": False, "error": "No service account JSON configured."}
    try:
        client = _get_client(cred_path)
        sh = client.open_by_key(config.gsheet_id)
        ws = sh.worksheet(config.gsheet_worksheet_name) if config.gsheet_worksheet_name else sh.sheet1
        headers = ws.row_values(1)
        return {"success": True, "sheet_title": sh.title, "worksheet": ws.title, "headers": headers}
    except Exception as exc:  # noqa: BLE001 - surface any gspread/auth error to the UI
        return {"success": False, "error": str(exc)}


def sync_from_gsheet(config):
    cred_path = _resolve_credentials_path(config)
    if not cred_path:
        return {"status": "failed", "rows_added": 0, "rows_updated": 0, "rows_failed": 0,
                 "error_message": "No service account JSON configured."}

    added = updated = unchanged = failed = 0
    errors = []

    try:
        client = _get_client(cred_path)
        sh = client.open_by_key(config.gsheet_id)
        ws = sh.worksheet(config.gsheet_worksheet_name) if config.gsheet_worksheet_name else sh.sheet1
        records = ws.get_all_records()
    except Exception as exc:  # noqa: BLE001
        return {"status": "failed", "rows_added": 0, "rows_updated": 0, "rows_failed": 0,
                 "error_message": f"Google Sheets fetch failed: {exc}"}

    for i, raw_row in enumerate(records, start=2):  # row 1 = header
        mapped = map_row(raw_row, config.field_mapping)
        result, error, invoice_number = upsert_shipment_row(mapped, data_source="gsheet")
        if result == "added":
            added += 1
        elif result == "updated":
            updated += 1
        elif result == "unchanged":
            unchanged += 1
        else:
            failed += 1
            errors.append({"row": i, "invoice_number": invoice_number, "error": error})

    status = "success" if failed == 0 else ("partial" if (added or updated) else "failed")
    return {
        "status": status,
        "rows_added": added,
        "rows_updated": updated,
        "rows_failed": failed,
        "error_message": "; ".join(f"row {e['row']}: {e['error']}" for e in errors[:10]),
    }
