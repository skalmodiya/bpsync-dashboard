"""
Mock S/4HANA RFC Server
=======================
FastAPI server simulating SAP S/4HANA backend for local BUPA sync development.
Provides PA table access, BUPA sync operations, BP CRUD, and fix application endpoints.

Start with: uvicorn main:app --host 0.0.0.0 --port 8090
"""

import uuid
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel

from data.employees import PA0000, PA0001, PA0006, PA0009, PA0105, PA0185, LFB1
from data.business_partners import BUSINESS_PARTNERS, BP_BY_ID, BP_BY_PERNR
from data.errors import SYNC_ERRORS, SLG1_LOG, FIXED_PERNRS


app = FastAPI(
    title="Mock S/4HANA RFC Server",
    description="Simulates SAP S/4HANA backend for BUPA sync local development",
    version="1.0.0",
)


# ============================================================
# In-memory state for job tracking
# ============================================================


class JobState:
    """Track sync job state for status polling simulation."""

    def __init__(self):
        self.jobs: dict[str, dict] = {}

    def create_job(self, pernr_list: list[str]) -> dict:
        job_id = str(uuid.uuid4())
        self.jobs[job_id] = {
            "job_id": job_id,
            "status": "submitted",
            "pernr_list": pernr_list,
            "poll_count": 0,
            "submitted_at": datetime.now().isoformat(),
            "completed_at": None,
            "synced_count": 0,
            "error_count": 0,
        }
        return self.jobs[job_id]

    def get_job(self, job_id: str) -> Optional[dict]:
        return self.jobs.get(job_id)

    def poll_job(self, job_id: str) -> Optional[dict]:
        job = self.jobs.get(job_id)
        if not job:
            return None
        job["poll_count"] += 1
        # First poll returns "running", subsequent return "completed"
        if job["poll_count"] <= 1:
            job["status"] = "running"
        else:
            job["status"] = "completed"
            job["completed_at"] = datetime.now().isoformat()
            # Calculate results based on fixed errors
            total = len(job["pernr_list"])
            errors = sum(
                1
                for p in job["pernr_list"]
                if p not in FIXED_PERNRS and any(e["PERNR"] == p for e in SYNC_ERRORS)
            )
            job["synced_count"] = total - errors
            job["error_count"] = errors
        return job


job_tracker = JobState()


# ============================================================
# Request/Response Models
# ============================================================


class SyncExecuteRequest(BaseModel):
    pernr_list: list[str]


class SyncExecuteResponse(BaseModel):
    job_id: str
    status: str
    submitted_at: str


class FixApplyRequest(BaseModel):
    pernr: str
    action: str
    target_table: str
    target_field: str
    value: str


class FixApplyResponse(BaseModel):
    success: bool
    message: str
    pernr: str
    action: str


class RetryRequest(BaseModel):
    pernr_list: list[str]


class BPUpdateRequest(BaseModel):
    """Flexible update model for BP fields."""

    FIRST_NAME: Optional[str] = None
    LAST_NAME: Optional[str] = None
    ADDRESS: Optional[dict] = None
    BANK: Optional[dict] = None
    IDENTIFICATION: Optional[dict] = None
    BP_CATEGORY: Optional[str] = None
    BP_GROUPING: Optional[str] = None


# ============================================================
# Health Check
# ============================================================


@app.get("/")
def root():
    return {
        "service": "Mock S/4HANA RFC Server",
        "version": "1.0.0",
        "status": "running",
        "endpoints": {
            "pa_tables": [
                "/api/pa0000",
                "/api/pa0001",
                "/api/pa0006",
                "/api/pa0009",
                "/api/pa0105",
                "/api/pa0185",
            ],
            "vendor": ["/api/lfb1"],
            "bupa_sync": [
                "/api/bupa/sync/execute",
                "/api/bupa/sync/status/{job_id}",
                "/api/bupa/sync/log",
                "/api/bupa/sync/retry",
            ],
            "slg1": ["/api/slg1/log"],
            "business_partners": [
                "/api/business_partners",
                "/api/business_partners/{bp_id}",
            ],
            "fix": ["/api/fix/apply"],
        },
    }


