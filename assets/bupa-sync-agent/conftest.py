"""Base conftest for the BUPA Sync Agent test suite."""

import os
import pytest

# Ensure test environment variables are set
os.environ.setdefault("AICORE_LLM_DEPLOYMENT_URL", "http://localhost:8080/v1")
os.environ.setdefault("AICORE_LLM_RESOURCE_GROUP", "test-group")
os.environ.setdefault("AICORE_LLM_AUTH_URL", "http://localhost:8080/oauth/token")
os.environ.setdefault("AICORE_LLM_CLIENT_ID", "test-client-id")
os.environ.setdefault("AICORE_LLM_CLIENT_SECRET", "test-client-secret")


@pytest.fixture
def sample_error_message_missing_address():
    """Sample SLG1 error message for missing address."""
    return "No address maintained for business partner 0000001234"


@pytest.fixture
def sample_error_message_duplicate_bp():
    """Sample SLG1 error message for duplicate BP."""
    return "Duplicate business partner found for employee 00012345"


@pytest.fixture
def sample_error_message_invalid_pernr():
    """Sample SLG1 error message for invalid PERNR."""
    return "Personnel number not found in HR master data: 99999999"


@pytest.fixture
def sample_error_message_bank_mismatch():
    """Sample SLG1 error message for bank data mismatch."""
    return "Bank details inconsistent between HR and BP record"


@pytest.fixture
def sample_error_message_identification_missing():
    """Sample SLG1 error message for missing identification."""
    return "ID document required for business partner creation"


@pytest.fixture
def sample_error_message_config_mismatch():
    """Sample SLG1 error message for config mismatch."""
    return "BP category mismatch: expected 2 but found 1"
