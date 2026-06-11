import { useState } from 'react';
import { X, Plus, Trash2, GripVertical, RotateCcw, Save } from 'lucide-react';
import { clsx } from 'clsx';
import { Button } from './Button';
import { AVAILABLE_ICONS } from './DashboardCard';
import type { DashboardConfig, DashboardCardConfig } from '../hooks/useDashboardConfig';

const COLORS = ['blue', 'green', 'red', 'orange', 'purple', 'primary'];
const ICON_SIZES: Array<DashboardCardConfig['iconSize']> = ['sm', 'md', 'lg', 'xl'];
const ICON_POSITIONS: Array<DashboardCardConfig['iconPosition']> = ['top', 'left', 'inline'];
const TEXT_ALIGNS: Array<DashboardCardConfig['textAlign']> = ['left', 'center', 'right'];
const ERROR_STYLES: Array<DashboardConfig['errorBreakdownStyle']> = ['bar', 'list', 'hidden'];

interface ConfigPanelProps {
  config: DashboardConfig;
  open: boolean;
  onClose: () => void;
  onSave: (config: DashboardConfig) => void;
  onReset: () => void;
  saving: boolean;
}

export function ConfigPanel({ config, open, onClose, onSave, onReset, saving }: ConfigPanelProps) {
  const [draft, setDraft] = useState<DashboardConfig>(config);
  const [activeTab, setActiveTab] = useState<'general' | 'cards' | 'sections'>('general');

  // Sync draft when config changes from outside
  if (JSON.stringify(config) !== JSON.stringify(draft) && !open) {
    // Only reset draft when panel opens
  }

  const handleOpen = () => {
    setDraft(config);
  };

  // Reset draft on open
  if (open && JSON.stringify(draft) !== JSON.stringify(config) && draft === config) {
    handleOpen();
  }

  const updateCard = (id: string, updates: Partial<DashboardCardConfig>) => {
    setDraft((d) => ({
      ...d,
      cards: d.cards.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    }));
  };

  const removeCard = (id: string) => {
    setDraft((d) => ({
      ...d,
      cards: d.cards.filter((c) => c.id !== id),
    }));
  };

  const addCard = () => {
    const newId = `custom-${Date.now()}`;
    setDraft((d) => ({
      ...d,
      cards: [
        ...d.cards,
        {
          id: newId,
          label: 'New Card',
          dataKey: 'total_employees',
          icon: 'Activity',
          iconSize: 'md' as const,
          iconPosition: 'left' as const,
          textAlign: 'left' as const,
          color: 'primary',
          visible: true,
          order: d.cards.length,
        },
      ],
    }));
  };

  const moveCard = (id: string, direction: 'up' | 'down') => {
    setDraft((d) => {
      const cards = [...d.cards];
      const idx = cards.findIndex((c) => c.id === id);
      if (idx < 0) return d;
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= cards.length) return d;
      [cards[idx], cards[swapIdx]] = [cards[swapIdx], cards[idx]];
      return { ...d, cards: cards.map((c, i) => ({ ...c, order: i })) };
    });
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-background border-l border-border shadow-xl z-50 flex flex-col overflow-hidden animate-in slide-in-from-right">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">Customize Dashboard</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-accent transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          {(['general', 'cards', 'sections'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={clsx(
                'flex-1 py-2.5 text-sm font-medium transition-colors',
                activeTab === tab
                  ? 'border-b-2 border-primary text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {activeTab === 'general' && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium block mb-1.5">Dashboard Title</label>
                <input
                  type="text"
                  value={draft.title}
                  onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium">Auto-Refresh</label>
                  <p className="text-xs text-muted-foreground">Automatically fetch new data</p>
                </div>
                <button
                  onClick={() => setDraft((d) => ({ ...d, autoRefresh: !d.autoRefresh }))}
                  className={clsx(
                    'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                    draft.autoRefresh ? 'bg-primary' : 'bg-muted'
                  )}
                >
                  <span
                    className={clsx(
                      'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                      draft.autoRefresh ? 'translate-x-6' : 'translate-x-1'
                    )}
                  />
                </button>
              </div>

              {draft.autoRefresh && (
                <div>
                  <label className="text-sm font-medium block mb-1.5">
                    Refresh Interval (seconds)
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={300}
                    value={draft.refreshInterval}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        refreshInterval: Math.max(5, parseInt(e.target.value) || 10),
                      }))
                    }
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              )}

              <div>
                <label className="text-sm font-medium block mb-1.5">Number Format</label>
                <select
                  value={draft.numberFormat}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, numberFormat: e.target.value as 'full' | 'compact' }))
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="full">Full (1,234)</option>
                  <option value="compact">Compact (1.2k)</option>
                </select>
              </div>
            </div>
          )}

          {activeTab === 'cards' && (
            <div className="space-y-3">
              {draft.cards
                .sort((a, b) => a.order - b.order)
                .map((card) => (
                  <div
                    key={card.id}
                    className="border border-border rounded-lg p-3 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{card.label}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => moveCard(card.id, 'up')}
                          className="p-1 text-xs rounded hover:bg-accent"
                          title="Move up"
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => moveCard(card.id, 'down')}
                          className="p-1 text-xs rounded hover:bg-accent"
                          title="Move down"
                        >
                          ↓
                        </button>
                        <button
                          onClick={() => updateCard(card.id, { visible: !card.visible })}
                          className={clsx(
                            'px-2 py-0.5 text-xs rounded',
                            card.visible
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                              : 'bg-muted text-muted-foreground'
                          )}
                        >
                          {card.visible ? 'Visible' : 'Hidden'}
                        </button>
                        <button
                          onClick={() => removeCard(card.id)}
                          className="p-1 rounded hover:bg-destructive/10 text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">Label</label>
                        <input
                          type="text"
                          value={card.label}
                          onChange={(e) => updateCard(card.id, { label: e.target.value })}
                          className="w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">Data Key</label>
                        <input
                          type="text"
                          value={card.dataKey}
                          onChange={(e) => updateCard(card.id, { dataKey: e.target.value })}
                          className="w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">Icon</label>
                        <select
                          value={card.icon}
                          onChange={(e) => updateCard(card.id, { icon: e.target.value })}
                          className="w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                        >
                          {AVAILABLE_ICONS.map((name) => (
                            <option key={name} value={name}>
                              {name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">Icon Size</label>
                        <select
                          value={card.iconSize}
                          onChange={(e) =>
                            updateCard(card.id, { iconSize: e.target.value as DashboardCardConfig['iconSize'] })
                          }
                          className="w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                        >
                          {ICON_SIZES.map((s) => (
                            <option key={s} value={s}>
                              {s.toUpperCase()}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">
                          Icon Position
                        </label>
                        <select
                          value={card.iconPosition}
                          onChange={(e) =>
                            updateCard(card.id, {
                              iconPosition: e.target.value as DashboardCardConfig['iconPosition'],
                            })
                          }
                          className="w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                        >
                          {ICON_POSITIONS.map((p) => (
                            <option key={p} value={p}>
                              {p.charAt(0).toUpperCase() + p.slice(1)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">
                          Text Align
                        </label>
                        <select
                          value={card.textAlign}
                          onChange={(e) =>
                            updateCard(card.id, {
                              textAlign: e.target.value as DashboardCardConfig['textAlign'],
                            })
                          }
                          className="w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                        >
                          {TEXT_ALIGNS.map((a) => (
                            <option key={a} value={a}>
                              {a.charAt(0).toUpperCase() + a.slice(1)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs text-muted-foreground block mb-1">Color</label>
                        <div className="flex gap-1.5">
                          {COLORS.map((c) => (
                            <button
                              key={c}
                              onClick={() => updateCard(card.id, { color: c })}
                              className={clsx(
                                'h-6 w-6 rounded-full border-2 transition-all',
                                c === 'blue' && 'bg-blue-500',
                                c === 'green' && 'bg-emerald-500',
                                c === 'red' && 'bg-red-500',
                                c === 'orange' && 'bg-orange-500',
                                c === 'purple' && 'bg-purple-500',
                                c === 'primary' && 'bg-slate-500',
                                card.color === c
                                  ? 'border-foreground scale-110'
                                  : 'border-transparent'
                              )}
                              title={c}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

              <button
                onClick={addCard}
                className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-border rounded-lg text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Add Card
              </button>
            </div>
          )}

          {activeTab === 'sections' && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium block mb-1.5">Error Breakdown Style</label>
                <select
                  value={draft.errorBreakdownStyle}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      errorBreakdownStyle: e.target.value as DashboardConfig['errorBreakdownStyle'],
                    }))
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {ERROR_STYLES.map((s) => (
                    <option key={s} value={s}>
                      {s === 'bar' ? 'Horizontal Bars' : s === 'list' ? 'Simple List' : 'Hidden'}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-muted-foreground">
                The error breakdown section shows errors grouped by category. Choose how to display them or hide the section entirely.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border p-4 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={onReset}>
            <RotateCcw className="h-4 w-4" />
            Reset Defaults
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={saving}
              onClick={() => onSave(draft)}
            >
              <Save className="h-4 w-4" />
              Save
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
