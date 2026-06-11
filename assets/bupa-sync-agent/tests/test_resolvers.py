"""Unit tests for the FixResolver."""

import pytest

from app.models import ErrorCategory, SyncError, FixProposal
from app.resolvers import FixResolver


@pytest.fixture
def resolver():
    """Create a FixResolver instance."""
    return FixResolver()


@pytest.fixture
def missing_address_error():
    """Sample missing address error."""
    return SyncError(
        employee_id="00012345",
        error_message="No address maintained for business partner 0000001234",
        related_bp_id="0000001234",
    )


@pytest.fixture
def duplicate_bp_error():
    """Sample duplicate BP error."""
    return SyncError(
        employee_id="00054321",
        error_message="Duplicate business partner found for employee 00054321",
    )


@pytest.fixture
def invalid_pernr_error():
    """Sample invalid PERNR error."""
    return SyncError(
        employee_id="12345",
        error_message="Invalid PERNR format: 12345",
    )


@pytest.fixture
def bank_mismatch_error():
    """Sample bank data mismatch error."""
    return SyncError(
        employee_id="00012345",
        error_message="Bank details inconsistent between HR and BP record",
        related_bp_id="0000001234",
    )


@pytest.fixture
def identification_missing_error():
    """Sample identification missing error."""
    return SyncError(
        employee_id="00012345",
        error_message="ID document required for business partner creation",
    )


@pytest.fixture
def config_mismatch_error():
    """Sample config mismatch error."""
    return SyncError(
        employee_id="00012345",
        error_message="BP category mismatch: expected 2 but found 1",
    )


class TestFixResolverMissingAddress:
    """Tests for missing address resolution."""

    async def test_with_hr_address_context(self, resolver, missing_address_error):
        """Test resolution when HR address data is available."""
        context = {
            "hr_address": {
                "street": "Main Street 1",
                "city": "Berlin",
                "postal_code": "10115",
            }
        }
        proposal = await resolver.propose_fix(missing_address_error, context)

        assert isinstance(proposal, FixProposal)
        assert proposal.target_table == "BUT020"
        assert proposal.target_field == "ADDRNUMBER"
        assert proposal.confidence_score == 0.9
        assert "PA0006" in proposal.proposed_action
        assert "Berlin" in proposal.proposed_value

    async def test_without_hr_address_context(self, resolver, missing_address_error):
        """Test resolution when no HR address data is available."""
        proposal = await resolver.propose_fix(missing_address_error, {})

        assert isinstance(proposal, FixProposal)
        assert proposal.target_table == "BUT020"
        assert proposal.confidence_score == 0.7
        assert "00012345" in proposal.proposed_value


class TestFixResolverDuplicateBP:
    """Tests for duplicate BP resolution."""

    async def test_with_identified_primary(self, resolver, duplicate_bp_error):
        """Test resolution when primary BP is identified."""
        context = {
            "primary_bp": "0000001111",
            "duplicate_bps": ["0000002222", "0000003333"],
        }
        proposal = await resolver.propose_fix(duplicate_bp_error, context)

        assert isinstance(proposal, FixProposal)
        assert proposal.target_table == "BUT000"
        assert proposal.confidence_score == 0.9
        assert "0000001111" in proposal.proposed_value
        assert "deletion" in proposal.explanation.lower()

    async def test_with_duplicates_no_primary(self, resolver, duplicate_bp_error):
        """Test resolution when duplicates found but no primary identified."""
        context = {
            "duplicate_bps": ["0000002222", "0000003333"],
        }
        proposal = await resolver.propose_fix(duplicate_bp_error, context)

        assert isinstance(proposal, FixProposal)
        assert proposal.confidence_score == 0.7
        assert "review" in proposal.proposed_value.lower()

    async def test_without_context(self, resolver, duplicate_bp_error):
        """Test resolution without any context."""
        proposal = await resolver.propose_fix(duplicate_bp_error, {})

        assert isinstance(proposal, FixProposal)
        assert proposal.confidence_score == 0.4


