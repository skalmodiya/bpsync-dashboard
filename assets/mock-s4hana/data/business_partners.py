"""
Business Partner data for mock S/4HANA server.
45 BP records - some employees don't have BPs (unsynced),
some have duplicate BPs to simulate errors.
"""

import random
from .employees import (
    EMPLOYEE_NAMES,
    MISSING_ADDRESS_PERNRS,
    DUPLICATE_BP_PERNRS,
    INVALID_PERNR_SET,
    BANK_MISMATCH_PERNRS,
    ID_MISSING_PERNRS,
    PA0006,
    PA0009,
    PA0185,
)


def _generate_bp_id(index: int) -> str:
    """Generate BP ID like 0000001001."""
    return f"{1001 + index:010d}"


def _pernr_to_index(pernr: str) -> int:
    """Convert PERNR to employee index."""
    return int(pernr) - 1001


def generate_business_partners() -> list[dict]:
    """
    Generate 45 BP records.
    - Employees 00001001-00001050 exist.
    - Some employees have NO BP (unsynced): those in INVALID_PERNR_SET
    - Some employees have DUPLICATE BPs: those in DUPLICATE_BP_PERNRS
    - Total: ~45 BPs covering ~42 unique employees + 4 duplicates - 3 missing = ~43 base + 4 dup - 2 offset ≈ 45
    """
    random.seed(50)
    records = []
    bp_counter = 0

    # Employees that won't have a BP at all (to simulate unsynced)
    no_bp_pernrs = INVALID_PERNR_SET  # 00001010, 00001025, 00001040

    for i in range(50):
        pernr = f"{1001 + i:08d}"

        # Skip employees that should not have a BP
        if pernr in no_bp_pernrs:
            continue

        emp_index = i
        first_name = EMPLOYEE_NAMES[emp_index][0]
        last_name = EMPLOYEE_NAMES[emp_index][1]

        # Determine address from PA0006 if available
        pa0006_record = next((r for r in PA0006 if r["PERNR"] == pernr), None)
        address = {}
        if pa0006_record:
            address = {
                "STREET": pa0006_record["STRAS"],
                "CITY": pa0006_record["ORT01"],
                "POSTAL_CODE": pa0006_record["PSTLZ"],
                "COUNTRY": pa0006_record["LAND1"],
                "REGION": pa0006_record["STATE"],
            }
        else:
            # BP exists but address section is empty (for MISSING_ADDRESS cases)
            address = {
                "STREET": "",
                "CITY": "",
                "POSTAL_CODE": "",
                "COUNTRY": "",
                "REGION": "",
            }

        # Bank details from PA0009
        pa0009_record = next((r for r in PA0009 if r["PERNR"] == pernr), None)
        bank = {}
        if pa0009_record:
            if pernr in BANK_MISMATCH_PERNRS:
                # BP has DIFFERENT bank data than PA0009 - this causes mismatch
                bank = {
                    "BANK_KEY": "50010517",  # Different from PA0009
                    "BANK_ACCOUNT": "9999999999",
                    "IBAN": "DE89370400440532013000",  # Different IBAN
                    "SWIFT": "COBADEFFXXX",
                }
            else:
                bank = {
                    "BANK_KEY": pa0009_record["BANKL"],
                    "BANK_ACCOUNT": pa0009_record["BANKN"],
                    "IBAN": pa0009_record["IBAN"],
                    "SWIFT": pa0009_record["SWIFT"],
                }

        # Identification from PA0185
        pa0185_record = next((r for r in PA0185 if r["PERNR"] == pernr), None)
        identification = {}
        if pa0185_record:
            identification = {
                "ID_TYPE": pa0185_record["ICTYP"],
                "ID_NUMBER": pa0185_record["ICNUM"],
                "ISSUE_DATE": pa0185_record["ISSDA"],
                "EXPIRY_DATE": pa0185_record["EXPDA"],
            }

        bp_id = _generate_bp_id(bp_counter)
        bp_counter += 1

        # Determine BP category and grouping
        bp_category = "1"  # Person
        bp_grouping = "HRCM"  # HR-CVI managed

        # For CONFIG_MISMATCH employees (reuse some from duplicate set)
        # 00001042 and 00001028 will also have config issues
        if pernr in {"00001042", "00001028"}:
            bp_category = "2"  # Organization - wrong for a person!
            bp_grouping = "BPOR"  # Wrong grouping

        records.append(
            {
                "BP_ID": bp_id,
                "BP_CATEGORY": bp_category,
                "BP_GROUPING": bp_grouping,
                "PERNR": pernr,
                "FIRST_NAME": first_name,
                "LAST_NAME": last_name,
                "FULL_NAME": f"{first_name} {last_name}",
                "DATE_OF_BIRTH": f"{random.randint(1960, 1995)}{random.randint(1, 12):02d}{random.randint(1, 28):02d}",
                "GENDER": random.choice(["M", "F"]),
                "ADDRESS": address,
                "BANK": bank,
                "IDENTIFICATION": identification,
                "CREATED_ON": f"2020{random.randint(1, 12):02d}{random.randint(1, 28):02d}",
                "CHANGED_ON": f"2024{random.randint(1, 12):02d}{random.randint(1, 28):02d}",
                "STATUS": "active",
            }
        )

        # Create DUPLICATE BPs for designated employees
        if pernr in DUPLICATE_BP_PERNRS:
            dup_bp_id = _generate_bp_id(bp_counter)
            bp_counter += 1
            # Duplicate has slightly different name (typo/variant)
            dup_first = first_name[:-1] if len(first_name) > 3 else first_name + "a"
            records.append(
                {
                    "BP_ID": dup_bp_id,
                    "BP_CATEGORY": "1",
                    "BP_GROUPING": "HRCM",
                    "PERNR": pernr,  # Same PERNR - this is the duplicate!
                    "FIRST_NAME": dup_first,
                    "LAST_NAME": last_name,
                    "FULL_NAME": f"{dup_first} {last_name}",
                    "DATE_OF_BIRTH": records[-1]["DATE_OF_BIRTH"],  # Same DOB
                    "GENDER": records[-1]["GENDER"],
                    "ADDRESS": address,
                    "BANK": bank,
                    "IDENTIFICATION": identification,
                    "CREATED_ON": f"2021{random.randint(1, 12):02d}{random.randint(1, 28):02d}",
                    "CHANGED_ON": f"2024{random.randint(1, 12):02d}{random.randint(1, 28):02d}",
                    "STATUS": "active",
                }
            )

    return records


BUSINESS_PARTNERS = generate_business_partners()

# Index by BP_ID for quick lookup
BP_BY_ID = {bp["BP_ID"]: bp for bp in BUSINESS_PARTNERS}

# Index by PERNR (may have multiple entries for duplicates)
BP_BY_PERNR: dict[str, list[dict]] = {}
for bp in BUSINESS_PARTNERS:
    pernr = bp["PERNR"]
    if pernr not in BP_BY_PERNR:
        BP_BY_PERNR[pernr] = []
    BP_BY_PERNR[pernr].append(bp)
