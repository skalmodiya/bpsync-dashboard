"""Pydantic models for BUPA sync error analysis."""

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class ErrorCategory(str, Enum):
    """Classification categories for BUPA sync errors."""

    MISSING_ADDRESS = "MISSING_ADDRESS"
    DUPLICATE_BP = "DUPLICATE_BP"
    INVALID_PERNR = "INVALID_PERNR"
    BANK_DATA_MISMATCH = "BANK_DATA_MISMATCH"
    IDENTIFICATION_MISSING = "IDENTIFICATION_MISSING"
    CONFIG_MISMATCH = "CONFIG_MISMATCH"
    UNKNOWN = "UNKNOWN"


class SyncError(BaseModel):
    """Represents a single BUPA synchronization error from SLG1."""

    employee_id: str = Field(
        description="Personnel number (PERNR) of the affected employee"
    )
    error_class: str = Field(
        default="", description="SAP error class (e.g., CL_BP_SYNC, CVI_ERROR)"
    )
    error_message: str = Field(description="The full error message text from SLG1")
    error_source: str = Field(
        default="SLG1", description="Source system/log where the error was captured"
    )
    timestamp: Optional[datetime] = Field(
        default=None, description="When the error occurred"
    )
    related_bp_id: Optional[str] = Field(
        default=None, description="Business Partner ID related to this error, if known"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "employee_id": "00012345",
                "error_class": "CL_BP_SYNC",
                "error_message": "No address maintained for business partner 0000001234",
                "error_source": "SLG1",
                "timestamp": "2024-03-15T10:30:00",
                "related_bp_id": "0000001234",
            }
        }


class FixProposal(BaseModel):
    """A proposed fix for a BUPA sync error."""

    error_id: str = Field(
        description="Unique identifier linking back to the original error"
    )
    proposed_action: str = Field(
        description="Human-readable description of the proposed fix action"
    )
    target_table: str = Field(
        description="SAP table where the fix would be applied (e.g., BUT020, BUT000)"
    )
    target_field: str = Field(
        description="Specific field to be updated (e.g., ADDRNUMBER, NAME_ORG1)"
    )
    current_value: Optional[str] = Field(
        default=None,
        description="Current value of the field (may be empty/null for missing data)",
    )
    proposed_value: str = Field(description="The value proposed to resolve the error")
    explanation: str = Field(
        description="Detailed explanation of why this fix is recommended"
    )
    confidence_score: float = Field(
        ge=0.0,
        le=1.0,
        description=(
            "Confidence in the proposed fix: "
            "0.9 = exact pattern match, 0.7 = partial match, 0.4 = LLM-inferred"
        ),
    )

    class Config:
        json_schema_extra = {
            "example": {
                "error_id": "ERR-2024-001",
                "proposed_action": "Create default address from HR master data (PA0006)",
                "target_table": "BUT020",
                "target_field": "ADDRNUMBER",
                "current_value": None,
                "proposed_value": "Copy from PA0006 subtype 1",
                "explanation": (
                    "BP 0000001234 has no address record in BUT020. "
                    "Employee 00012345 has a valid permanent address in PA0006 subtype 1. "
                    "Propose copying this address to create the BP address record."
                ),
                "confidence_score": 0.9,
            }
        }


class ApprovalDecision(BaseModel):
    """A consultant's decision on a proposed fix."""

    proposal_id: str = Field(description="ID of the FixProposal being decided on")
    decision: str = Field(description="Decision: 'approved', 'rejected', or 'modified'")
    reviewer: str = Field(
        description="Name or ID of the consultant who made the decision"
    )
    reason: Optional[str] = Field(
        default=None,
        description="Reason for the decision, especially if rejected or modified",
    )
    timestamp: datetime = Field(
        default_factory=datetime.now, description="When the decision was made"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "proposal_id": "FIX-2024-001",
                "decision": "approved",
                "reviewer": "CONSULTANT01",
                "reason": "Address data verified in HR master",
                "timestamp": "2024-03-15T14:00:00",
            }
        }


class ReconciliationRecord(BaseModel):
    """Tracks the full lifecycle of an employee-BP reconciliation."""

    employee_id: str = Field(description="Personnel number (PERNR)")
    bp_id: Optional[str] = Field(
        default=None, description="Associated Business Partner ID"
    )
    vendor_id: Optional[str] = Field(
        default=None, description="Associated Vendor ID (if applicable)"
    )
    sync_status: str = Field(
        default="pending",
        description="Current status: pending, in_review, resolved, failed",
    )
    error_history: list[str] = Field(
        default_factory=list,
        description="List of error IDs associated with this record",
    )
    fix_history: list[str] = Field(
        default_factory=list, description="List of applied fix proposal IDs"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "employee_id": "00012345",
                "bp_id": "0000001234",
                "vendor_id": "0000005678",
                "sync_status": "in_review",
                "error_history": ["ERR-2024-001", "ERR-2024-002"],
                "fix_history": ["FIX-2024-001"],
            }
        }
