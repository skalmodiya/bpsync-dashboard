import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import type { Prompt } from './prompts';
import { GLOBAL_PROMPTS, PAGE_PROMPTS, USER_PROMPTS_KEY } from './prompts';

interface CopilotContextValue {
  isOpen: boolean;
  isMaximized: boolean;
  toggle: () => void;
  open: () => void;
  close: () => void;
  maximize: () => void;
  restore: () => void;
  currentPagePrompts: Prompt[];
  userPrompts: Prompt[];
  addUserPrompt: (p: Omit<Prompt, 'id'>) => void;
  deleteUserPrompt: (id: string) => void;
  unreadCount: number;
  incrementUnread: () => void;
  clearUnread: () => void;
}

const CopilotContext = createContext<CopilotContextValue | null>(null);

export function CopilotProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [userPrompts, setUserPrompts] = useState<Prompt[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(USER_PROMPTS_KEY) || '[]');
    } catch { return []; }
  });
  const [unreadCount, setUnreadCount] = useState(0);

  // Persist user prompts
  useEffect(() => {
    localStorage.setItem(USER_PROMPTS_KEY, JSON.stringify(userPrompts));
  }, [userPrompts]);

  // Derive current page prompts: global + page-specific + user
  const currentPagePath = location.pathname;
  const pageSpecific = PAGE_PROMPTS[currentPagePath] || [];
  const currentPagePrompts = [...GLOBAL_PROMPTS, ...pageSpecific, ...userPrompts];

  const toggle = useCallback(() => setIsOpen(o => !o), []);
  const open   = useCallback(() => setIsOpen(true), []);
  const close  = useCallback(() => { setIsOpen(false); setIsMaximized(false); }, []);
  const maximize = useCallback(() => setIsMaximized(true), []);
  const restore  = useCallback(() => setIsMaximized(false), []);

  const addUserPrompt = useCallback((p: Omit<Prompt, 'id'>) => {
    setUserPrompts(prev => [...prev, { ...p, id: `u_${Date.now()}` }]);
  }, []);

  const deleteUserPrompt = useCallback((id: string) => {
    setUserPrompts(prev => prev.filter(p => p.id !== id));
  }, []);

  const incrementUnread = useCallback(() => {
    setUnreadCount(c => c + 1);
  }, []);

  const clearUnread = useCallback(() => setUnreadCount(0), []);

  // Clear unread when opened
  useEffect(() => { if (isOpen) clearUnread(); }, [isOpen, clearUnread]);

  return (
    <CopilotContext.Provider value={{
      isOpen, isMaximized,
      toggle, open, close, maximize, restore,
      currentPagePrompts, userPrompts,
      addUserPrompt, deleteUserPrompt,
      unreadCount, incrementUnread, clearUnread,
    }}>
      {children}
    </CopilotContext.Provider>
  );
}

export function useCopilotContext() {
  const ctx = useContext(CopilotContext);
  if (!ctx) throw new Error('useCopilotContext must be used inside CopilotProvider');
  return ctx;
}
