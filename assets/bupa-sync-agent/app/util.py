"""Utility functions for the BUPA Sync Agent."""

import logging
import os
import sys


def get_logger(name: str) -> logging.Logger:
    """Get a configured logger instance.

    Args:
        name: Logger name (typically __name__).

    Returns:
        Configured Logger instance.
    """
    logger = logging.getLogger(name)

    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setLevel(logging.DEBUG)
        formatter = logging.Formatter(
            "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)

    log_level = os.environ.get("LOG_LEVEL", "INFO").upper()
    logger.setLevel(getattr(logging, log_level, logging.INFO))

    return logger


def get_system_prompt() -> str:
    """Get the system prompt for the BUPA Sync Agent.

    Returns:
        The system prompt string.
    """
    return (
        "You are an AI agent that analyzes BUPA synchronization errors post S/4HANA conversion. "
        "You classify errors by type (missing address, duplicate BP, invalid PERNR, bank data mismatch, "
        "identification missing, config mismatch), cross-reference employee and business partner data, "
        "and propose contextual fixes with confidence scores. You never apply fixes autonomously - "
        "always propose and explain for consultant approval.\n\n"
        "When analyzing errors:\n"
        "1. First classify the error into one of the known categories\n"
        "2. Look up related business partner and employee data using available tools\n"
        "3. Cross-reference the data to identify the root cause\n"
        "4. Propose a specific fix with the target table, field, and value\n"
        "5. Assign a confidence score (0.0-1.0) based on pattern match quality\n"
        "6. Explain your reasoning clearly for the consultant to review\n\n"
        "Error categories:\n"
        "- MISSING_ADDRESS: Address data not maintained or incomplete\n"
        "- DUPLICATE_BP: Multiple BP records exist for the same employee\n"
        "- INVALID_PERNR: Personnel number not found or format invalid\n"
        "- BANK_DATA_MISMATCH: Bank details differ between HR and BP records\n"
        "- IDENTIFICATION_MISSING: Required ID documents not maintained\n"
        "- CONFIG_MISMATCH: BP category, grouping, or CVI mapping errors\n"
    )
