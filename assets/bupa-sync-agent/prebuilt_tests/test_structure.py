"""Prebuilt test: verify project structure is valid."""

import importlib
from pathlib import Path

import pytest

PROJECT_ROOT = Path(__file__).parent.parent


class TestProjectStructure:
    """Tests that the project structure is complete and valid."""

    def test_requirements_file_exists(self):
        """Test requirements.txt exists."""
        assert (PROJECT_ROOT / "requirements.txt").exists()

    def test_dockerfile_exists(self):
        """Test Dockerfile exists."""
        assert (PROJECT_ROOT / "Dockerfile").exists()

    def test_app_package_exists(self):
        """Test app/ package exists with __init__.py."""
        assert (PROJECT_ROOT / "app" / "__init__.py").exists()

    def test_main_module_exists(self):
        """Test app/main.py exists."""
        assert (PROJECT_ROOT / "app" / "main.py").exists()

    def test_agent_module_exists(self):
        """Test app/agent.py exists."""
        assert (PROJECT_ROOT / "app" / "agent.py").exists()

    def test_agent_executor_module_exists(self):
        """Test app/agent_executor.py exists."""
        assert (PROJECT_ROOT / "app" / "agent_executor.py").exists()

    def test_models_package_exists(self):
        """Test app/models/ package exists."""
        assert (PROJECT_ROOT / "app" / "models" / "__init__.py").exists()

    def test_classifiers_package_exists(self):
        """Test app/classifiers/ package exists."""
        assert (PROJECT_ROOT / "app" / "classifiers" / "__init__.py").exists()

    def test_resolvers_package_exists(self):
        """Test app/resolvers/ package exists."""
        assert (PROJECT_ROOT / "app" / "resolvers" / "__init__.py").exists()

    def test_tools_package_exists(self):
        """Test app/tools/ package exists."""
        assert (PROJECT_ROOT / "app" / "tools" / "__init__.py").exists()

    def test_instrumentation_package_exists(self):
        """Test app/instrumentation/ package exists."""
        assert (PROJECT_ROOT / "app" / "instrumentation" / "__init__.py").exists()

    def test_config_directory_exists(self):
        """Test config/ directory exists."""
        assert (PROJECT_ROOT / "config").exists()

    def test_error_patterns_yaml_exists(self):
        """Test config/error_patterns.yaml exists."""
        assert (PROJECT_ROOT / "config" / "error_patterns.yaml").exists()

    def test_models_importable(self):
        """Test that models module can be imported."""
        mod = importlib.import_module("app.models")
        assert hasattr(mod, "ErrorCategory")
        assert hasattr(mod, "SyncError")
        assert hasattr(mod, "FixProposal")

    def test_classifiers_importable(self):
        """Test that classifiers module can be imported."""
        mod = importlib.import_module("app.classifiers")
        assert hasattr(mod, "ErrorClassifier")

    def test_resolvers_importable(self):
        """Test that resolvers module can be imported."""
        mod = importlib.import_module("app.resolvers")
        assert hasattr(mod, "FixResolver")

    def test_tools_importable(self):
        """Test that tools module can be imported."""
        mod = importlib.import_module("app.tools")
        assert hasattr(mod, "BPToolClient")

    def test_instrumentation_importable(self):
        """Test that instrumentation module can be imported."""
        mod = importlib.import_module("app.instrumentation")
        assert hasattr(mod, "setup_telemetry")
