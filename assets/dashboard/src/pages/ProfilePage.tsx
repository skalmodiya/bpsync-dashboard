import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Card } from '../components/Card';
import { api } from '../lib/api';
import { User, Mail, Shield, Globe, Code, Eye, EyeOff } from 'lucide-react';

interface ProfileData {
  user_id: string;
  name: string;
  email: string;
  given_name?: string;
  family_name?: string;
  global_user_id?: string;
  groups?: string[];
  ias_tenant?: string;
  raw_userinfo?: Record<string, any> | null;
}

// All possible profile fields with labels
const PROFILE_FIELDS = [
  { key: 'user_id', label: 'User ID', icon: User },
  { key: 'global_user_id', label: 'Global User ID', icon: Globe },
  { key: 'given_name', label: 'Given Name', icon: User },
  { key: 'family_name', label: 'Family Name', icon: User },
  { key: 'name', label: 'Display Name', icon: User },
  { key: 'email', label: 'Email', icon: Mail },
  { key: 'ias_tenant', label: 'IAS Tenant', icon: Globe },
] as const;

export function ProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [visibleFields, setVisibleFields] = useState<Set<string>>(
    new Set(PROFILE_FIELDS.map((f) => f.key))
  );
  const [showFieldConfig, setShowFieldConfig] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    const res = await api.get<ProfileData>('/api/auth/profile');
    if (res.ok && res.data) {
      setProfile(res.data);
    } else {
      if (user) {
        setProfile({ user_id: user.user_id, name: user.name, email: user.email });
      }
    }
    setLoading(false);
  };

  const toggleField = (key: string) => {
    setVisibleFields((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Profile</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your identity information from SAP Identity Authentication Service
          </p>
        </div>
        <button
          onClick={() => setShowFieldConfig(!showFieldConfig)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground border border-border rounded-md px-2 py-1"
        >
          {showFieldConfig ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          Configure Fields
        </button>
      </div>

      {/* Field Visibility Config */}
      {showFieldConfig && (
        <Card title="Visible Fields" description="Select which fields to display on your profile">
          <div className="grid grid-cols-2 gap-2">
            {PROFILE_FIELDS.map((f) => (
              <label key={f.key} className="flex items-center gap-2 text-sm cursor-pointer py-1">
                <input
                  type="checkbox"
                  checked={visibleFields.has(f.key)}
                  onChange={() => toggleField(f.key)}
                  className="h-3.5 w-3.5"
                />
                {f.label}
              </label>
            ))}
          </div>
        </Card>
      )}

      {/* User Info + Raw JSON side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Info Card */}
        <Card title="User Information" description="Basic identity details from IAS">
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">{profile?.name || 'Unknown'}</h2>
                <p className="text-sm text-muted-foreground">{profile?.email || 'No email'}</p>
              </div>
            </div>

            <div className="grid gap-3">
              {PROFILE_FIELDS.filter((f) => visibleFields.has(f.key)).map((f) => (
                <InfoRow
                  key={f.key}
                  icon={f.icon}
                  label={f.label}
                  value={(profile as any)?.[f.key] || '—'}
                />
              ))}
            </div>
          </div>
        </Card>

        {/* Raw JSON - always expanded */}
        <Card title="Raw IAS Response" description="Full userinfo JSON received from SAP IAS">
          <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
            <Code className="h-3.5 w-3.5" />
            <span>oauth2/userinfo response</span>
          </div>
          <pre className="p-4 bg-muted/50 rounded-md border border-border text-xs overflow-auto max-h-[500px] font-mono leading-relaxed">
            {profile?.raw_userinfo
              ? JSON.stringify(profile.raw_userinfo, null, 2)
              : '// No raw data available (IAS userinfo not fetched)'}
          </pre>
        </Card>
      </div>

      {/* Group Assignments */}
      {profile?.groups && profile.groups.length > 0 && (
        <Card title="Group Assignments" description="IAS user group memberships">
          <div className="overflow-hidden rounded-md border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">#</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Group Name</th>
                </tr>
              </thead>
              <tbody>
                {profile.groups.map((group, idx) => (
                  <tr key={group} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-2 text-muted-foreground">{idx + 1}</td>
                    <td className="px-4 py-2 flex items-center gap-2">
                      <Shield className="h-3 w-3 text-muted-foreground" />
                      {group}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {profile.groups.length} group{profile.groups.length !== 1 ? 's' : ''} assigned
          </p>
        </Card>
      )}
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-border last:border-0">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm font-medium w-36">{label}</span>
      <span className="text-sm text-muted-foreground break-all">{value}</span>
    </div>
  );
}