# ============================================================
# PA Table Endpoints
# ============================================================


@app.get("/api/pa0000")
def get_pa0000(
    pernr: Optional[str] = Query(None, description="Filter by PERNR"),
    limit: int = Query(100, description="Max records to return"),
    offset: int = Query(0, description="Offset for pagination"),
):
    """PA0000 - Actions (Personnel Actions). Returns active employee status records."""
    data = PA0000
    if pernr:
        data = [r for r in data if r["PERNR"] == pernr]
    return {"count": len(data), "results": data[offset : offset + limit]}


@app.get("/api/pa0001")
def get_pa0001(
    pernr: Optional[str] = Query(None, description="Filter by PERNR"),
    bukrs: Optional[str] = Query(None, description="Filter by company code"),
    orgeh: Optional[str] = Query(None, description="Filter by org unit"),
    limit: int = Query(100, description="Max records to return"),
    offset: int = Query(0, description="Offset for pagination"),
):
    """PA0001 - Organizational Assignment."""
    data = PA0001
    if pernr:
        data = [r for r in data if r["PERNR"] == pernr]
    if bukrs:
        data = [r for r in data if r["BUKRS"] == bukrs]
    if orgeh:
        data = [r for r in data if r["ORGEH"] == orgeh]
    return {"count": len(data), "results": data[offset : offset + limit]}


@app.get("/api/pa0006")
def get_pa0006(
    pernr: Optional[str] = Query(None, description="Filter by PERNR"),
    land1: Optional[str] = Query(None, description="Filter by country"),
    limit: int = Query(100, description="Max records to return"),
    offset: int = Query(0, description="Offset for pagination"),
):
    """PA0006 - Addresses."""
    data = PA0006
    if pernr:
        data = [r for r in data if r["PERNR"] == pernr]
    if land1:
        data = [r for r in data if r["LAND1"] == land1]
    return {"count": len(data), "results": data[offset : offset + limit]}


@app.get("/api/pa0009")
def get_pa0009(
    pernr: Optional[str] = Query(None, description="Filter by PERNR"),
    limit: int = Query(100, description="Max records to return"),
    offset: int = Query(0, description="Offset for pagination"),
):
    """PA0009 - Bank Details."""
    data = PA0009
    if pernr:
        data = [r for r in data if r["PERNR"] == pernr]
    return {"count": len(data), "results": data[offset : offset + limit]}


@app.get("/api/pa0105")
def get_pa0105(
    pernr: Optional[str] = Query(None, description="Filter by PERNR"),
    limit: int = Query(100, description="Max records to return"),
    offset: int = Query(0, description="Offset for pagination"),
):
    """PA0105 - Communication (Email)."""
    data = PA0105
    if pernr:
        data = [r for r in data if r["PERNR"] == pernr]
    return {"count": len(data), "results": data[offset : offset + limit]}


@app.get("/api/pa0185")
def get_pa0185(
    pernr: Optional[str] = Query(None, description="Filter by PERNR"),
    limit: int = Query(100, description="Max records to return"),
    offset: int = Query(0, description="Offset for pagination"),
):
    """PA0185 - Personal IDs (Identification Documents)."""
    data = PA0185
    if pernr:
        data = [r for r in data if r["PERNR"] == pernr]
    return {"count": len(data), "results": data[offset : offset + limit]}


# ============================================================
# Vendor Data
# ============================================================


@app.get("/api/lfb1")
def get_lfb1(
    pernr: Optional[str] = Query(None, description="Filter by PERNR"),
    lifnr: Optional[str] = Query(None, description="Filter by vendor number"),
    bukrs: Optional[str] = Query(None, description="Filter by company code"),
    limit: int = Query(100, description="Max records to return"),
    offset: int = Query(0, description="Offset for pagination"),
):
    """LFB1 - Vendor master (company code data). Links vendors to employees."""
    data = LFB1
    if pernr:
        data = [r for r in data if r["PERNR"] == pernr]
    if lifnr:
        data = [r for r in data if r["LIFNR"] == lifnr]
    if bukrs:
        data = [r for r in data if r["BUKRS"] == bukrs]
    return {"count": len(data), "results": data[offset : offset + limit]}


