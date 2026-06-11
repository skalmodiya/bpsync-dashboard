"""Agent graph creation for the BUPA Sync Agent."""

from typing import Sequence

from langchain_core.language_models import BaseChatModel
from langchain_core.tools import BaseTool
from langchain_core.messages import AIMessage, SystemMessage

SYSTEM_PROMPT = (
    "You are an AI agent that analyzes BUPA synchronization errors post S/4HANA conversion. "
    "You classify errors by type (missing address, duplicate BP, invalid PERNR, bank data mismatch, "
    "identification missing, config mismatch), cross-reference employee and business partner data, "
    "and propose contextual fixes with confidence scores. You never apply fixes autonomously - "
    "always propose and explain for consultant approval."
)


def create_agent(
    llm: BaseChatModel | None,
    tools: Sequence[BaseTool],
    system_prompt: str | None = None,
):
    """Create a LangGraph agent for BUPA sync error analysis.

    Uses a simple graph with LLM node. Falls back to prebuilt ReAct agent
    if langgraph.prebuilt is available, otherwise uses a direct LLM call graph.

    Args:
        llm: The language model to use for reasoning.
        tools: Sequence of tools available to the agent.
        system_prompt: Optional system prompt override.

    Returns:
        A compiled LangGraph StateGraph ready for invocation.
    """
    from langgraph.graph import StateGraph, MessagesState, END

    prompt = system_prompt or SYSTEM_PROMPT

    if llm is None:
        # Return a minimal passthrough graph for testing without an LLM
        def echo_node(state: MessagesState):
            """Passthrough node that echoes the last message (for testing)."""
            messages = state.get("messages", [])
            last_content = messages[-1].content if messages else "No input provided."
            return {
                "messages": [
                    AIMessage(content=f"[Mock Agent] Received: {last_content}")
                ]
            }

        graph = StateGraph(MessagesState)
        graph.add_node("echo", echo_node)
        graph.set_entry_point("echo")
        graph.add_edge("echo", END)
        return graph.compile()

    # Try to use prebuilt ReAct agent (full tool-calling support)
    try:
        from langgraph.prebuilt import create_react_agent

        agent = create_react_agent(
            model=llm,
            tools=list(tools),
            prompt=prompt,
        )
        return agent
    except (
        ImportError,
        ModuleNotFoundError,
        TypeError,
        NotImplementedError,
        Exception,
    ) as e:
        import logging

        logging.getLogger(__name__).warning(
            f"ReAct agent creation failed ({type(e).__name__}: {e}), using fallback LLM graph"
        )
        pass

    # Fallback: simple LLM call graph (no tool calling, but works locally)
    async def llm_node(state: MessagesState):
        """Direct LLM invocation with system prompt prepended."""
        messages = state.get("messages", [])
        # Prepend system prompt
        full_messages = [SystemMessage(content=prompt)] + messages
        response = await llm._agenerate(full_messages)
        ai_message = response.generations[0].message
        return {"messages": [ai_message]}

    graph = StateGraph(MessagesState)
    graph.add_node("llm", llm_node)
    graph.set_entry_point("llm")
    graph.add_edge("llm", END)
    return graph.compile()
