"""Job management API endpoints."""

from typing import Optional

from fastapi import APIRouter, Query

from jobs import get_job, list_jobs

router = APIRouter()


@router.get("")
async def get_jobs(
    limit: int = Query(default=20, le=100),
    status: Optional[str] = Query(default=None),
    job_type: Optional[str] = Query(default=None),
) -> dict:
    """List jobs with optional filters."""
    jobs = list_jobs(limit=limit, status=status, job_type=job_type)
    return {"jobs": jobs, "total": len(jobs)}


@router.get("/{job_id}")
async def get_job_status(job_id: str) -> dict:
    """Get status of a specific job."""
    job = get_job(job_id)
    if not job:
        return {"error": "Job not found"}
    return job
