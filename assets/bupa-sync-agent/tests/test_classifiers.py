"""Unit tests for the ErrorClassifier."""

import pytest

from app.classifiers import ErrorClassifier
from app.models import ErrorCategory, SyncError


@pytest.fixture
def classifier():
    """Create an ErrorClassifier instance."""
    return ErrorClassifier()


class TestErrorClassifierMissingAddress:
    """Tests for MISSING_ADDRESS classification."""

    def test_no_address_maintained(self, classifier):
        error = SyncError(
            employee_id="00012345",
            error_message="No address maintained for business partner 0000001234",
        )
        assert classifier.classify(error) == ErrorCategory.MISSING_ADDRESS

    def test_address_data_incomplete(self, classifier):
        error = SyncError(
            employee_id="00012345",
            error_message="Address data incomplete for BP 0000005678",
        )
        assert classifier.classify(error) == ErrorCategory.MISSING_ADDRESS

    def test_business_partner_address_required(self, classifier):
        error = SyncError(
            employee_id="00099999",
            error_message="Business partner address required for sync",
        )
        assert classifier.classify(error) == ErrorCategory.MISSING_ADDRESS

    def test_address_missing_variant(self, classifier):
        result = classifier.classify_message("Address record missing for employee")
        assert result == ErrorCategory.MISSING_ADDRESS


class TestErrorClassifierDuplicateBP:
    """Tests for DUPLICATE_BP classification."""

    def test_duplicate_business_partner(self, classifier):
        error = SyncError(
            employee_id="00012345",
            error_message="Duplicate business partner found for employee 00012345",
        )
        assert classifier.classify(error) == ErrorCategory.DUPLICATE_BP

    def test_bp_already_exists(self, classifier):
        error = SyncError(
            employee_id="00054321",
            error_message="BP already exists for employee 00054321",
        )
        assert classifier.classify(error) == ErrorCategory.DUPLICATE_BP

    def test_multiple_bp_records(self, classifier):
        error = SyncError(
            employee_id="00011111",
            error_message="Multiple BP records found during sync for PERNR 00011111",
        )
        assert classifier.classify(error) == ErrorCategory.DUPLICATE_BP


class TestErrorClassifierInvalidPERNR:
    """Tests for INVALID_PERNR classification."""

    def test_personnel_number_not_found(self, classifier):
        error = SyncError(
            employee_id="99999999",
            error_message="Personnel number not found in HR master data: 99999999",
        )
        assert classifier.classify(error) == ErrorCategory.INVALID_PERNR

    def test_invalid_pernr_format(self, classifier):
        error = SyncError(
            employee_id="ABC123",
            error_message="Invalid PERNR format: ABC123",
        )
        assert classifier.classify(error) == ErrorCategory.INVALID_PERNR

    def test_employee_number_mismatch(self, classifier):
        error = SyncError(
            employee_id="00012345",
            error_message="Employee number mismatch between HR and BP: expected 00012345, found 00054321",
        )
        assert classifier.classify(error) == ErrorCategory.INVALID_PERNR


class TestErrorClassifierBankDataMismatch:
    """Tests for BANK_DATA_MISMATCH classification."""

    def test_bank_details_inconsistent(self, classifier):
        error = SyncError(
            employee_id="00012345",
            error_message="Bank details inconsistent between HR and BP record",
        )
        assert classifier.classify(error) == ErrorCategory.BANK_DATA_MISMATCH

    def test_bank_key_invalid(self, classifier):
        error = SyncError(
            employee_id="00012345",
            error_message="Bank key invalid for country DE: BLZXXXXX",
        )
        assert classifier.classify(error) == ErrorCategory.BANK_DATA_MISMATCH

    def test_iban_validation_failed(self, classifier):
        error = SyncError(
            employee_id="00012345",
            error_message="IBAN validation failed for DE89370400440532013000",
        )
        assert classifier.classify(error) == ErrorCategory.BANK_DATA_MISMATCH


class TestErrorClassifierIdentificationMissing:
    """Tests for IDENTIFICATION_MISSING classification."""

    def test_id_document_required(self, classifier):
        error = SyncError(
            employee_id="00012345",
            error_message="ID document required for business partner creation",
        )
        assert classifier.classify(error) == ErrorCategory.IDENTIFICATION_MISSING

    def test_no_identification_maintained(self, classifier):
        error = SyncError(
            employee_id="00012345",
            error_message="No identification maintained for BP 0000001234",
        )
        assert classifier.classify(error) == ErrorCategory.IDENTIFICATION_MISSING

    def test_tax_number_missing(self, classifier):
        error = SyncError(
            employee_id="00012345",
            error_message="Tax number missing for employee 00012345",
        )
        assert classifier.classify(error) == ErrorCategory.IDENTIFICATION_MISSING


class TestErrorClassifierConfigMismatch:
    """Tests for CONFIG_MISMATCH classification."""

    def test_bp_category_mismatch(self, classifier):
        error = SyncError(
            employee_id="00012345",
            error_message="BP category mismatch: expected 2 but found 1",
        )
        assert classifier.classify(error) == ErrorCategory.CONFIG_MISMATCH

    def test_grouping_not_maintained(self, classifier):
        error = SyncError(
            employee_id="00012345",
            error_message="Grouping not maintained for employee type X",
        )
        assert classifier.classify(error) == ErrorCategory.CONFIG_MISMATCH

    def test_cvi_mapping_error(self, classifier):
        error = SyncError(
            employee_id="00012345",
            error_message="CVI mapping error: no mapping found for org unit 1000",
        )
        assert classifier.classify(error) == ErrorCategory.CONFIG_MISMATCH


class TestErrorClassifierUnknown:
    """Tests for UNKNOWN classification (no pattern match)."""

    def test_unrecognized_message(self, classifier):
        error = SyncError(
            employee_id="00012345",
            error_message="Some completely unknown error that doesn't match any pattern",
        )
        assert classifier.classify(error) == ErrorCategory.UNKNOWN

    def test_empty_message(self, classifier):
        error = SyncError(
            employee_id="00012345",
            error_message="",
        )
        assert classifier.classify(error) == ErrorCategory.UNKNOWN

    def test_generic_system_error(self, classifier):
        error = SyncError(
            employee_id="00012345",
            error_message="System exception in method CL_BP_SYNC=>PROCESS",
        )
        assert classifier.classify(error) == ErrorCategory.UNKNOWN


class TestErrorClassifierHelpers:
    """Tests for classifier helper methods."""

    def test_classify_message_shortcut(self, classifier):
        result = classifier.classify_message("No address maintained for BP 1234")
        assert result == ErrorCategory.MISSING_ADDRESS

    def test_get_patterns_for_category(self, classifier):
        patterns = classifier.get_patterns_for_category(ErrorCategory.MISSING_ADDRESS)
        assert len(patterns) > 0
        assert any("address" in p.lower() for p in patterns)

    def test_case_insensitive_matching(self, classifier):
        # Upper case
        result = classifier.classify_message("NO ADDRESS MAINTAINED FOR BP")
        assert result == ErrorCategory.MISSING_ADDRESS

        # Mixed case
        result = classifier.classify_message("Duplicate Business Partner detected")
        assert result == ErrorCategory.DUPLICATE_BP