# ============================================================
# BUPA Sync Operations
# ============================================================


@app.post("/api/bupa/sync/execute")
def bupa_sync_execute(request: SyncExecuteRequest):
    """
    Execute BUPA sync for given PERNRs.
    Simulates submitting a background job for HR-to-BP synchronization.
    """
    if not request.pernr_list:
        raise HTTPException(status_code=400, detail="pernr_list cannot be empty")

    job = job_tracker.create_job(request.pernr_list)
    return SyncExecuteResponse(
        job_id=job["job_id"],
        status=job["status"],
        submitted_at=job["submitted_at"],
    )


@app.get("/api/bupa/sync/status/{job_id}")
def bupa_sync_status(job_id: str):
    """
    Get sync job status.
    First call returns 'running', subsequent calls return 'completed' with results.
    """
    job = job_tracker.poll_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    response = {
        "job_id": job["job_id"],
        "status": job["status"],
        "submitted_at": job["submitted_at"],
    }

    if job["status"] == "completed":
        response["completed_at"] = job["completed_at"]
        response["synced_count"] = job["synced_count"]
        response["error_count"] = job["error_count"]
        response["total_count"] = len(job["pernr_list"])

    return response


@app.get("/api/bupa/sync/log")
def bupa_sync_log(
    error_type: Optional[str] = Query(None, description="Filter by error type"),
    pernr: Optional[str] = Query(None, description="Filter by PERNR"),
    status: Optional[str] = Query(None, description="Filter by status (open/resolved)"),
    limit: int = Query(100, description="Max records to return"),
    offset: int = Query(0, description="Offset for pagination"),
):
    """
    Get BUPA sync error log (/SHCM/D_BP_SYNC equivalent).
    Returns errors with types: MISSING_ADDRESS, DUPLICATE_BP, INVALID_PERNR,
    BANK_DATA_MISMATCH, IDENTIFICATION_MISSING, CONFIG_MISMATCH.
    """
    data = SYNC_ERRORS.copy()

    # Update status for fixed PERNRs
    for error in data:
        if error["PERNR"] in FIXED_PERNRS:
            error = {**error, "STATUS": "resolved"}

    if error_type:
        data = [r for r in data if r["ERROR_TYPE"] == error_type]
    if pernr:
        data = [r for r in data if r["PERNR"] == pernr]
    if status:
        data = [r for r in data if r.get("STATUS") == status]

    # Summary counts
    type_counts = {}
    for error in SYNC_ERRORS:
        t = error["ERROR_TYPE"]
        type_counts[t] = type_counts.get(t, 0) + 1

    return {
        "count": len(data),
        "summary": {
            "total_errors": len(SYNC_ERRORS),
            "open_errors": sum(
                1 for e in SYNC_ERRORS if e["PERNR"] not in FIXED_PERNRS
            ),
            "resolved_errors": sum(
                1 for e in SYNC_ERRORS if e["PERNR"] in FIXED_PERNRS
            ),
            "by_type": type_counts,
        },
        "results": data[offset : offset + limit],
    }


@app.get("/api/slg1/log")
def get_slg1_log(
    pernr: Optional[str] = Query(None, description="Filter by PERNR"),
    msgty: Optional[str] = Query(None, description="Filter by message type (E/W/I)"),
    limit: int = Query(100, description="Max records to return"),
    offset: int = Query(0, description="Offset for pagination"),
):
    """
    SLG1 Application Log messages.
    Returns detailed log entries with PERNR, message number, text, type, date/time.
    """
    data = SLG1_LOG
    if pernr:
        data = [r for r in data if r["PERNR"] == pernr]
    if msgty:
        data = [r for r in data if r["MSGTY"] == msgty]
    return {"count": len(data), "results": data[offset : offset + limit]}


