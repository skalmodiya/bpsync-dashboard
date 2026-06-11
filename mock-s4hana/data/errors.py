"""
Pre-built sync error log with realistic SLG1 message texts.
Consistent with actual data issues in employees.py and business_partners.py.
"""

from datetime import datetime, timedelta
import random

from .employees import (
    MISSING_ADDRESS_PERNRS,
    DUPLICATE_BP_PERNRS,
    INVALID_PERNR_SET,
    BANK_MISMATCH_PERNRS,
    ID_MISSING_PERNRS,
    EMPLOYEE_NAMES,
)
from .business_partners import BP_BY_PERNR, BUSINESS_PARTNERS


def _pernr_to_name(pernr: str) -> str:
    """Get employee name from PERNR."""
    idx = int(pernr) - 1001
    if 0 <= idx < len(EMPLOYEE_NAMES):
        return f"{EMPLOYEE_NAMES[idx][0]} {EMPLOYEE_NAMES[idx][1]}"
    return "Unknown"


def _get_bp_ids_for_pernr(pernr: str) -> list[str]:
    """Get BP IDs for a PERNR."""
    return [bp["BP_ID"] for bp in BP_BY_PERNR.get(pernr, [])]


random.seed(100)
_base_time = datetime(2024, 11, 15, 8, 30, 0)


def _time_offset(index: int) -> tuple[str, str]:
    """Generate timestamp for log entry."""
    t = _base_time + timedelta(minutes=index * 2, seconds=random.randint(0, 59))
    return t.strftime("%Y%m%d"), t.strftime("%H%M%S")


# Build the sync error log
SYNC_ERRORS: list[dict] = []
SLG1_LOG: list[dict] = []

_error_index = 0


def _add_error(pernr: str, error_type: str, message: str, msg_type: str = "E"):
    global _error_index
    datum, uzeit = _time_offset(_error_index)
    bp_ids = _get_bp_ids_for_pernr(pernr)

    SYNC_ERRORS.append(
        {
            "ERROR_ID": f"ERR{_error_index + 1:04d}",
            "PERNR": pernr,
            "EMPLOYEE_NAME": _pernr_to_name(pernr),
            "ERROR_TYPE": error_type,
            "BP_ID": bp_ids[0] if bp_ids else "",
            "MESSAGE": message,
            "SEVERITY": msg_type,
            "TIMESTAMP": f"{datum}{uzeit}",
            "STATUS": "open",
            "RETRY_COUNT": 0,
        }
    )

    SLG1_LOG.append(
        {
            "LOGNUMBER": f"BP_SYNC_2024111500{_error_index + 1:03d}",
            "PERNR": pernr,
            "MSGNO": f"{400 + _error_index:03d}",
            "MSGTX": message,
            "MSGTY": msg_type,
            "MSGID": "/SHCM/BP_SYNC",
            "DATUM": datum,
            "UZEIT": uzeit,
            "PROBCLASS": "1" if msg_type == "E" else "3",
        }
    )

    _error_index += 1


# --- MISSING_ADDRESS errors (5) ---
for pernr in sorted(MISSING_ADDRESS_PERNRS):
    bp_ids = _get_bp_ids_for_pernr(pernr)
    bp_display = bp_ids[0] if bp_ids else "N/A"
    _add_error(
        pernr,
        "MISSING_ADDRESS",
        f"No address maintained for business partner {bp_display} (employee {pernr}, {_pernr_to_name(pernr)}). "
        f"PA0006 record not found. Address is mandatory for BP category 1.",
    )

# --- DUPLICATE_BP errors (4) ---
for pernr in sorted(DUPLICATE_BP_PERNRS):
    bp_ids = _get_bp_ids_for_pernr(pernr)
    if len(bp_ids) >= 2:
        _add_error(
            pernr,
            "DUPLICATE_BP",
            f"Duplicate business partner found: BP {bp_ids[0]} and BP {bp_ids[1]} "
            f"for employee {pernr} ({_pernr_to_name(pernr)}). "
            f"Same date of birth and similar name detected. Manual resolution required.",
        )
    else:
        _add_error(
            pernr,
            "DUPLICATE_BP",
            f"Potential duplicate business partner detected for employee {pernr} "
            f"({_pernr_to_name(pernr)}). Multiple CVI assignments found.",
        )

