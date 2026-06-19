"""
Realistic employee data for mock S/4HANA server.
50 employees with German/Indian/US names.
Some employees deliberately have issues to trigger sync errors.
"""

from datetime import date, timedelta
import random

# Employees with MISSING_ADDRESS (no PA0006 entry): 00001005, 00001012, 00001023, 00001034, 00001045
MISSING_ADDRESS_PERNRS = {"00001005", "00001012", "00001023", "00001034", "00001045"}

# Employees with BANK_DATA_MISMATCH: 00001008, 00001019, 00001031
BANK_MISMATCH_PERNRS = {"00001008", "00001019", "00001031"}

# Employees with INVALID_PERNR mapping issues: 00001010, 00001025, 00001040
INVALID_PERNR_SET = {"00001010", "00001025", "00001040"}

# Employees with IDENTIFICATION_MISSING: 00001015, 00001038
ID_MISSING_PERNRS = {"00001015", "00001038"}

# Employees with DUPLICATE_BP: 00001003, 00001017, 00001028, 00001042
DUPLICATE_BP_PERNRS = {"00001003", "00001017", "00001028", "00001042"}

# Employees linked to vendors
VENDOR_LINKED_PERNRS = {
    "00001002",
    "00001007",
    "00001011",
    "00001016",
    "00001021",
    "00001026",
    "00001033",
    "00001037",
    "00001044",
    "00001049",
}


EMPLOYEE_NAMES = [
    # German names
    ("Hans", "Müller"),
    ("Klaus", "Schmidt"),
    ("Petra", "Fischer"),
    ("Wolfgang", "Weber"),
    ("Ursula", "Wagner"),
    ("Dieter", "Becker"),
    ("Ingrid", "Hoffmann"),
    ("Helmut", "Schäfer"),
    ("Brigitte", "Koch"),
    ("Manfred", "Bauer"),
    ("Renate", "Richter"),
    ("Gerhard", "Klein"),
    ("Monika", "Wolf"),
    ("Heinrich", "Schröder"),
    ("Erika", "Neumann"),
    ("Friedrich", "Schwarz"),
    ("Heike", "Zimmermann"),
    ("Rüdiger", "Braun"),
    # Indian names
    ("Rajesh", "Kumar"),
    ("Priya", "Sharma"),
    ("Amit", "Patel"),
    ("Sunita", "Singh"),
    ("Vikram", "Gupta"),
    ("Deepa", "Reddy"),
    ("Arun", "Mehta"),
    ("Kavitha", "Nair"),
    ("Suresh", "Joshi"),
    ("Lakshmi", "Iyer"),
    ("Ramesh", "Verma"),
    ("Anitha", "Rao"),
    ("Manoj", "Pillai"),
    ("Divya", "Menon"),
    ("Sanjay", "Desai"),
    ("Pooja", "Chatterjee"),
    # US names
    ("James", "Johnson"),
    ("Sarah", "Williams"),
    ("Michael", "Brown"),
    ("Jennifer", "Davis"),
    ("Robert", "Miller"),
    ("Lisa", "Wilson"),
    ("David", "Moore"),
    ("Karen", "Taylor"),
    ("Thomas", "Anderson"),
    ("Nancy", "Thomas"),
    ("Christopher", "Jackson"),
    ("Patricia", "White"),
    ("Daniel", "Harris"),
    ("Linda", "Martin"),
    ("Steven", "Garcia"),
    ("Margaret", "Robinson"),
]


def _generate_pernr(index: int) -> str:
    """Generate PERNR like 00001001, 00001002, etc."""
    return f"{1001 + index:08d}"


def _generate_date(start_year: int = 2015, end_year: int = 2024) -> str:
    """Generate a random date string in SAP format YYYYMMDD."""
    start = date(start_year, 1, 1)
    end = date(end_year, 12, 31)
    delta = (end - start).days
    random_date = start + timedelta(days=random.randint(0, delta))
    return random_date.strftime("%Y%m%d")


def generate_pa0000() -> list[dict]:
    """PA0000 - Actions/Status infotype. 50 active employees."""
    random.seed(42)
    records = []
    for i in range(50):
        pernr = _generate_pernr(i)
        begda = _generate_date(2015, 2022)
        records.append(
            {
                "PERNR": pernr,
                "INFTY": "0000",
                "SUBTY": "",
                "BEGDA": begda,
                "ENDDA": "99991231",
                "STAT2": "3",  # Active
                "MASSN": random.choice(
                    ["01", "02", "04", "06"]
                ),  # Hire, Change, Reorg, Transfer
                "MASSG": random.choice(["01", "02", "03"]),
                "AESSION_REASON": "",
                "FIRST_NAME": EMPLOYEE_NAMES[i][0],
                "LAST_NAME": EMPLOYEE_NAMES[i][1],
            }
        )
    return records