class TestFixResolverInvalidPERNR:
    """Tests for invalid PERNR resolution."""

    async def test_short_pernr_format(self, resolver, invalid_pernr_error):
        """Test resolution when PERNR needs zero-padding."""
        proposal = await resolver.propose_fix(invalid_pernr_error, {})

        assert isinstance(proposal, FixProposal)
        assert proposal.target_table == "BUT000"
        # Should propose zero-padded version
        assert proposal.confidence_score == 0.9
        assert "00012345" in proposal.proposed_value

    async def test_with_hr_record_context(self, resolver):
        """Test resolution with HR record providing correct PERNR."""
        error = SyncError(
            employee_id="INVALID",
            error_message="Personnel number not found: INVALID",
        )
        context = {"hr_record": {"correct_pernr": "00099999"}}
        proposal = await resolver.propose_fix(error, context)

        assert isinstance(proposal, FixProposal)
        assert proposal.confidence_score == 0.7


class TestFixResolverBankMismatch:
    """Tests for bank data mismatch resolution."""

    async def test_with_both_bank_records(self, resolver, bank_mismatch_error):
        """Test resolution when both HR and BP bank data available."""
        context = {
            "hr_bank_data": {"iban": "DE89370400440532013000", "bic": "COBADEFFXXX"},
            "bp_bank_data": {"iban": "DE11520513735120710131", "bic": "COBADEFFXXX"},
        }
        proposal = await resolver.propose_fix(bank_mismatch_error, context)

        assert isinstance(proposal, FixProposal)
        assert proposal.target_table == "BUT0BK"
        assert proposal.confidence_score == 0.9
        assert "DE89370400440532013000" in proposal.proposed_value

    async def test_with_hr_bank_only(self, resolver, bank_mismatch_error):
        """Test resolution when only HR bank data is available."""
        context = {
            "hr_bank_data": {"iban": "DE89370400440532013000", "bic": "COBADEFFXXX"},
        }
        proposal = await resolver.propose_fix(bank_mismatch_error, context)

        assert isinstance(proposal, FixProposal)
        assert proposal.confidence_score == 0.7

    async def test_without_context(self, resolver, bank_mismatch_error):
        """Test resolution without bank context."""
        proposal = await resolver.propose_fix(bank_mismatch_error, {})

        assert isinstance(proposal, FixProposal)
        assert proposal.confidence_score == 0.4
        assert "manual" in proposal.proposed_value.lower()


class TestFixResolverIdentificationMissing:
    """Tests for missing identification resolution."""

    async def test_with_hr_identifications(
        self, resolver, identification_missing_error
    ):
        """Test resolution when HR ID documents are available."""
        context = {
            "hr_identifications": [
                {"type": "01", "number": "DE123456789"},
            ]
        }
        proposal = await resolver.propose_fix(identification_missing_error, context)

        assert isinstance(proposal, FixProposal)
        assert proposal.target_table == "BUT0ID"
        assert proposal.confidence_score == 0.9
        assert "DE123456789" in proposal.proposed_value

    async def test_without_hr_identifications(
        self, resolver, identification_missing_error
    ):
        """Test resolution without HR identification data."""
        proposal = await resolver.propose_fix(identification_missing_error, {})

        assert isinstance(proposal, FixProposal)
        assert proposal.confidence_score == 0.4
        assert "PA0185" in proposal.proposed_value


class TestFixResolverConfigMismatch:
    """Tests for config mismatch resolution."""

    async def test_with_category_context(self, resolver, config_mismatch_error):
        """Test resolution when expected/actual categories are known."""
        context = {
            "expected_bp_category": "2",
            "actual_bp_category": "1",
            "employee_type": "internal",
        }
        proposal = await resolver.propose_fix(config_mismatch_error, context)

        assert isinstance(proposal, FixProposal)
        assert proposal.target_table == "BUT000"
        assert proposal.target_field == "BU_GROUP"
        assert proposal.confidence_score == 0.9
        assert "2" in proposal.proposed_value

    async def test_from_error_message_extraction(self, resolver, config_mismatch_error):
        """Test resolution extracting values from error message."""
        proposal = await resolver.propose_fix(config_mismatch_error, {})

        assert isinstance(proposal, FixProposal)
        # Should extract "expected 2 but found 1" from message
        assert proposal.confidence_score == 0.7


class TestFixResolverUnknown:
    """Tests for unknown error resolution."""

    async def test_unknown_error_handling(self, resolver):
        """Test that unknown errors get a generic proposal."""
        error = SyncError(
            employee_id="00012345",
            error_message="Completely unexpected error XYZ",
        )
        proposal = await resolver.propose_fix(error, {})

        assert isinstance(proposal, FixProposal)
        assert proposal.target_table == "UNKNOWN"
        assert proposal.confidence_score == 0.4
        assert "manual" in proposal.proposed_action.lower()
