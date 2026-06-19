import { useState, useEffect } from 'react';
import { PageHeader } from '../components/PageHeader';
import { Card } from '../components/Card';
import { api } from '../lib/api';
import { User, Mail, Hash, Shield, Clock, Building2, CheckCircle, AlertCircle } from 'lucide-react';

interface UserProfile {
  user_id: string;
  name: string;
  email: string;
  given_name: string;
  family_name: string;
  scopes?: string[];
  zone_id?: string;
  client_id?: string;
  iat?: number;
  exp?: number;
}

function Avatar({ name, email }: { name: string; email: string }) {
  const initials = name
    ? name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
    : (email?.[0] || 'U').toUpperCase();

  return (
    <div className="relative mx-auto w-24 h-24">
      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-purple-600
        flex items-center justify-center text-white text-3xl font-bold shadow-xl
        ring-4 ring-white/20">
        {initials}
      </div>
      <span className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-green-500
        border-2 border-background flex items-center justify-center">
        <CheckCircle className="w-3 h-3 text-white" />
      </span>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-3 py-3 border-b border-border/50 last:border-0">
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground truncate">{value}</p>
      </div>
    </div>
  );
}

function formatTime(unix?: number) {
  if (!unix) return '';
  return new Date(unix * 1000).toLocaleString();
}

export function ProfilePage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<UserProfile>('/api/me').then(res => {
      if (res.ok && res.data) setUser(res.data);
      else setError(res.error || 'Failed to load profile');
      setLoading(false);
    });
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="My Profile"
        subtitle="Your account information from SAP Identity Authentication"
      />

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="flex gap-1.5">
            {[0,1,2].map(i => (
              <div key={i} className="w-2 h-2 rounded-full bg-primary animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
      )}

      {error && (
        <Card className="p-6 flex items-center gap-3 text-destructive">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm">{error}</p>
        </Card>
      )}

      {user && !loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Identity card */}
          <Card className="p-6 flex flex-col items-center gap-4 text-center">
            <Avatar name={user.name} email={user.email} />
            <div>
              <h2 className="text-xl font-semibold text-foreground">{user.name || '—'}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">{user.email || 'No email'}</p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full
              bg-green-500/10 text-green-600 text-xs font-medium border border-green-500/20">
              <CheckCircle className="w-3 h-3" />
              Authenticated
            </span>
          </Card>

          {/* Details */}
          <Card className="p-6 md:col-span-2">
            <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
              <User className="w-4 h-4 text-primary" />
              Account Details
            </h3>
            <div>
              <InfoRow icon={User} label="Full Name" value={user.name} />
              <InfoRow icon={Mail} label="Email Address" value={user.email} />
              <InfoRow icon={Hash} label="Given Name" value={user.given_name} />
              <InfoRow icon={Hash} label="Family Name" value={user.family_name} />
              <InfoRow icon={Shield} label="User ID" value={user.user_id} />
              {user.client_id && <InfoRow icon={Building2} label="Client ID" value={user.client_id} />}
              {user.zone_id && <InfoRow icon={Building2} label="Zone / Tenant" value={user.zone_id} />}
              {user.iat && <InfoRow icon={Clock} label="Session Started" value={formatTime(user.iat)} />}
              {user.exp && <InfoRow icon={Clock} label="Session Expires" value={formatTime(user.exp)} />}
            </div>
          </Card>

          {/* Scopes */}
          {user.scopes && user.scopes.length > 0 && (
            <Card className="p-6 md:col-span-3">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                Authorization Scopes
              </h3>
              <div className="flex flex-wrap gap-2">
                {user.scopes.map(scope => (
                  <span key={scope}
                    className="px-2.5 py-1 rounded-md bg-primary/10 text-primary text-xs font-mono border border-primary/20">
                    {scope}
                  </span>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