def generate_pa0001() -> list[dict]:
    """PA0001 - Organizational Assignment. All 50 employees."""
    random.seed(43)
    company_codes = ["1000", "2000", "3000"]
    plants = ["1000", "1100", "2000", "2100", "3000"]
    personnel_areas = ["01", "02", "03"]
    emp_groups = ["1", "2", "3"]  # Active, Retiree, External
    emp_subgroups = ["01", "02", "03", "04"]
    org_units = [
        "50000001",
        "50000002",
        "50000003",
        "50000004",
        "50000005",
        "50000010",
        "50000020",
        "50000030",
    ]
    positions = [
        "50000100",
        "50000101",
        "50000102",
        "50000103",
        "50000104",
        "50000200",
        "50000201",
        "50000300",
    ]
    jobs = [
        "50000001",
        "50000002",
        "50000003",
        "50000004",
        "50000005",
    ]

    records = []
    for i in range(50):
        pernr = _generate_pernr(i)
        records.append(
            {
                "PERNR": pernr,
                "INFTY": "0001",
                "SUBTY": "",
                "BEGDA": "20200101",
                "ENDDA": "99991231",
                "BUKRS": random.choice(company_codes),
                "WERKS": random.choice(plants),
                "BTRTL": random.choice(personnel_areas),
                "PERSG": random.choice(emp_groups),
                "PERSK": random.choice(emp_subgroups),
                "PLANS": random.choice(positions),
                "STELL": random.choice(jobs),
                "ORGEH": random.choice(org_units),
                "KOSTL": f"000{random.randint(1000, 9999)}",
            }
        )
    return records


def generate_pa0006() -> list[dict]:
    """PA0006 - Addresses. Deliberately missing for MISSING_ADDRESS_PERNRS."""
    random.seed(44)

    german_addresses = [
        ("Hauptstraße 15", "München", "80331", "DE", "BY"),
        ("Berliner Allee 42", "Düsseldorf", "40212", "DE", "NW"),
        ("Friedrichstraße 100", "Berlin", "10117", "DE", "BE"),
        ("Königstraße 28", "Stuttgart", "70173", "DE", "BW"),
        ("Zeil 85", "Frankfurt", "60313", "DE", "HE"),
        ("Kaiserstraße 50", "Karlsruhe", "76133", "DE", "BW"),
        ("Marienplatz 1", "München", "80331", "DE", "BY"),
    ]
    indian_addresses = [
        ("MG Road 45", "Bangalore", "560001", "IN", "KA"),
        ("Park Street 12", "Kolkata", "700016", "IN", "WB"),
        ("Connaught Place 78", "New Delhi", "110001", "IN", "DL"),
        ("Hitech City Road 200", "Hyderabad", "500081", "IN", "TS"),
        ("Anna Salai 150", "Chennai", "600002", "IN", "TN"),
    ]
    us_addresses = [
        ("123 Main Street", "New York", "10001", "US", "NY"),
        ("456 Oak Avenue", "San Francisco", "94102", "US", "CA"),
        ("789 Elm Drive", "Chicago", "60601", "US", "IL"),
        ("321 Pine Road", "Boston", "02101", "US", "MA"),
        ("654 Maple Lane", "Austin", "73301", "US", "TX"),
    ]

    all_addresses = german_addresses + indian_addresses + us_addresses

    records = []
    for i in range(50):
        pernr = _generate_pernr(i)
        # Skip employees that should have missing addresses
        if pernr in MISSING_ADDRESS_PERNRS:
            continue

        addr = random.choice(all_addresses)
        records.append(
            {
                "PERNR": pernr,
                "INFTY": "0006",
                "SUBTY": "1",  # Permanent address
                "BEGDA": "20200101",
                "ENDDA": "99991231",
                "STRAS": addr[0],
                "ORT01": addr[1],
                "PSTLZ": addr[2],
                "LAND1": addr[3],
                "STATE": addr[4],
            }
        )
    return records


