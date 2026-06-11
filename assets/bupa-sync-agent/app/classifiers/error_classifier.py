"""Error classifier for BUPA synchronization errors."""

import re
from pathlib import Path
from typing import Optional

import yaml

from app.models.sync_error import ErrorCategory, SyncError


class ErrorClassifier:
    """Classifies BUPA sync errors into known categories using pattern matching.

    The classifier uses regex patterns defined in config/error_patterns.yaml
    to match SLG1 error messages against known error categories. Falls back
    to UNKNOWN for messages that don't match any known pattern.
    """

    def __init__(self, patterns_path: Optional[str] = None):
        """Initialize the classifier with error patterns.

        Args:
            patterns_path: Path to the YAML patterns file.
                          Defaults to config/error_patterns.yaml.
        """
        if patterns_path is None:
            # Resolve relative to project root
            project_root = Path(__file__).parent.parent.parent
            patterns_path = str(project_root / "config" / "error_patterns.yaml")

        self._patterns: dict[ErrorCategory, list[re.Pattern]] = {}
        self._load_patterns(patterns_path)

    def _load_patterns(self, patterns_path: str) -> None:
        """Load and compile regex patterns from YAML configuration.

        Args:
            patterns_path: Path to the patterns YAML file.
        """
        try:
            with open(patterns_path, "r") as f:
                config = yaml.safe_load(f)
        except FileNotFoundError:
            # Use built-in fallback patterns if config file is missing
            config = self._get_default_patterns()

        patterns_config = config.get("error_patterns", config)

        for category_name, patterns in patterns_config.items():
            try:
                category = ErrorCategory(category_name)
            except ValueError:
                continue

            compiled = []
            for pattern_str in patterns:
                try:
                    compiled.append(re.compile(pattern_str, re.IGNORECASE))
                except re.error:
                    continue
            self._patterns[category] = compiled

    def classify(self, error: SyncError) -> ErrorCategory:
        """Classify a sync error into a known category.

        Uses regex pattern matching against the error message text.
        Returns UNKNOWN if no patterns match.

        Args:
            error: The SyncError to classify.

        Returns:
            The matched ErrorCategory.
        """
        message = error.error_message

        for category, patterns in self._patterns.items():
            for pattern in patterns:
                if pattern.search(message):
                    return category

        return ErrorCategory.UNKNOWN

    def classify_message(self, message: str) -> ErrorCategory:
        """Classify an error message string directly.

        Convenience method for classifying raw message strings
        without constructing a full SyncError.

        Args:
            message: The error message text.

        Returns:
            The matched ErrorCategory.
        """
        # Create a minimal SyncError for classification
        error = SyncError(
            employee_id="",
            error_message=message,
        )
        return self.classify(error)

    def get_patterns_for_category(self, category: ErrorCategory) -> list[str]:
        """Get the regex patterns for a given category.

        Args:
            category: The error category.

        Returns:
            List of pattern strings.
        """
        patterns = self._patterns.get(category, [])
        return [p.pattern for p in patterns]

    @staticmethod
    def _get_default_patterns() -> dict:
        """Return default patterns as fallback when YAML is unavailable."""
        return {
            "error_patterns": {
                "MISSING_ADDRESS": [
                    r"[Nn]o address maintained",
                    r"[Aa]ddress data incomplete",
                    r"[Bb]usiness partner address required",
                    r"[Aa]ddress.*(missing|not found|required)",
                ],
                "DUPLICATE_BP": [
                    r"[Dd]uplicate business partner",
                    r"BP already exists for employee",
                    r"[Mm]ultiple BP records found",
                    r"[Dd]uplicate.*(BP|business partner)",
                ],
                "INVALID_PERNR": [
                    r"[Pp]ersonnel number not found",
                    r"[Ii]nvalid PERNR format",
                    r"[Ee]mployee number mismatch",
                    r"PERNR.*(invalid|not found|mismatch)",
                ],
                "BANK_DATA_MISMATCH": [
                    r"[Bb]ank details inconsistent",
                    r"[Bb]ank key invalid",
                    r"IBAN validation failed",
                    r"[Bb]ank.*(mismatch|inconsistent|invalid)",
                ],
                "IDENTIFICATION_MISSING": [
                    r"ID document required",
                    r"[Nn]o identification maintained",
                    r"[Tt]ax number missing",
                    r"[Ii]dentification.*(missing|required|not maintained)",
                ],
                "CONFIG_MISMATCH": [
                    r"BP category mismatch",
                    r"[Gg]rouping not maintained",
                    r"CVI mapping error",
                    r"(category|grouping|CVI).*(mismatch|error|not maintained)",
                ],
            }
        }