# --- INVALID_PERNR errors (3) ---
for pernr in sorted(INVALID_PERNR_SET):
    _add_error(
        pernr,
        "INVALID_PERNR",
        f"Personnel number {pernr} not found in HR master data or CVI mapping table "
        f"(/SHCM/T_BPLINK). Employee-to-BP assignment cannot be established. "
        f"Check transaction PBPM for mapping configuration.",
    )

# --- BANK_DATA_MISMATCH errors (3) ---
for pernr in sorted(BANK_MISMATCH_PERNRS):
    bp_ids = _get_bp_ids_for_pernr(pernr)
    bp_display = bp_ids[0] if bp_ids else "N/A"
    _add_error(
        pernr,
        "BANK_DATA_MISMATCH",
        f"Bank key 61020 invalid for country DE in bank details for BP {bp_display} "
        f"(employee {pernr}). PA0009 bank key does not match BUT0BK entry. "
        f"Expected format: 8-digit German bank code (BLZ). Found: 5 digits.",
    )

# --- IDENTIFICATION_MISSING errors (2) ---
for pernr in sorted(ID_MISSING_PERNRS):
    bp_ids = _get_bp_ids_for_pernr(pernr)
    bp_display = bp_ids[0] if bp_ids else "N/A"
    _add_error(
        pernr,
        "IDENTIFICATION_MISSING",
        f"Identification document required for BP category 2 (Organization) "
        f"but no PA0185 record found for employee {pernr} ({_pernr_to_name(pernr)}). "
        f"BP {bp_display} requires at least one identification type.",
    )

# --- CONFIG_MISMATCH errors (2) ---
config_mismatch_pernrs = ["00001028", "00001042"]
for pernr in config_mismatch_pernrs:
    bp_ids = _get_bp_ids_for_pernr(pernr)
    bp_display = bp_ids[0] if bp_ids else "N/A"
    _add_error(
        pernr,
        "CONFIG_MISMATCH",
        f"BP category 1 does not match CVI configuration for grouping HRCM. "
        f"BP {bp_display} (employee {pernr}) has category '2' (Organization) "
        f"but employee BP should be category '1' (Person). "
        f"Check customizing in transaction BUCF.",
        "E",
    )

# Add a few warning messages to SLG1 for realism
_warning_pernrs = ["00001002", "00001020", "00001035"]
for pernr in _warning_pernrs:
    datum, uzeit = _time_offset(_error_index)
    SLG1_LOG.append(
        {
            "LOGNUMBER": f"BP_SYNC_2024111500{_error_index + 1:03d}",
            "PERNR": pernr,
            "MSGNO": f"{400 + _error_index:03d}",
            "MSGTX": f"Employee {pernr} ({_pernr_to_name(pernr)}): BP sync completed with warnings. "
            f"Address format normalized from legacy format.",
            "MSGTY": "W",
            "MSGID": "/SHCM/BP_SYNC",
            "DATUM": datum,
            "UZEIT": uzeit,
            "PROBCLASS": "3",
        }
    )
    _error_index += 1

# Add informational messages
_info_pernrs = ["00001001", "00001050"]
for pernr in _info_pernrs:
    datum, uzeit = _time_offset(_error_index)
    SLG1_LOG.append(
        {
            "LOGNUMBER": f"BP_SYNC_2024111500{_error_index + 1:03d}",
            "PERNR": pernr,
            "MSGNO": f"{400 + _error_index:03d}",
            "MSGTX": f"Employee {pernr} ({_pernr_to_name(pernr)}): Successfully synchronized to BP.",
            "MSGTY": "I",
            "MSGID": "/SHCM/BP_SYNC",
            "DATUM": datum,
            "UZEIT": uzeit,
            "PROBCLASS": "4",
        }
    )
    _error_index += 1


# Track which errors have been fixed (for retry simulation)
FIXED_PERNRS: set[str] = set()