def generate_pa0009() -> list[dict]:
    """PA0009 - Bank details. Some with deliberate mismatches."""
    random.seed(45)

    german_banks = [
        ("10020030", "DE89370400440532013000"),
        ("37040044", "DE27100777770209299700"),
        ("50010517", "DE12500105170648489890"),
        ("61020000", "DE55610200000034567890"),  # Invalid bank key for mismatch testing
        ("70050000", "DE44700500000012345678"),
    ]
    indian_banks = [
        ("SBIN0001234", ""),
        ("HDFC0000123", ""),
        ("ICIC0000456", ""),
    ]
    us_banks = [
        ("021000021", ""),
        ("011401533", ""),
        ("091000019", ""),
    ]

    records = []
    for i in range(50):
        pernr = _generate_pernr(i)
        # Choose bank based on employee region (rough split)
        if i < 18:
            bank = random.choice(german_banks)
            iban = bank[1]
            bankl = bank[0]
            bankn = f"{random.randint(1000000, 9999999)}"
        elif i < 36:
            bank = random.choice(indian_banks)
            iban = ""
            bankl = bank[0]
            bankn = f"{random.randint(10000000000, 99999999999)}"
        else:
            bank = random.choice(us_banks)
            iban = ""
            bankl = bank[0]
            bankn = f"{random.randint(100000000, 999999999)}"

        # For bank mismatch employees, use the invalid bank key
        if pernr in BANK_MISMATCH_PERNRS:
            bankl = "61020"  # Shortened/invalid format to cause mismatch
            iban = "DE00610200000000000000"  # Invalid IBAN

        records.append(
            {
                "PERNR": pernr,
                "INFTY": "0009",
                "SUBTY": "0",  # Main bank
                "BEGDA": "20200101",
                "ENDDA": "99991231",
                "BANKL": bankl,
                "BANKN": bankn,
                "BKONT": f"{random.randint(0, 9):02d}",
                "IBAN": iban,
                "SWIFT": f"{''.join(random.choices('ABCDEFGHIJKLMNOPQRSTUVWXYZ', k=8))}",
            }
        )
    return records


def generate_pa0105() -> list[dict]:
    """PA0105 - Communication (email addresses)."""
    records = []
    domains = ["company.com", "sapexample.com", "corp.sap.com"]
    for i in range(50):
        pernr = _generate_pernr(i)
        first = (
            EMPLOYEE_NAMES[i][0]
            .lower()
            .replace("ü", "ue")
            .replace("ä", "ae")
            .replace("ö", "oe")
        )
        last = (
            EMPLOYEE_NAMES[i][1]
            .lower()
            .replace("ü", "ue")
            .replace("ä", "ae")
            .replace("ö", "oe")
            .replace("ß", "ss")
        )
        domain = domains[i % len(domains)]
        records.append(
            {
                "PERNR": pernr,
                "INFTY": "0105",
                "SUBTY": "0010",  # Email
                "BEGDA": "20200101",
                "ENDDA": "99991231",
                "USRID_LONG": f"{first}.{last}@{domain}",
            }
        )
    return records


def generate_pa0185() -> list[dict]:
    """PA0185 - ID Documents. Missing for ID_MISSING_PERNRS."""
    random.seed(46)
    records = []
    id_types = [
        ("01", "Passport"),
        ("02", "National ID"),
        ("06", "Tax ID"),
    ]

    for i in range(50):
        pernr = _generate_pernr(i)
        # Skip employees that should have missing IDs
        if pernr in ID_MISSING_PERNRS:
            continue

        id_type = random.choice(id_types)
        issue_date = _generate_date(2018, 2022)
        # Expiry 10 years after issue
        issue_year = int(issue_date[:4])
        expiry_date = f"{issue_year + 10}{issue_date[4:]}"

        records.append(
            {
                "PERNR": pernr,
                "INFTY": "0185",
                "SUBTY": id_type[0],
                "BEGDA": issue_date,
                "ENDDA": "99991231",
                "ICTYP": id_type[0],
                "ICNUM": f"{''.join([str(random.randint(0, 9)) for _ in range(10)])}",
                "ISSDA": issue_date,
                "EXPDA": expiry_date,
                "ISSAU": random.choice(["DE", "IN", "US"]),
            }
        )
    return records


def generate_lfb1() -> list[dict]:
    """LFB1 - Vendor master (company code segment). Links vendors to employees."""
    records = []
    vendor_pernrs = sorted(list(VENDOR_LINKED_PERNRS))
    for idx, pernr in enumerate(vendor_pernrs):
        records.append(
            {
                "LIFNR": f"{2000 + idx:010d}",
                "BUKRS": random.choice(["1000", "2000", "3000"]),
                "PERNR": pernr,
                "AKONT": "160000",
                "ZUAWA": "001",
                "FDGRV": "A1",
                "ZTERM": "0001",
            }
        )
    return records


# Pre-generate all data on import
PA0000 = generate_pa0000()
PA0001 = generate_pa0001()
PA0006 = generate_pa0006()
PA0009 = generate_pa0009()
PA0105 = generate_pa0105()
PA0185 = generate_pa0185()
LFB1 = generate_lfb1()
