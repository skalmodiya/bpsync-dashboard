import { useState, useCallback, useRef, useEffect } from 'react';
import { useCopilotContext } from '../components/copilot/CopilotContext';

export interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  ts: number;
  error?: boolean;
}

export interface CopilotChat {
  id: string;
  title: string;
  messages: CopilotMessage[];
  createdAt: number;
}

const CHATS_KEY  = 'bpsync_copilot_chats';
const ACTIVE_KEY = 'bpsync_copilot_active_id';
const MAX_CHATS  = 50;

const AGENT_URL = (window as any).__AGENT_URL__ || '';

const WELCOME: CopilotMessage = {
  id: 'welcome',
  role: 'assistant',
  content: `Hi! I'm your **BPSYNC AI Copilot**. I can help you understand sync errors, analyze BUPA data, configure connections, interpret reports, and more.\n\nTry one of the suggested prompts below, or ask me anything about your BUPA sync process. 🚀`,
  ts: Date.now(),
};

function makeId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function makeChat(initialMessages: CopilotMessage[] = [WELCOME]): CopilotChat {
  return { id: makeId(), title: 'New Chat', messages: initialMessages, createdAt: Date.now() };
}

function loadChats(): CopilotChat[] {
  try {
    const raw = localStorage.getItem(CHATS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveChats(chats: CopilotChat[]) {
  localStorage.setItem(CHATS_KEY, JSON.stringify(chats.slice(0, MAX_CHATS)));
}

export function useCopilot() {
  const { incrementUnread, isOpen } = useCopilotContext();

  const [chats, setChats] = useState<CopilotChat[]>(() => {
    const stored = loadChats();
    return stored.length > 0 ? stored : [makeChat()];
  });

  const [activeId, setActiveId] = useState<string>(() => {
    const stored = loadChats();
    const savedId = localStorage.getItem(ACTIVE_KEY);
    if (savedId && stored.find(c => c.id === savedId)) return savedId;
    return stored.length > 0 ? stored[0].id : makeChat().id;
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Persist on every change
  useEffect(() => { saveChats(chats); }, [chats]);
  useEffect(() => { localStorage.setItem(ACTIVE_KEY, activeId); }, [activeId]);

  const activeChat = chats.find(c => c.id === activeId) ?? chats[0];
  const messages = activeChat?.messages ?? [WELCOME];

  const updateChat = useCallback((id: string, updater: (c: CopilotChat) => CopilotChat) => {
    setChats(prev => prev.map(c => c.id === id ? updater(c) : c));
  }, []);

  const send = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return;
    setError(null);

    const userMsg: CopilotMessage = { id: makeId(), role: 'user', content: content.trim(), ts: Date.now() };

    // Ensure we have an active chat
    let targetId = activeId;
    if (!chats.find(c => c.id === activeId)) {
      const fresh = makeChat([WELCOME]);
      setChats(prev => [fresh, ...prev]);
      setActiveId(fresh.id);
      targetId = fresh.id;
    }

    // Append user message
    updateChat(targetId, chat => {
      const msgs = [...chat.messages, userMsg];
      const title = chat.title === 'New Chat'
        ? userMsg.content.slice(0, 42) + (userMsg.content.length > 42 ? '…' : '')
        : chat.title;
      return { ...chat, messages: msgs, title };
    });

    setIsLoading(true);
    abortRef.current = new AbortController();

    try {
      const currentChat = chats.find(c => c.id === targetId);
      const history = [
        ...(currentChat?.messages.filter(m => m.role !== 'system' && m.id !== 'welcome') ?? []),
        userMsg,
      ].map(m => ({ role: m.role, content: m.content }));

      const res = await fetch(`${AGENT_URL}/invoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) throw new Error(`Agent returned ${res.status}`);
      const data = await res.json();
      const content = data?.result?.content ?? data?.content ?? JSON.stringify(data);

      const assistantMsg: CopilotMessage = { id: makeId(), role: 'assistant', content, ts: Date.now() };

      updateChat(targetId, chat => ({ ...chat, messages: [...chat.messages, assistantMsg] }));

      if (!isOpen) incrementUnread();
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      const errMsg: CopilotMessage = {
        id: makeId(), role: 'assistant', content: `Sorry, I couldn't process that. ${e?.message ?? 'Unknown error'}`, ts: Date.now(), error: true,
      };
      updateChat(targetId, chat => ({ ...chat, messages: [...chat.messages, errMsg] }));
      setError(e?.message ?? 'Request failed');
    } finally {
      setIsLoading(false);
    }
  }, [activeId, chats, isLoading, isOpen, incrementUnread, updateChat]);

  const newChat = useCallback(() => {
    const chat = makeChat();
    setChats(prev => [chat, ...prev]);
    setActiveId(chat.id);
    setError(null);
  }, []);

  const clearHistory = useCallback(() => {
    const fresh = makeChat();
    setChats([fresh]);
    setActiveId(fresh.id);
    setError(null);
  }, []);

  const deleteChat = useCallback((id: string) => {
    setChats(prev => {
      const next = prev.filter(c => c.id !== id);
      if (next.length === 0) {
        const fresh = makeChat();
        setActiveId(fresh.id);
        return [fresh];
      }
      if (id === activeId) setActiveId(next[0].id);
      return next;
    });
  }, [activeId]);

  const switchChat = useCallback((id: string) => {
    setActiveId(id);
    setError(null);
  }, []);

  const cancelStream = useCallback(() => {
    abortRef.current?.abort();
    setIsLoading(false);
  }, []);

  return {
    chats, activeChat, activeId, messages,
    isLoading, error,
    send, newChat, clearHistory, deleteChat, switchChat, cancelStream,
  };
}