@app.post("/api/bupa/sync/retry")
def bupa_sync_retry(request: RetryRequest):
    """
    Retry sync for specific PERNRs.
    If fix was previously applied (PERNR in FIXED_PERNRS), the retry succeeds.
    """
    if not request.pernr_list:
        raise HTTPException(status_code=400, detail="pernr_list cannot be empty")

    results = []
    for pernr in request.pernr_list:
        if pernr in FIXED_PERNRS:
            results.append(
                {
                    "pernr": pernr,
                    "status": "success",
                    "message": f"Employee {pernr} successfully synchronized to BP after fix.",
                }
            )
        else:
            # Check if there's still an open error
            has_error = any(e["PERNR"] == pernr for e in SYNC_ERRORS)
            if has_error:
                results.append(
                    {
                        "pernr": pernr,
                        "status": "error",
                        "message": f"Employee {pernr} still has unresolved data issues. Apply fix first.",
                    }
                )
            else:
                results.append(
                    {
                        "pernr": pernr,
                        "status": "success",
                        "message": f"Employee {pernr} synchronized successfully (no prior errors).",
                    }
                )

    success_count = sum(1 for r in results if r["status"] == "success")
    error_count = sum(1 for r in results if r["status"] == "error")

    return {
        "total": len(results),
        "success_count": success_count,
        "error_count": error_count,
        "results": results,
    }


# ============================================================
# Business Partner Endpoints
# ============================================================


@app.get("/api/business_partners")
def list_business_partners(
    filter: Optional[str] = Query(None, description="Filter by name, PERNR, or BP_ID"),
    bp_category: Optional[str] = Query(None, description="Filter by BP category"),
    limit: int = Query(100, description="Max records to return"),
    offset: int = Query(0, description="Offset for pagination"),
):
    """List all Business Partners with optional filtering."""
    data = BUSINESS_PARTNERS

    if filter:
        filter_lower = filter.lower()
        data = [
            bp
            for bp in data
            if filter_lower in bp["FULL_NAME"].lower()
            or filter_lower in bp["PERNR"]
            or filter_lower in bp["BP_ID"]
        ]

    if bp_category:
        data = [bp for bp in data if bp["BP_CATEGORY"] == bp_category]

    # Return simplified list (without nested objects) for listing
    simplified = []
    for bp in data[offset : offset + limit]:
        simplified.append(
            {
                "BP_ID": bp["BP_ID"],
                "BP_CATEGORY": bp["BP_CATEGORY"],
                "BP_GROUPING": bp["BP_GROUPING"],
                "PERNR": bp["PERNR"],
                "FULL_NAME": bp["FULL_NAME"],
                "STATUS": bp["STATUS"],
                "CREATED_ON": bp["CREATED_ON"],
                "CHANGED_ON": bp["CHANGED_ON"],
            }
        )

    return {"count": len(data), "results": simplified}


@app.get("/api/business_partners/{bp_id}")
def get_business_partner(bp_id: str):
    """Get single Business Partner with full details including address, bank, identification."""
    # Normalize bp_id to 10-digit format
    bp_id_normalized = bp_id.zfill(10)

    bp = BP_BY_ID.get(bp_id_normalized)
    if not bp:
        raise HTTPException(
            status_code=404, detail=f"Business Partner {bp_id} not found"
        )

    return bp


