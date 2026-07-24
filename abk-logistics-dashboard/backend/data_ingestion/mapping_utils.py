"""Shared row-mapping / upsert logic used by all three ingestion sources
(REST API, Excel upload, Google Sheets) so every path dedupes by
invoice_number and validates the same way."""
from datetime import datetime, date

from shipments.models import Shipment

REQUIRED_FIELDS = ["invoice_number", "ship_date", "edd_date", "shipment_status", "state"]

VALID_STATUSES = {c[0] for c in Shipment.Status.choices}
VALID_PAYMENT_MODES = {c[0] for c in Shipment.PaymentMode.choices}

DATE_FORMATS = ["%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%m/%d/%Y", "%d %b %Y", "%d-%b-%Y"]


def parse_date(value):
    if value in (None, "", "NaT"):
        return None
    if isinstance(value, date):
        return value
    if isinstance(value, datetime):
        return value.date()
    value = str(value).strip()
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(value, fmt).date()
        except ValueError:
            continue
    raise ValueError(f"Unrecognised date format: {value!r}")


def normalise_status(value):
    if not value:
        return None
    v = str(value).strip().upper().replace(" ", "_")
    aliases = {
        "INTRANSIT": "INTRANSIT", "IN_TRANSIT": "INTRANSIT", "IN-TRANSIT": "INTRANSIT",
        "OUT_FOR_DELIVERY": "OFD", "OFD": "OFD",
        "RETURN_TO_SENDER": "RTS", "RTS": "RTS",
        "NON_DELIVERY_REPORT": "NDR", "NDR": "NDR",
        "EXCEPTION": "EXCEPTION", "DELIVERED": "DELIVERED", "HIT": "HIT", "MISS": "MISS",
    }
    return aliases.get(v, v if v in VALID_STATUSES else None)


def normalise_payment_mode(value):
    if not value:
        return Shipment.PaymentMode.PREPAID
    v = str(value).strip().upper()
    if v in VALID_PAYMENT_MODES:
        return v
    if "COD" in v:
        return Shipment.PaymentMode.COD
    if "CASH" in v:
        return Shipment.PaymentMode.CASH
    return Shipment.PaymentMode.PREPAID


def map_row(raw_row: dict, field_mapping: dict) -> dict:
    """Applies field_mapping ({external_field: internal_field}) to a raw
    source row and returns a dict keyed by internal Shipment field names."""
    mapped = {}
    for external_field, internal_field in field_mapping.items():
        if external_field in raw_row:
            mapped[internal_field] = raw_row[external_field]
    return mapped


def upsert_shipment_row(mapped_row: dict, data_source: str):
    """
    mapped_row: dict already keyed by internal Shipment field names.
    Returns: ("added" | "updated" | "failed", error_message_or_None, invoice_number_or_None)
    """
    invoice_number = str(mapped_row.get("invoice_number", "")).strip()
    if not invoice_number:
        return "failed", "Missing invoice_number", None

    missing = [f for f in REQUIRED_FIELDS if not mapped_row.get(f)]
    if missing:
        return "failed", f"Missing required field(s): {', '.join(missing)}", invoice_number

    try:
        ship_date = parse_date(mapped_row.get("ship_date"))
        edd_date = parse_date(mapped_row.get("edd_date"))
        delivery_date = parse_date(mapped_row.get("delivery_date"))
    except ValueError as exc:
        return "failed", str(exc), invoice_number

    status = normalise_status(mapped_row.get("shipment_status"))
    if not status:
        return "failed", f"Unrecognised shipment_status: {mapped_row.get('shipment_status')!r}", invoice_number

    defaults = {
        "month": mapped_row.get("month") or (ship_date.strftime("%B %Y") if ship_date else ""),
        "ship_date": ship_date,
        "edd_date": edd_date,
        "delivery_date": delivery_date,
        "shipment_status": status,
        "vendor": (mapped_row.get("vendor") or "").strip(),
        "city": (mapped_row.get("city") or "").strip(),
        "state": (mapped_row.get("state") or "").strip(),
        "customer_mobile": str(mapped_row.get("customer_mobile") or "").strip(),
        "mode_of_payment": normalise_payment_mode(mapped_row.get("mode_of_payment")),
        "data_source": data_source,
    }
    # Remarks/compliance should not be clobbered by re-syncs if already set
    # manually — only set them on first creation.
    obj, created = Shipment.objects.get_or_create(
        invoice_number=invoice_number,
        defaults={**defaults, "remarks": mapped_row.get("remarks", ""), "compliance": mapped_row.get("compliance", "")},
    )
    if created:
        return "added", None, invoice_number

    changed = False
    for field, value in defaults.items():
        if getattr(obj, field) != value:
            setattr(obj, field, value)
            changed = True
    if changed:
        obj.save()
        return "updated", None, invoice_number
    return "unchanged", None, invoice_number
