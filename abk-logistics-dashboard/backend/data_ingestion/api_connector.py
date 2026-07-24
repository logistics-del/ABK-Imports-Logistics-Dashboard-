"""Generic REST API ingestion connector. Assumes the upstream API returns a
JSON array of shipment records (or {"results": [...]} / {"data": [...]}).
Auth token is sent via a configurable header (default: Authorization)."""
import requests

from .mapping_utils import map_row, upsert_shipment_row

TIMEOUT_SECONDS = 30


def _extract_records(payload):
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        for key in ("results", "data", "records", "shipments"):
            if key in payload and isinstance(payload[key], list):
                return payload[key]
    return []


def test_connection(endpoint_url: str, auth_token: str = "", auth_header: str = "Authorization"):
    """Used by the 'Test Connection' button in the Data Management panel."""
    headers = {}
    if auth_token:
        value = auth_token if auth_token.lower().startswith("bearer ") else f"Bearer {auth_token}"
        headers[auth_header] = value
    try:
        resp = requests.get(endpoint_url, headers=headers, timeout=TIMEOUT_SECONDS)
        resp.raise_for_status()
        records = _extract_records(resp.json())
        return {
            "success": True,
            "status_code": resp.status_code,
            "sample_record": records[0] if records else None,
            "record_count_detected": len(records),
        }
    except requests.exceptions.RequestException as exc:
        return {"success": False, "error": str(exc)}
    except ValueError:
        return {"success": False, "error": "Response was not valid JSON."}


def sync_from_api(config):
    """config: a DataSourceConfig instance (source_type == 'api')."""
    headers = {}
    if config.api_auth_token:
        value = config.api_auth_token
        if config.api_auth_header.lower() == "authorization" and not value.lower().startswith("bearer "):
            value = f"Bearer {value}"
        headers[config.api_auth_header] = value

    added = updated = unchanged = failed = 0
    errors = []

    try:
        resp = requests.get(config.api_endpoint_url, headers=headers, timeout=TIMEOUT_SECONDS)
        resp.raise_for_status()
        records = _extract_records(resp.json())
    except (requests.exceptions.RequestException, ValueError) as exc:
        return {
            "status": "failed", "rows_added": 0, "rows_updated": 0, "rows_failed": 0,
            "error_message": f"API fetch failed: {exc}",
        }

    for i, raw_row in enumerate(records):
        mapped = map_row(raw_row, config.field_mapping)
        result, error, invoice_number = upsert_shipment_row(mapped, data_source="api")
        if result == "added":
            added += 1
        elif result == "updated":
            updated += 1
        elif result == "unchanged":
            unchanged += 1
        else:
            failed += 1
            errors.append({"index": i, "invoice_number": invoice_number, "error": error})

    status = "success" if failed == 0 else ("partial" if (added or updated) else "failed")
    return {
        "status": status,
        "rows_added": added,
        "rows_updated": updated,
        "rows_failed": failed,
        "error_message": "; ".join(f"row {e['index']}: {e['error']}" for e in errors[:10]),
    }