@app.patch("/api/business_partners/{bp_id}")
def update_business_partner(bp_id: str, update: BPUpdateRequest):
    """Update Business Partner fields. Simulates applying corrections."""
    bp_id_normalized = bp_id.zfill(10)

    bp = BP_BY_ID.get(bp_id_normalized)
    if not bp:
        raise HTTPException(
            status_code=404, detail=f"Business Partner {bp_id} not found"
        )

    updates_applied = []

    if update.FIRST_NAME is not None:
        bp["FIRST_NAME"] = update.FIRST_NAME
        bp["FULL_NAME"] = f"{update.FIRST_NAME} {bp['LAST_NAME']}"
        updates_applied.append("FIRST_NAME")

    if update.LAST_NAME is not None:
        bp["LAST_NAME"] = update.LAST_NAME
        bp["FULL_NAME"] = f"{bp['FIRST_NAME']} {update.LAST_NAME}"
        updates_applied.append("LAST_NAME")

    if update.ADDRESS is not None:
        bp["ADDRESS"].update(update.ADDRESS)
        updates_applied.append("ADDRESS")

    if update.BANK is not None:
        bp["BANK"].update(update.BANK)
        updates_applied.append("BANK")

    if update.IDENTIFICATION is not None:
        bp["IDENTIFICATION"].update(update.IDENTIFICATION)
        updates_applied.append("IDENTIFICATION")

    if update.BP_CATEGORY is not None:
        bp["BP_CATEGORY"] = update.BP_CATEGORY
        updates_applied.append("BP_CATEGORY")

    if update.BP_GROUPING is not None:
        bp["BP_GROUPING"] = update.BP_GROUPING
        updates_applied.append("BP_GROUPING")

    bp["CHANGED_ON"] = datetime.now().strftime("%Y%m%d")

    return {
        "success": True,
        "bp_id": bp_id_normalized,
        "updates_applied": updates_applied,
        "message": f"Business Partner {bp_id_normalized} updated successfully.",
    }


# ============================================================
# Fix Application
# ============================================================


@app.post("/api/fix/apply")
def apply_fix(request: FixApplyRequest):
    """
    Apply a fix to resolve a sync error.
    Simulates updating PA tables or BP data.
    After a fix is applied, the PERNR is marked as fixed and retries will succeed.
    """
    pernr = request.pernr

    # Validate PERNR exists
    pernr_exists = any(r["PERNR"] == pernr for r in PA0000)
    if not pernr_exists:
        return FixApplyResponse(
            success=False,
            message=f"PERNR {pernr} not found in PA0000. Cannot apply fix.",
            pernr=pernr,
            action=request.action,
        )

    # Simulate applying the fix based on target table
    valid_tables = [
        "PA0006",
        "PA0009",
        "PA0105",
        "PA0185",
        "BUT000",
        "BUT0BK",
        "BUT0ID",
        "BUPA_CONFIG",
    ]
    if request.target_table not in valid_tables:
        return FixApplyResponse(
            success=False,
            message=f"Invalid target table '{request.target_table}'. Valid: {valid_tables}",
            pernr=pernr,
            action=request.action,
        )

    # Apply the fix to in-memory data based on action type
    if request.target_table == "PA0006" and request.action == "create_address":
        # Add address record for employee
        PA0006.append(
            {
                "PERNR": pernr,
                "INFTY": "0006",
                "SUBTY": "1",
                "BEGDA": datetime.now().strftime("%Y%m%d"),
                "ENDDA": "99991231",
                "STRAS": request.value
                if request.target_field == "STRAS"
                else "Fix Applied Street 1",
                "ORT01": "Munich",
                "PSTLZ": "80331",
                "LAND1": "DE",
                "STATE": "BY",
            }
        )

    elif request.target_table == "PA0009" and request.action == "update_bank":
        # Update bank record
        for record in PA0009:
            if record["PERNR"] == pernr:
                if request.target_field in record:
                    record[request.target_field] = request.value
                break

    elif request.target_table == "PA0185" and request.action == "create_id":
        # Add ID document
        PA0185.append(
            {
                "PERNR": pernr,
                "INFTY": "0185",
                "SUBTY": "01",
                "BEGDA": datetime.now().strftime("%Y%m%d"),
                "ENDDA": "99991231",
                "ICTYP": "01",
                "ICNUM": request.value or "FIX0000001",
                "ISSDA": datetime.now().strftime("%Y%m%d"),
                "EXPDA": "20340101",
                "ISSAU": "DE",
            }
        )

    # Mark PERNR as fixed so retry will succeed
    FIXED_PERNRS.add(pernr)

    return FixApplyResponse(
        success=True,
        message=f"Fix applied successfully for {pernr}. Table={request.target_table}, "
        f"Field={request.target_field}, Action={request.action}. "
        f"PERNR marked as resolved - retry sync to complete.",
        pernr=pernr,
        action=request.action,
    )


# ============================================================
# Run with: uvicorn main:app --host 0.0.0.0 --port 8090
# ============================================================

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8090)
