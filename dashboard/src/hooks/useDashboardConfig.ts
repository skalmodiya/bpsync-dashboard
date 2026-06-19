import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

export interface DashboardCardConfig {
  id: string;
  label: string;
  dataKey: string;
  icon: string;
  iconSize: 'sm' | 'md' | 'lg' | 'xl';
  iconPosition: 'top' | 'left' | 'inline';
  textAlign: 'left' | 'center' | 'right';
  color: string;
  visible: boolean;
  order: number;
}

export interface DashboardConfig {
  title: string;
  autoRefresh: boolean;
  refreshInterval: number;
  numberFormat: 'full' | 'compact';
  errorBreakdownStyle: 'bar' | 'list' | 'hidden';
  errorBreakdownLimit: number;
  bgColor?: string;
  logoUrl?: string;
  headerGradient?: {
    from: string;  // hex, default #2d1bb5
    via: string;   // hex, default #6a1bbf
    to: string;    // hex, default #a020c0
  };
  cards: DashboardCardConfig[];
}

export const DEFAULT_CARDS: DashboardCardConfig[] = [
  {
    id: 'total-employees',
    label: 'Total Employees',
    dataKey: 'total_employees',
    icon: 'Users',
    iconSize: 'md',
    iconPosition: 'left',
    textAlign: 'left',
    color: 'blue',
    visible: true,
    order: 0,
  },
  {
    id: 'synced',
    label: 'Synced',
    dataKey: 'synced_count',
    icon: 'CheckCircle',
    iconSize: 'md',
    iconPosition: 'left',
    textAlign: 'left',
    color: 'green',
    visible: true,
    order: 1,
  },
  {
    id: 'failed',
    label: 'Failed',
    dataKey: 'failed_count',
    icon: 'AlertTriangle',
    iconSize: 'md',
    iconPosition: 'left',
    textAlign: 'left',
    color: 'red',
    visible: true,
    order: 2,
  },
  {
    id: 'pending',
    label: 'Pending',
    dataKey: 'pending_count',
    icon: 'Clock',
    iconSize: 'md',
    iconPosition: 'left',
    textAlign: 'left',
    color: 'orange',
    visible: true,
    order: 3,
  },
  {
    id: 'error-rate',
    label: 'Error Rate',
    dataKey: 'error_rate',
    icon: 'Percent',
    iconSize: 'md',
    iconPosition: 'left',
    textAlign: 'left',
    color: 'purple',
    visible: true,
    order: 4,
  },
  {
    id: 'bp-count',
    label: 'Business Partners',
    dataKey: 'bp_count',
    icon: 'Building',
    iconSize: 'md',
    iconPosition: 'left',
    textAlign: 'left',
    color: 'blue',
    visible: false,
    order: 5,
  },
  {
    id: 'vendor-count',
    label: 'Employee Vendors',
    dataKey: 'vendor_count',
    icon: 'Truck',
    iconSize: 'md',
    iconPosition: 'left',
    textAlign: 'left',
    color: 'orange',
    visible: false,
    order: 6,
  },
  {
    id: 'open-errors',
    label: 'Open Errors',
    dataKey: 'open_errors',
    icon: 'AlertCircle',
    iconSize: 'md',
    iconPosition: 'left',
    textAlign: 'left',
    color: 'red',
    visible: false,
    order: 7,
  },
  {
    id: 'resolved-errors',
    label: 'Resolved',
    dataKey: 'resolved_errors',
    icon: 'CheckCheck',
    iconSize: 'md',
    iconPosition: 'left',
    textAlign: 'left',
    color: 'green',
    visible: false,
    order: 8,
  },
  {
    id: 'last-sync',
    label: 'Last Sync',
    dataKey: 'last_sync_time',
    icon: 'Calendar',
    iconSize: 'md',
    iconPosition: 'left',
    textAlign: 'left',
    color: 'primary',
    visible: false,
    order: 9,
  },
];

export const DEFAULT_CONFIG: DashboardConfig = {
  title: 'Sync Overview',
  autoRefresh: true,
  refreshInterval: 10,
  numberFormat: 'full',
  errorBreakdownStyle: 'bar',
  errorBreakdownLimit: 5,
  cards: DEFAULT_CARDS,
};

export function useDashboardConfig() {
  const [config, setConfig] = useState<DashboardConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    const res = await api.get<DashboardConfig>('/api/settings/dashboard');
    if (res.ok && res.data && Object.keys(res.data).length > 0) {
      // Merge with defaults to handle missing keys
      setConfig({
        ...DEFAULT_CONFIG,
        ...res.data,
        cards: res.data.cards && res.data.cards.length > 0
          ? res.data.cards
          : DEFAULT_CONFIG.cards,
      });
    }
    setLoading(false);
  }, []);

  const updateConfig = useCallback(async (newConfig: DashboardConfig) => {
    setSaving(true);
    setConfig(newConfig);
    const res = await api.put<{ status: string }>('/api/settings/dashboard', newConfig);
    setSaving(false);
    return res.ok;
  }, []);

  const resetConfig = useCallback(async () => {
    setSaving(true);
    setConfig(DEFAULT_CONFIG);
    const res = await api.put<{ status: string }>('/api/settings/dashboard', DEFAULT_CONFIG);
    setSaving(false);
    return res.ok;
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  return { config, loading, saving, updateConfig, resetConfig };
}
