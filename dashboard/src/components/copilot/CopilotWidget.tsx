import {
  useState, useRef, useEffect, useCallback, type KeyboardEvent,
} from 'react';
import {
  Bot, Send, X, Maximize2, Minimize2, RotateCcw, Plus, Trash2,
  History, ChevronLeft, Copy, Check, AlertCircle, Sparkles,
  GripVertical, Settings2, BookOpen, User, Clock,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useCopilotContext } from './CopilotContext';
import { useCopilot } from '../../hooks/useCopilot';
import type { Prompt } from './prompts';

// ── Markdown-lite renderer (bold, code, newlines) ────────────────────────────
function renderMarkdown(text: string) {
  const lines = text.split('\n');
  return lines.map((line, i) => {
    // code blocks
    if (line.startsWith('```') || line.startsWith('    ')) {
      return <code key={i} className="block bg-black/10 dark:bg-white/10 rounded px-2 py-0.5 text-xs font-mono my-0.5">{line.replace(/^```\w*/, '').replace(/^    /, '')}</code>;
    }
    // bold **text**
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return (
      <span key={i}>
        {parts.map((p, j) =>
          p.startsWith('**') && p.endsWith('**')
            ? <strong key={j}>{p.slice(2, -2)}</strong>
            : p
        )}
        {i < lines.length - 1 && <br />}
      </span>
    );
  });
}

// ── Relative time ────────────────────────────────────────────────────────────
function relTime(ts: number) {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(ts).toLocaleDateString();
}

// ── Typing indicator ─────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-3 py-2">
      {[0, 1, 2].map(i => (
        <span key={i}
          className="h-2 w-2 rounded-full bg-primary/60 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  );
}

// ── Copy button ──────────────────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-black/10 dark:hover:bg-white/10"
      title="Copy"
    >
      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
    </button>
  );
}

// ── Main Widget ──────────────────────────────────────────────────────────────
export function CopilotWidget() {
  const ctx = useCopilotContext();
  const {
    chats, activeChat, messages, isLoading, error,
    send, newChat, clearHistory, deleteChat, switchChat, cancelStream,
  } = useCopilot();

  // Window state
  const [showHistory, setShowHistory] = useState(false);
  const [showPromptManager, setShowPromptManager] = useState(false);
  const [input, setInput] = useState('');
  // position = offset from default bottom-right anchor (positive = move toward top-left)
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ w: 384, h: 560 });
  const [dragging, setDragging] = useState(false);
  const resizeDir = useRef<string | null>(null);
  const dragStart = useRef({ mx: 0, my: 0, px: 0, py: 0 });
  const resizeStart = useRef({ mx: 0, my: 0, w: 384, h: 560, px: 0, py: 0 });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const widgetRef = useRef<HTMLDivElement>(null);

  // New prompt form state
  const [newPromptLabel, setNewPromptLabel] = useState('');
  const [newPromptContent, setNewPromptContent] = useState('');
  const [promptTab, setPromptTab] = useState<'global' | 'page' | 'mine'>('mine');

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Focus input on open
  useEffect(() => {
    if (ctx.isOpen) setTimeout(() => inputRef.current?.focus(), 100);
  }, [ctx.isOpen]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && ctx.isOpen) ctx.close();
    };
    document.addEventListener('keydown', handler as any);
    return () => document.removeEventListener('keydown', handler as any);
  }, [ctx]);

  // Drag logic
  const startDrag = useCallback((e: React.MouseEvent) => {
    if (ctx.isMaximized) return;
    e.preventDefault();
    dragStart.current = { mx: e.clientX, my: e.clientY, px: position.x, py: position.y };
    setDragging(true);
  }, [ctx.isMaximized, position]);

  useEffect(() => {
    if (!dragging) return;
    const move = (e: MouseEvent) => {
      setPosition({
        x: dragStart.current.px + (e.clientX - dragStart.current.mx),
        y: dragStart.current.py + (e.clientY - dragStart.current.my),
      });
    };
    const up = () => setDragging(false);
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
    return () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); };
  }, [dragging]);

  // 8-direction resize logic
  // dir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'
  const startResize = useCallback((e: React.MouseEvent, dir: string) => {
    if (ctx.isMaximized) return;
    e.preventDefault();
    e.stopPropagation();
    resizeStart.current = {
      mx: e.clientX, my: e.clientY,
      w: size.w, h: size.h,
      px: position.x, py: position.y,
    };
    resizeDir.current = dir;
  }, [ctx.isMaximized, size, position]);

  useEffect(() => {
    const MIN_W = 320, MAX_W = 900, MIN_H = 380, MAX_H = 900;

    const move = (e: MouseEvent) => {
      if (!resizeDir.current) return;
      const dx = e.clientX - resizeStart.current.mx;
      const dy = e.clientY - resizeStart.current.my;
      const dir = resizeDir.current;

      let newW = resizeStart.current.w;
      let newH = resizeStart.current.h;
      let newPx = resizeStart.current.px;
      let newPy = resizeStart.current.py;

      // Horizontal: east = grow right (decrease right offset → more px to left)
      if (dir.includes('e')) {
        newW = Math.max(MIN_W, Math.min(MAX_W, resizeStart.current.w + dx));
      }
      // West = grow left (increase right-side, decrease position.x)
      if (dir.includes('w')) {
        const delta = Math.max(MIN_W - resizeStart.current.w, Math.min(MAX_W - resizeStart.current.w, -dx));
        newW = resizeStart.current.w + delta;
        newPx = resizeStart.current.px - delta; // shift anchor left
      }
      // South = grow down (decrease bottom offset → more py upward)
      if (dir.includes('s')) {
        newH = Math.max(MIN_H, Math.min(MAX_H, resizeStart.current.h + dy));
      }
      // North = grow up (increase bottom-side, decrease position.y)
      if (dir.includes('n')) {
        const delta = Math.max(MIN_H - resizeStart.current.h, Math.min(MAX_H - resizeStart.current.h, -dy));
        newH = resizeStart.current.h + delta;
        newPy = resizeStart.current.py - delta; // shift anchor up
      }

      setSize({ w: newW, h: newH });
      setPosition({ x: newPx, y: newPy });
    };

    const up = () => { resizeDir.current = null; };

    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
    return () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
    };
  }, []); // intentionally stable — uses refs

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    send(input.trim());
    setInput('');
  };

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handlePromptClick = (p: Prompt) => {
    setInput(p.content);
    inputRef.current?.focus();
  };

  const addUserPrompt = () => {
    if (!newPromptLabel.trim() || !newPromptContent.trim()) return;
    ctx.addUserPrompt({ label: newPromptLabel.trim(), content: newPromptContent.trim() });
    setNewPromptLabel(''); setNewPromptContent('');
  };

  // Widget position styles
  const widgetStyle = ctx.isMaximized
    ? { position: 'fixed' as const, inset: '16px', width: 'auto', height: 'auto', transform: 'none' }
    : {
        position: 'fixed' as const,
        bottom: `${24 - position.y}px`,
        right: `${24 - position.x}px`,
        width: `${size.w}px`,
        height: `${size.h}px`,
      };

  if (!ctx.isOpen) {
    // FAB only
    return (
      <button
        onClick={ctx.open}
        className={clsx(
          'fixed bottom-6 right-6 z-50',
          'h-14 w-14 rounded-2xl',
          'bg-gradient-to-br from-primary to-primary/70',
          'shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40',
          'flex items-center justify-center',
          'transition-all duration-300 hover:scale-110 active:scale-95',
          'ring-2 ring-white/20',
        )}
        title="Open AI Copilot"
      >
        <Bot className="h-6 w-6 text-white" />
        {ctx.unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500
            text-white text-[10px] font-bold flex items-center justify-center
            ring-2 ring-background">
            {ctx.unreadCount > 9 ? '9+' : ctx.unreadCount}
          </span>
        )}
      </button>
    );
  }

  return (
    <div
      ref={widgetRef}
      style={widgetStyle}
      className={clsx(
        'z-50 flex flex-col overflow-hidden',
        'rounded-2xl border border-border/60',
        'bg-background/95 backdrop-blur-xl',
        'shadow-2xl shadow-black/20',
        'transition-shadow duration-300',
        ctx.isMaximized && 'rounded-2xl',
        (dragging || resizeDir.current) && 'select-none',
        'animate-scale-in',
      )}
    >
      {/* ── 8-direction resize handles ── */}
      {!ctx.isMaximized && (<>
        {/* Edges */}
        <div onMouseDown={e => startResize(e, 'n')}  className="absolute top-0 left-3 right-3 h-1.5 cursor-n-resize z-20 hover:bg-primary/20 rounded-full transition-colors" />
        <div onMouseDown={e => startResize(e, 's')}  className="absolute bottom-0 left-3 right-3 h-1.5 cursor-s-resize z-20 hover:bg-primary/20 rounded-full transition-colors" />
        <div onMouseDown={e => startResize(e, 'e')}  className="absolute right-0 top-3 bottom-3 w-1.5 cursor-e-resize z-20 hover:bg-primary/20 rounded-full transition-colors" />
        <div onMouseDown={e => startResize(e, 'w')}  className="absolute left-0 top-3 bottom-3 w-1.5 cursor-w-resize z-20 hover:bg-primary/20 rounded-full transition-colors" />
        {/* Corners */}
        <div onMouseDown={e => startResize(e, 'nw')} className="absolute top-0 left-0 h-4 w-4 cursor-nw-resize z-20" />
        <div onMouseDown={e => startResize(e, 'ne')} className="absolute top-0 right-0 h-4 w-4 cursor-ne-resize z-20" />
        <div onMouseDown={e => startResize(e, 'sw')} className="absolute bottom-0 left-0 h-4 w-4 cursor-sw-resize z-20" />
        <div onMouseDown={e => startResize(e, 'se')} className="absolute bottom-0 right-0 h-4 w-4 cursor-se-resize z-20" />
      </>)}

      {/* ── Header ── */}
      <div
        onMouseDown={startDrag}
        className={clsx(
          'flex items-center gap-2 px-3 py-2.5 border-b border-border/50',
          'bg-gradient-to-r from-primary/10 to-primary/5',
          !ctx.isMaximized && 'cursor-grab active:cursor-grabbing',
        )}
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15">
          <Bot className="h-4 w-4 text-primary" />
        </div>
        <span className="text-sm font-semibold text-foreground flex-1 select-none">AI Copilot</span>

        {/* Chat count */}
        <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
          {chats.length} chat{chats.length !== 1 ? 's' : ''}
        </span>

        {/* Header actions */}
        <div className="flex items-center gap-0.5" onMouseDown={e => e.stopPropagation()}>
          <button onClick={() => { setShowHistory(h => !h); setShowPromptManager(false); }}
            className={clsx('p-1.5 rounded-lg transition-colors text-muted-foreground hover:text-foreground hover:bg-muted',
              showHistory && 'bg-muted text-foreground')}
            title="Chat history">
            <History className="h-3.5 w-3.5" />
          </button>
          <button onClick={newChat}
            className="p-1.5 rounded-lg transition-colors text-muted-foreground hover:text-foreground hover:bg-muted"
            title="New chat">
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => { setShowPromptManager(p => !p); setShowHistory(false); }}
            className={clsx('p-1.5 rounded-lg transition-colors text-muted-foreground hover:text-foreground hover:bg-muted',
              showPromptManager && 'bg-muted text-foreground')}
            title="Prompt library">
            <BookOpen className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={ctx.isMaximized ? ctx.restore : ctx.maximize}
            className="p-1.5 rounded-lg transition-colors text-muted-foreground hover:text-foreground hover:bg-muted"
            title={ctx.isMaximized ? 'Restore' : 'Maximize'}>
            {ctx.isMaximized ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
          <button onClick={ctx.close}
            className="p-1.5 rounded-lg transition-colors text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
            title="Close">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* History sidebar */}
        {showHistory && (
          <div className="w-52 border-r border-border/50 flex flex-col bg-muted/20 animate-slide-in-left overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">History</span>
              <button onClick={clearHistory} title="Clear all"
                className="p-1 rounded hover:bg-destructive/10 hover:text-destructive transition-colors">
                <Trash2 className="h-3 w-3 text-muted-foreground" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-1">
              {chats.map(chat => (
                <div key={chat.id}
                  onClick={() => { switchChat(chat.id); setShowHistory(false); }}
                  className={clsx(
                    'group flex items-start gap-1.5 px-2.5 py-2 cursor-pointer rounded-lg mx-1 transition-colors',
                    chat.id === activeChat?.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-foreground'
                  )}>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium truncate">{chat.title}</p>
                    <p className="text-[9px] text-muted-foreground mt-0.5 flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5" />
                      {relTime(chat.createdAt)}
                    </p>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); deleteChat(chat.id); }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:text-destructive transition-all flex-shrink-0">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Prompt manager */}
        {showPromptManager && (
          <div className="w-64 border-r border-border/50 flex flex-col bg-muted/20 animate-slide-in-left overflow-hidden">
            <div className="flex items-center gap-1 px-3 py-2 border-b border-border/50">
              <button onClick={() => setShowPromptManager(false)} className="p-0.5 rounded hover:bg-muted">
                <ChevronLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Prompt Library</span>
            </div>
            {/* Tabs */}
            <div className="flex border-b border-border/50">
              {(['global', 'page', 'mine'] as const).map(tab => (
                <button key={tab} onClick={() => setPromptTab(tab)}
                  className={clsx(
                    'flex-1 py-1.5 text-[10px] font-medium capitalize transition-colors',
                    promptTab === tab ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'
                  )}>
                  {tab === 'global' ? 'Global' : tab === 'page' ? 'Page' : 'Mine'}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto py-1">
              {promptTab === 'mine' && (
                <div className="px-2 py-1.5 border-b border-border/50 space-y-1.5">
                  <input
                    value={newPromptLabel} onChange={e => setNewPromptLabel(e.target.value)}
                    placeholder="Prompt label..."
                    className="w-full text-[11px] bg-background border border-border rounded px-2 py-1 outline-none focus:ring-1 focus:ring-ring" />
                  <textarea
                    value={newPromptContent} onChange={e => setNewPromptContent(e.target.value)}
                    placeholder="Prompt content..."
                    rows={2}
                    className="w-full text-[11px] bg-background border border-border rounded px-2 py-1 outline-none focus:ring-1 focus:ring-ring resize-none" />
                  <button onClick={addUserPrompt}
                    disabled={!newPromptLabel.trim() || !newPromptContent.trim()}
                    className="w-full text-[10px] bg-primary text-primary-foreground rounded py-1 font-medium disabled:opacity-40 transition-opacity hover:opacity-90">
                    Add Prompt
                  </button>
                </div>
              )}
              {(promptTab === 'global'
                ? ctx.currentPagePrompts.filter(p => p.id.startsWith('g'))
                : promptTab === 'page'
                  ? ctx.currentPagePrompts.filter(p => !p.id.startsWith('g') && !p.id.startsWith('u'))
                  : ctx.userPrompts
              ).map(p => (
                <div key={p.id}
                  className="group flex items-start gap-1.5 px-2.5 py-1.5 hover:bg-muted rounded-lg mx-1 cursor-pointer transition-colors"
                  onClick={() => { handlePromptClick(p); setShowPromptManager(false); }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium truncate">{p.label}</p>
                    <p className="text-[9px] text-muted-foreground truncate mt-0.5">{p.content.slice(0, 50)}…</p>
                  </div>
                  {p.id.startsWith('u_') && (
                    <button onClick={e => { e.stopPropagation(); ctx.deleteUserPrompt(p.id); }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:text-destructive flex-shrink-0">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
              {promptTab !== 'global' && (promptTab === 'page'
                ? ctx.currentPagePrompts.filter(p => !p.id.startsWith('g') && !p.id.startsWith('u')).length === 0
                : ctx.userPrompts.length === 0
              ) && (
                <p className="text-[10px] text-muted-foreground text-center py-4 px-3">
                  {promptTab === 'page' ? 'No page-specific prompts for this page.' : 'No custom prompts yet. Add one above.'}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Main chat area */}
        <div className="flex flex-1 flex-col overflow-hidden">

          {/* Prompt chips */}
          <div className="flex gap-1.5 px-3 py-2 overflow-x-auto border-b border-border/40 bg-muted/10 scrollbar-thin">
            {ctx.currentPagePrompts.slice(0, 6).map(p => (
              <button key={p.id} onClick={() => handlePromptClick(p)}
                className="flex-shrink-0 text-[10px] font-medium px-2.5 py-1 rounded-full
                  bg-primary/8 text-primary border border-primary/20
                  hover:bg-primary/15 transition-colors whitespace-nowrap">
                <Sparkles className="h-2.5 w-2.5 inline mr-1 opacity-70" />
                {p.label}
              </button>
            ))}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {messages.map(msg => (
              <div key={msg.id}
                className={clsx(
                  'flex gap-2 group animate-fade-in-up',
                  msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                )}>
                {/* Avatar */}
                <div className={clsx(
                  'h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
                  msg.role === 'user'
                    ? 'bg-primary/15 text-primary'
                    : msg.error
                      ? 'bg-red-500/15 text-red-500'
                      : 'bg-gradient-to-br from-primary/20 to-primary/10 text-primary'
                )}>
                  {msg.role === 'user'
                    ? <User className="h-3 w-3" />
                    : msg.error
                      ? <AlertCircle className="h-3 w-3" />
                      : <Bot className="h-3 w-3" />}
                </div>

                {/* Bubble */}
                <div className={clsx(
                  'max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed relative',
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-tr-sm'
                    : msg.error
                      ? 'bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20 rounded-tl-sm'
                      : 'bg-card border border-border/60 text-foreground rounded-tl-sm shadow-sm'
                )}>
                  <div className="prose prose-sm max-w-none text-inherit text-[13px]">
                    {renderMarkdown(msg.content)}
                  </div>
                  <div className="flex items-center justify-between mt-1.5 gap-2">
                    <span className="text-[9px] opacity-50">{relTime(msg.ts)}</span>
                    {msg.role === 'assistant' && <CopyButton text={msg.content} />}
                  </div>
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {isLoading && (
              <div className="flex gap-2 animate-fade-in-up">
                <div className="h-6 w-6 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot className="h-3 w-3 text-primary" />
                </div>
                <div className="bg-card border border-border/60 rounded-2xl rounded-tl-sm shadow-sm">
                  <TypingDots />
                </div>
              </div>
            )}

            {/* Error inline */}
            {error && !isLoading && (
              <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400 bg-red-500/8 rounded-lg px-3 py-2 border border-red-500/20">
                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                {error}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="px-3 pb-3 pt-2 border-t border-border/40 bg-background/60">
            {isLoading && (
              <button onClick={cancelStream}
                className="w-full mb-2 text-[10px] text-muted-foreground hover:text-foreground
                  bg-muted/60 rounded-lg py-1 transition-colors text-center">
                ⏹ Stop generating
              </button>
            )}
            <div className="flex items-end gap-2 bg-muted/40 rounded-xl border border-border/50
              focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all p-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Ask anything about BUPA sync…"
                rows={1}
                disabled={isLoading}
                className="flex-1 bg-transparent text-sm resize-none outline-none placeholder:text-muted-foreground/60
                  min-h-[24px] max-h-[96px] leading-6 disabled:opacity-50"
                style={{ height: `${Math.min(96, Math.max(24, (input.split('\n').length) * 24))}px` }}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className={clsx(
                  'h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all',
                  input.trim() && !isLoading
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm hover:shadow-md'
                    : 'bg-muted text-muted-foreground cursor-not-allowed'
                )}>
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="text-[9px] text-muted-foreground/50 mt-1 text-center">
              Enter to send · Shift+Enter for new line
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
