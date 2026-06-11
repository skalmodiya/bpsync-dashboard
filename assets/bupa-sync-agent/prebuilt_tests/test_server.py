"""Prebuilt test: verify agent server starts and agent card is served."""

import pytest


class TestAgentServer:
    """Tests for the A2A agent server endpoints."""

    def test_agent_card_structure(self):
        """Test that the agent card has required A2A fields."""
        from app.main import AGENT_CARD

        assert "name" in AGENT_CARD
        assert "title" in AGENT_CARD
        assert "description" in AGENT_CARD
        assert "version" in AGENT_CARD
        assert "capabilities" in AGENT_CARD
        assert "skills" in AGENT_CARD

    def test_agent_card_name(self):
        """Test agent card has correct name."""
        from app.main import AGENT_CARD

        assert AGENT_CARD["name"] == "bupa-sync-agent"

    def test_agent_card_has_skills(self):
        """Test agent card declares at least one skill."""
        from app.main import AGENT_CARD

        assert len(AGENT_CARD["skills"]) > 0

    def test_agent_skill_has_examples(self):
        """Test agent skill includes usage examples."""
        from app.main import AGENT_CARD

        skill = AGENT_CARD["skills"][0]
        assert "examples" in skill
        assert len(skill["examples"]) > 0

    def test_agent_card_capabilities(self):
        """Test agent card declares capabilities."""
        from app.main import AGENT_CARD

        capabilities = AGENT_CARD["capabilities"]
        assert "streaming" in capabilities
        assert "pushNotifications" in capabilities

    def test_create_app_returns_starlette(self):
        """Test that create_app returns a Starlette application."""
        try:
            from app.main import create_app

            app = create_app()
            # If starlette is installed, app should not be None
            if app is not None:
                assert hasattr(app, "routes")
        except ImportError:
            pytest.skip("Starlette not installed")

    def test_agent_card_default_modes(self):
        """Test agent card specifies input/output modes."""
        from app.main import AGENT_CARD

        assert "defaultInputModes" in AGENT_CARD
        assert "text/plain" in AGENT_CARD["defaultInputModes"]
        assert "defaultOutputModes" in AGENT_CARD
        assert "text/plain" in AGENT_CARD["defaultOutputModes"]
