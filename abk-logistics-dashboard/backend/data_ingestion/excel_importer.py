"""Excel / CSV ingestion: preview + confirmed import, both reusing the
shared mapping/upsert logic in mapping_utils.py."""
import csv
import io

import openpyxl

from .mapping_utils import map_row, upsert_shipment_row

INTERNAL_FIELDS = [
    "invoice_number", "month", "ship_date", "edd_date", "delivery_date",
    "shipment_status", "vendor", "city", "state", "customer_mobile",
    "mode_of_payment", "remarks", "compliance",
]

REQUIRED_INTERNAL_FIELDS = ["invoice_number", "ship_date", "edd_date", "shipment_status", "state"]


def _read_rows(file_obj, filename: str):
    """Returns (headers: list[str], rows: list[dict]) for an uploaded
    .xlsx or .csv file-like object."""
    if filename.lower().endswith(".csv"):
        text = io.TextIOWrapper(file_obj, encoding="utf-8-sig")
        reader = csv.DictReader(text)
        headers = reader.fieldnames or []
        rows = list(reader)
        return headers, rows

    wb = openpyxl.load_workbook(file_obj, data_only=True, read_only=True)
    ws = wb.active
    rows_iter = ws.iter_rows(values_only=True)
    headers = [str(h).strip() if h is not None else "" for h in next(rows_iter)]
    rows = []
    for raw in rows_iter:
        if all(v is None for v in raw):
            continue
        rows.append({headers[i]: raw[i] for i in range(len(headers)) if i < len(raw)})
    return headers, rows


def suggest_mapping(headers):
    """Best-effort auto-mapping from common header spellings to internal
    field names, used to pre-fill the column-mapping UI."""
    lookup = {
        "invoice number": "invoice_number", "invoice no": "invoice_number", "invoice": "invoice_number",
        "month": "month",
        "ship date": "ship_date", "shipment date": "ship_date", "dispatch date": "ship_date",
        "edd date": "edd_date", "edd": "edd_date", "expected delivery date": "edd_date",
        "delivery date": "delivery_date",
        "shipment status": "shipment_status", "status": "shipment_status",
        "vendor": "vendor", "courier": "vendor", "carrier": "vendor",
        "city": "city", "state": "state",
        "customer mobile number": "customer_mobile", "customer mobile": "customer_mobile", "mobile": "customer_mobile",
        "mode of payment": "mode_of_payment", "payment mode": "mode_of_payment",
        "remarks": "remarks", "compliance category": "compliance", "compliance": "compliance",
    }
    mapping = {}
    for h in headers:
        key = h.strip().lower()
        if key in lookup:
            mapping[h] = lookup[key]
    return mapping


def preview_file(file_obj, filename: str, num_rows: int = 10):
    headers, rows = _read_rows(file_obj, filename)
    suggested = suggest_mapping(headers)
    missing_required = [f for f in REQUIRED_INTERNAL_FIELDS if f not in suggested.values()]
    return {
        "headers": headers,
        "preview_rows": rows[:num_rows],
        "total_rows": len(rows),
        "suggested_mapping": suggested,
        "internal_fields": INTERNAL_FIELDS,
        "missing_required_fields": missing_required,
    }


def import_file(file_obj, filename: str, field_mapping: dict):
    """Performs the full import using the confirmed field_mapping
    ({source_header: internal_field}). Returns a summary dict."""
    headers, rows = _read_rows(file_obj, filename)

    added = updated = unchanged = failed = 0
    errors = []

    for i, raw_row in enumerate(rows, start=2):  # row 1 is the header
        mapped = map_row(raw_row, field_mapping)
        result, error, invoice_number = upsert_shipment_row(mapped, data_source="excel")
        if result == "added":
            added += 1
        elif result == "updated":
            updated += 1
        elif result == "unchanged":
            unchanged += 1
        else:
            failed += 1
            errors.append({"row": i, "invoice_number": invoice_number, "error": error})

    return {
        "rows_added": added,
        "rows_updated": updated,
        "rows_unchanged": unchanged,
        "rows_failed": failed,
        "errors": errors[:50],  # cap payload size
        "total_rows": len(rows),
    }
