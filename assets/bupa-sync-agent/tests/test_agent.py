"""Integration tests for the BUPA Sync Agent."""

from unittest.mock import AsyncMock, patch

import pytest

from app.agent import create_agent, SYSTEM_PROMPT
from app.agent_executor import AgentExecutor


class TestAgentCreation:
    """Tests for agent graph creation."""

    def test_create_agent_without_llm(self):
        """Test agent creation with no LLM (mock mode)."""
        graph = create_agent(llm=None, tools=[], system_prompt=SYSTEM_PROMPT)
        assert graph is not None

    def test_create_agent_with_empty_tools(self):
        """Test agent creation with empty tool list."""
        graph = create_agent(llm=None, tools=[])
        assert graph is not None

    def test_create_agent_uses_default_prompt(self):
        """Test agent uses default system prompt when none provided."""
        graph = create_agent(llm=None, tools=[], system_prompt=None)
        assert graph is not None

    async def test_mock_agent_invocation(self):
        """Test invoking the mock agent returns a response."""
        from langchain_core.messages import HumanMessage

        graph = create_agent(llm=None, tools=[])
        result = await graph.ainvoke(
            {"messages": [HumanMessage(content="Test message")]}
        )

        assert "messages" in result
        assert len(result["messages"]) > 0
        last_msg = result["messages"][-1]
        assert "Test message" in last_msg.content


class TestAgentExecutor:
    """Tests for the AgentExecutor class."""

    @patch("app.agent_executor.get_mcp_tools")
    async def test_executor_initialization(self, mock_mcp_tools):
        """Test AgentExecutor initializes correctly."""
        mock_mcp_tools.return_value = []

        executor = AgentExecutor()
        assert executor._initialized is False

        await executor.initialize()
        assert executor._initialized is True
        mock_mcp_tools.assert_called_once()

    @patch("app.agent_executor.get_mcp_tools")
    async def test_executor_invoke(self, mock_mcp_tools):
        """Test AgentExecutor processes messages."""
        mock_mcp_tools.return_value = []

        executor = AgentExecutor()
        messages = [{"role": "user", "content": "Analyze sync errors"}]
        result = await executor.invoke(messages)

        assert "role" in result
        assert result["role"] == "assistant"
        assert "content" in result
        assert len(result["content"]) > 0

    @patch("app.agent_executor.get_mcp_tools")
    async def test_executor_handles_empty_messages(self, mock_mcp_tools):
        """Test executor handles empty message list gracefully."""
        mock_mcp_tools.return_value = []

        executor = AgentExecutor()
        # Even with empty messages, should not crash
        messages = [{"role": "user", "content": ""}]
        result = await executor.invoke(messages)

        assert "role" in result
        assert result["role"] == "assistant"

    @patch("app.agent_executor.get_mcp_tools")
    async def test_executor_multiple_messages(self, mock_mcp_tools):
        """Test executor handles conversation with multiple messages."""
        mock_mcp_tools.return_value = []

        executor = AgentExecutor()
        messages = [
            {"role": "system", "content": "You are a helpful agent."},
            {"role": "user", "content": "What errors do you see?"},
            {"role": "assistant", "content": "I found 3 errors."},
            {"role": "user", "content": "Propose fixes for the first one."},
        ]
        result = await executor.invoke(messages)

        assert "role" in result
        assert result["role"] == "assistant"

    @patch("app.agent_executor.get_mcp_tools")
    async def test_executor_only_initializes_once(self, mock_mcp_tools):
        """Test executor doesn't re-initialize on second invoke."""
        mock_mcp_tools.return_value = []

        executor = AgentExecutor()
        await executor.invoke([{"role": "user", "content": "Hello"}])
        await executor.invoke([{"role": "user", "content": "Again"}])

        # Should only call get_mcp_tools once
        mock_mcp_tools.assert_called_once()


class TestAgentSystemPrompt:
    """Tests for the agent system prompt."""

    def test_system_prompt_mentions_bupa(self):
        """Test system prompt mentions BUPA."""
        assert "BUPA" in SYSTEM_PROMPT

    def test_system_prompt_mentions_error_types(self):
        """Test system prompt mentions all error categories."""
        assert "missing address" in SYSTEM_PROMPT
        assert "duplicate BP" in SYSTEM_PROMPT
        assert "invalid PERNR" in SYSTEM_PROMPT
        assert "bank data mismatch" in SYSTEM_PROMPT
        assert "identification missing" in SYSTEM_PROMPT
        assert "config mismatch" in SYSTEM_PROMPT

    def test_system_prompt_mentions_no_autonomous_fixes(self):
        """Test system prompt emphasizes no autonomous fixes."""
        assert "never apply fixes autonomously" in SYSTEM_PROMPT.lower()

    def test_system_prompt_mentions_confidence(self):
        """Test system prompt mentions confidence scores."""
        assert "confidence" in SYSTEM_PROMPT.lower()
