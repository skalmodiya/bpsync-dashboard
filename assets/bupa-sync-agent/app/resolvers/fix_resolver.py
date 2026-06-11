"""Fix resolver for BUPA synchronization errors."""

import re
import uuid
from typing import Optional

from app.classifiers import ErrorClassifier
from app.models.sync_error import ErrorCategory, FixProposal, SyncError


class FixResolver:
    """Proposes fixes for classified BUPA sync errors.

    Each error category has a dedicated resolution strategy that:
    1. Examines the error context (related BP data, HR data)
    2. Determines the target table and field
    3. Proposes a concrete fix value
    4. Assigns a confidence score based on match quality
    """

    # Confidence levels
    CONFIDENCE_EXACT = 0.9  # Exact pattern match with clear resolution
    CONFIDENCE_PARTIAL = 0.7  # Partial match, likely correct
    CONFIDENCE_LLM = 0.4  # LLM-inferred, needs careful review

    def __init__(self, classifier: Optional[ErrorClassifier] = None):
        """Initialize the resolver.

        Args:
            classifier: Optional ErrorClassifier instance. Creates one if not provided.
        """
        self._classifier = classifier or ErrorClassifier()
        self._strategies = {
            ErrorCategory.MISSING_ADDRESS: self._resolve_missing_address,
            ErrorCategory.DUPLICATE_BP: self._resolve_duplicate_bp,
            ErrorCategory.INVALID_PERNR: self._resolve_invalid_pernr,
            ErrorCategory.BANK_DATA_MISMATCH: self._resolve_bank_mismatch,
            ErrorCategory.IDENTIFICATION_MISSING: self._resolve_identification_missing,
            ErrorCategory.CONFIG_MISMATCH: self._resolve_config_mismatch,
            ErrorCategory.UNKNOWN: self._resolve_unknown,
        }

    async def propose_fix(
        self, error: SyncError, context: Optional[dict] = None
    ) -> FixProposal:
        """Propose a fix for a given sync error.

        Args:
            error: The SyncError to resolve.
            context: Additional context data (BP details, HR data, etc.)

        Returns:
            A FixProposal with the recommended action.
        """
        context = context or {}
        category = self._classifier.classify(error)
        strategy = self._strategies.get(category, self._resolve_unknown)
        return await strategy(error, context)

    async def _resolve_missing_address(
        self, error: SyncError, context: dict
    ) -> FixProposal:
        """Resolve missing address errors.

        Strategy: Look up employee address from HR master (PA0006) and
        propose copying it to BP address table (BUT020/ADRC).
        """
        bp_id = error.related_bp_id or self._extract_bp_id(error.error_message)
        hr_address = context.get("hr_address", {})

        if hr_address:
            # We have HR address data - high confidence
            proposed_value = (
                f"Copy from PA0006: "
                f"{hr_address.get('street', 'N/A')}, "
                f"{hr_address.get('city', 'N/A')} "
                f"{hr_address.get('postal_code', 'N/A')}"
            )
            confidence = self.CONFIDENCE_EXACT
            explanation = (
                f"Business Partner {bp_id or 'unknown'} has no address in BUT020. "
                f"Employee {error.employee_id} has a valid address in PA0006 subtype 1. "
                f"Propose creating BP address record from HR master data."
            )
        else:
            # No HR context - lower confidence
            proposed_value = (
                f"Create address from PA0006 subtype 1 for employee {error.employee_id}"
            )
            confidence = self.CONFIDENCE_PARTIAL
            explanation = (
                f"Business Partner {bp_id or 'unknown'} requires an address. "
                f"Recommend looking up PA0006 for employee {error.employee_id} "
                f"and creating the corresponding BP address."
            )

        return FixProposal(
            error_id=f"ERR-{uuid.uuid4().hex[:8]}",
            proposed_action="Create BP address from HR master data (PA0006)",
            target_table="BUT020",
            target_field="ADDRNUMBER",
            current_value=None,
            proposed_value=proposed_value,
            explanation=explanation,
            confidence_score=confidence,
        )

    async def _resolve_duplicate_bp(
        self, error: SyncError, context: dict
    ) -> FixProposal:
        """Resolve duplicate business partner errors.

        Strategy: Identify the correct BP record and propose marking
        duplicates for deletion or merging.
        """
        duplicate_bps = context.get("duplicate_bps", [])
        primary_bp = context.get("primary_bp", "")

        if primary_bp and duplicate_bps:
            confidence = self.CONFIDENCE_EXACT
            proposed_value = (
                f"Keep {primary_bp}, mark {', '.join(duplicate_bps)} for deletion"
            )
            explanation = (
                f"Multiple BP records found for employee {error.employee_id}. "
                f"BP {primary_bp} is identified as the primary record based on "
                f"creation date and data completeness. Duplicate records "
                f"{', '.join(duplicate_bps)} should be marked for deletion via BUPA_CENTRAL."
            )
        elif duplicate_bps:
            confidence = self.CONFIDENCE_PARTIAL
            proposed_value = f"Review duplicates: {', '.join(duplicate_bps)}"
            explanation = (
                f"Multiple BP records found for employee {error.employee_id}. "
                f"Cannot determine primary record automatically. "
                f"Manual review required to identify which record to keep."
            )
        else:
            confidence = self.CONFIDENCE_LLM
            proposed_value = "Run duplicate check via transaction BP_DUPL"
            explanation = (
                f"Duplicate BP indicated for employee {error.employee_id}. "
                f"Run duplicate check in BP_DUPL to identify all related records."
            )

        return FixProposal(
            error_id=f"ERR-{uuid.uuid4().hex[:8]}",
            proposed_action="Resolve duplicate business partner records",
            target_table="BUT000",
            target_field="PARTNER",
            current_value=str(duplicate_bps) if duplicate_bps else None,
            proposed_value=proposed_value,
            explanation=explanation,
            confidence_score=confidence,
        )

    async def _resolve_invalid_pernr(
        self, error: SyncError, context: dict
    ) -> FixProposal:
        """Resolve invalid personnel number errors.

        Strategy: Verify PERNR format and existence in PA0000,
        propose correction or re-assignment.
        """
        hr_record = context.get("hr_record", {})
        pernr = error.employee_id

        # Check if the PERNR format is wrong (should be 8 digits, zero-padded)
        if pernr and not re.match(r"^\d{8}$", pernr):
            corrected = pernr.zfill(8) if pernr.isdigit() else pernr
            confidence = (
                self.CONFIDENCE_EXACT if pernr.isdigit() else self.CONFIDENCE_PARTIAL
            )
            proposed_value = corrected
            explanation = (
                f"Personnel number '{pernr}' has incorrect format. "
                f"SAP requires 8-digit zero-padded PERNR. "
                f"Proposed correction: '{corrected}'."
            )
        elif hr_record:
            confidence = self.CONFIDENCE_PARTIAL
            proposed_value = hr_record.get("correct_pernr", pernr)
            explanation = (
                f"Personnel number '{pernr}' not found in current HR master. "
                f"HR system indicates correct number is '{proposed_value}'."
            )
        else:
            confidence = self.CONFIDENCE_LLM
            proposed_value = f"Verify PERNR {pernr} in PA0000/PA0001"
            explanation = (
                f"Personnel number '{pernr}' could not be validated. "
                f"Check PA0000 for active employment record and PA0001 "
                f"for organizational assignment."
            )

        return FixProposal(
            error_id=f"ERR-{uuid.uuid4().hex[:8]}",
            proposed_action="Correct personnel number reference",
            target_table="BUT000",
            target_field="XBLNR",
            current_value=pernr,
            proposed_value=proposed_value,
            explanation=explanation,
            confidence_score=confidence,
        )

    async def _resolve_bank_mismatch(
        self, error: SyncError, context: dict
    ) -> FixProposal:
        """Resolve bank data mismatch errors.

        Strategy: Compare HR bank data (PA0009) with BP bank data (BUT0BK)
        and propose synchronization.
        """
        hr_bank = context.get("hr_bank_data", {})
        bp_bank = context.get("bp_bank_data", {})

        if hr_bank and bp_bank:
            confidence = self.CONFIDENCE_EXACT
            proposed_value = (
                f"Update BP bank: IBAN={hr_bank.get('iban', 'N/A')}, "
                f"BIC={hr_bank.get('bic', 'N/A')}"
            )
            explanation = (
                f"Bank data mismatch between HR (PA0009) and BP (BUT0BK). "
                f"HR shows IBAN {hr_bank.get('iban', 'N/A')}, "
                f"BP shows IBAN {bp_bank.get('iban', 'N/A')}. "
                f"Propose updating BP bank data from HR master (source of truth)."
            )
        elif hr_bank:
            confidence = self.CONFIDENCE_PARTIAL
            proposed_value = f"Sync from PA0009: IBAN={hr_bank.get('iban', 'N/A')}"
            explanation = (
                f"Bank data inconsistency detected. HR master data available "
                f"but BP bank record could not be retrieved. "
                f"Recommend syncing BP bank data from PA0009."
            )
        else:
            confidence = self.CONFIDENCE_LLM
            proposed_value = "Compare PA0009 and BUT0BK manually"
            explanation = (
                f"Bank data mismatch for employee {error.employee_id}. "
                f"Insufficient context to propose automatic fix. "
                f"Manual comparison of PA0009 and BUT0BK required."
            )

        return FixProposal(
            error_id=f"ERR-{uuid.uuid4().hex[:8]}",
            proposed_action="Synchronize bank details from HR to BP",
            target_table="BUT0BK",
            target_field="BANKL",
            current_value=bp_bank.get("iban") if bp_bank else None,
            proposed_value=proposed_value,
            explanation=explanation,
            confidence_score=confidence,
        )

    async def _resolve_identification_missing(
        self, error: SyncError, context: dict
    ) -> FixProposal:
        """Resolve missing identification errors.

        Strategy: Check HR identification records (PA0185) and propose
        creating corresponding BP identification (BUT0ID).
        """
        hr_ids = context.get("hr_identifications", [])

        if hr_ids:
            id_type = hr_ids[0].get("type", "01")
            id_number = hr_ids[0].get("number", "N/A")
            confidence = self.CONFIDENCE_EXACT
            proposed_value = f"Create BUT0ID: type={id_type}, number={id_number}"
            explanation = (
                f"BP identification missing but found in HR master (PA0185). "
                f"ID type {id_type} with number {id_number} exists in HR. "
                f"Propose creating corresponding BUT0ID record."
            )
        else:
            confidence = self.CONFIDENCE_LLM
            proposed_value = "Check PA0185 for identification documents"
            explanation = (
                f"Required identification not maintained for employee {error.employee_id}. "
                f"No HR identification data available in context. "
                f"Check PA0185 for any maintained ID documents."
            )

        return FixProposal(
            error_id=f"ERR-{uuid.uuid4().hex[:8]}",
            proposed_action="Create BP identification from HR master",
            target_table="BUT0ID",
            target_field="IDN_NUMBER",
            current_value=None,
            proposed_value=proposed_value,
            explanation=explanation,
            confidence_score=confidence,
        )

    async def _resolve_config_mismatch(
        self, error: SyncError, context: dict
    ) -> FixProposal:
        """Resolve configuration mismatch errors.

        Strategy: Check BP category/grouping configuration and propose
        correction based on employee type mapping.
        """
        expected_category = context.get("expected_bp_category", "")
        actual_category = context.get("actual_bp_category", "")
        employee_type = context.get("employee_type", "")

        if expected_category and actual_category:
            confidence = self.CONFIDENCE_EXACT
            proposed_value = (
                f"Change BP category from {actual_category} to {expected_category}"
            )
            explanation = (
                f"BP category mismatch: expected '{expected_category}' "
                f"but found '{actual_category}'. "
                f"Based on employee type '{employee_type}', the correct "
                f"BP category mapping is '{expected_category}'. "
                f"Update via CVI configuration."
            )
        else:
            # Extract category info from error message
            match = re.search(r"expected (\w+) but found (\w+)", error.error_message)
            if match:
                confidence = self.CONFIDENCE_PARTIAL
                proposed_value = f"Set BP category to {match.group(1)}"
                explanation = (
                    f"Configuration mismatch detected from error message. "
                    f"Expected value: {match.group(1)}, actual: {match.group(2)}. "
                    f"Verify CVI mapping table (CVIS_BP_CUST) before applying."
                )
            else:
                confidence = self.CONFIDENCE_LLM
                proposed_value = "Review CVI configuration in SPRO"
                explanation = (
                    f"Configuration mismatch for employee {error.employee_id}. "
                    f"Check CVI mapping in SPRO > Cross-Application Components > "
                    f"SAP Business Partner > Business Partner > Integration."
                )

        return FixProposal(
            error_id=f"ERR-{uuid.uuid4().hex[:8]}",
            proposed_action="Correct BP category/grouping configuration",
            target_table="BUT000",
            target_field="BU_GROUP",
            current_value=actual_category or None,
            proposed_value=proposed_value,
            explanation=explanation,
            confidence_score=confidence,
        )

    async def _resolve_unknown(self, error: SyncError, context: dict) -> FixProposal:
        """Handle unknown/unclassified errors.

        Strategy: Provide generic guidance and recommend manual investigation.
        """
        return FixProposal(
            error_id=f"ERR-{uuid.uuid4().hex[:8]}",
            proposed_action="Manual investigation required",
            target_table="UNKNOWN",
            target_field="UNKNOWN",
            current_value=None,
            proposed_value="Investigate error manually in SLG1",
            explanation=(
                f"Error could not be automatically classified. "
                f"Message: '{error.error_message}'. "
                f"Recommend manual investigation in SLG1 and cross-referencing "
                f"with BP transaction (BP) and HR master data (PA*)."
            ),
            confidence_score=self.CONFIDENCE_LLM,
        )

    @staticmethod
    def _extract_bp_id(message: str) -> Optional[str]:
        """Extract a BP ID from an error message using regex.

        Args:
            message: The error message text.

        Returns:
            Extracted BP ID or None.
        """
        # Match 10-digit BP numbers (zero-padded)
        match = re.search(r"\b(\d{10})\b", message)
        if match:
            return match.group(1)
        # Match shorter BP references
        match = re.search(r"BP\s*[:#]?\s*(\d+)", message, re.IGNORECASE)
        if match:
            return match.group(1).zfill(10)
        return None
