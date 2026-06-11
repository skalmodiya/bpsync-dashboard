import { useEffect, useState } from 'react';
import { useAgent } from '../hooks/useAgent';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { StatusBadge } from '../components/StatusBadge';
import { Input } from '../components/Input';
import { api } from '../lib/api';
import { RefreshCw, Send, Bot, Clock, Zap } from 'lucide-react';

export function AgentPage() {
  const { health, info, invocations, setInvocations, loading, error, checkHealth, fetchInfo, fetchInvocations, invokeAgent } =
    useAgent();
  const [message, setMessage] = useState('');
  const [invoking, setInvoking] = useState(false);
  const [agentResponse, setAgentResponse] = useState<string | null>(null);

  useEffect(() => {
    checkHealth();
    fetchInfo();
    fetchInvocations();
  }, [checkHealth, fetchInfo, fetchInvocations]);

  const handleInvoke = async () => {
    if (!message.trim()) return;
    setInvoking(true);
    setAgentResponse(null);
    const response = await invokeAgent(message);
    if (response) {
      setAgentResponse(response);
    }
    setInvoking(false);
    setMessage('');
  };

  const formatTimestamp = (iso: string) => new Date(iso).toLocaleString();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Agent Status</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor agent health and test invocations
          </p>
        </div>
        <Button variant="outline" onClick={checkHealth} loading={loading}>
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Health Status */}
        <Card title="Health Status">
          <div className="flex flex-col items-center gap-3 py-4">
            <div
              className={`flex h-16 w-16 items-center justify-center rounded-full ${
                health?.status === 'healthy'
                  ? 'bg-emerald-100 dark:bg-emerald-900/30'
                  : health?.status === 'degraded'
                  ? 'bg-yellow-100 dark:bg-yellow-900/30'
                  : 'bg-red-100 dark:bg-red-900/30'
              }`}
            >
              <Bot
                className={`h-8 w-8 ${
                  health?.status === 'healthy'
                    ? 'text-emerald-600'
                    : health?.status === 'degraded'
                    ? 'text-yellow-600'
                    : 'text-red-600'
                }`}
              />
            </div>
            <StatusBadge
              status={health?.status || 'offline'}
              pulse={health?.status === 'healthy'}
            />
            {health?.lastCheck && (
              <p className="text-xs text-muted-foreground">
                Last check: {formatTimestamp(health.lastCheck)}
              </p>
            )}
          </div>
        </Card>

        {/* Agent Info */}
        <Card title="Agent Info" className="md:col-span-2">
          {info ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Name:</span>
                  <p className="font-medium">{info.name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Version:</span>
                  <p className="font-medium">{info.version}</p>
                </div>
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">Description:</span>
                <p className="mt-1">{info.description}</p>
              </div>
              {info.capabilities.length > 0 && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Capabilities:</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {info.capabilities.map((cap) => (
                      <span
                        key={cap}
                        className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs"
                      >
                        {cap}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground py-4 text-center">
              {loading ? 'Loading agent info...' : 'Agent info unavailable. Check if agent is running.'}
            </div>
          )}
        </Card>
      </div>

      {/* Test Agent */}
      <Card title="Test Agent" description="Send a test message to the agent">
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type a message to test the agent..."
                onKeyDown={(e) => e.key === 'Enter' && handleInvoke()}
              />
            </div>
            <Button onClick={handleInvoke} loading={invoking} disabled={!message.trim()}>
              <Send className="h-4 w-4" />
              Send
            </Button>
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
          )}

          {agentResponse && (
            <div className="rounded-md bg-muted p-4">
              <p className="text-xs font-medium text-muted-foreground mb-2">Agent Response:</p>
              <p className="text-sm whitespace-pre-wrap">{agentResponse}</p>
            </div>
          )}
        </div>
      </Card>

      {/* Invocation Log */}
      <Card title="Recent Invocations" description="History of agent interactions">
        {invocations.length > 0 && (
          <div className="flex justify-end mb-3">
            <button
              onClick={() => {
                if (window.confirm('Clear all invocation history?')) {
                  setInvocations([]);
                  api.delete('/api/agent/invocations');
                }
              }}
              className="text-xs text-muted-foreground hover:text-red-500 transition-colors"
            >
              Clear All
            </button>
          </div>
        )}
        {invocations.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center">
            No invocations recorded yet.
          </div>
        ) : (
          <div className="space-y-3">
            {invocations.filter(Boolean).map((inv) => (
              <div
                key={inv.id || Math.random()}
                className="rounded-md border border-border p-3 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {inv.timestamp ? formatTimestamp(inv.timestamp) : 'Unknown time'}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Zap className="h-3 w-3" />
                      {inv.tokenUsage?.total || 0} tokens
                    </span>
                    <span>{inv.duration || 0}ms</span>
                  </div>
                </div>
                <div className="text-sm">
                  <p className="font-medium truncate">{inv.message || ''}</p>
                  <p className="text-muted-foreground mt-1 text-xs line-clamp-2">{inv.response || ''}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
