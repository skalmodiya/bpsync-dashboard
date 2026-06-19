import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { CopilotProvider } from './components/copilot/CopilotContext';
import { AuthGuard } from './components/AuthGuard';
import { DashboardPage } from './pages/DashboardPage';
import { RecordsPage } from './pages/RecordsPage';
import { WorkflowsPage } from './pages/WorkflowsPage';
import { AgentPage } from './pages/AgentPage';
import { SettingsPage } from './pages/SettingsPage';
import { AuditPage } from './pages/AuditPage';
import { MethodologyPage } from './pages/MethodologyPage';
import { ProcessPage } from './pages/ProcessPage';
import { ApiReferencePage } from './pages/ApiReferencePage';
import { ProfilePage } from './pages/ProfilePage';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthGuard>
        <CopilotProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/records" element={<RecordsPage />} />
              <Route path="/workflows" element={<WorkflowsPage />} />
              <Route path="/agent" element={<AgentPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/audit" element={<AuditPage />} />
              <Route path="/methodology" element={<MethodologyPage />} />
              <Route path="/process" element={<ProcessPage />} />
              <Route path="/api-reference" element={<ApiReferencePage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </CopilotProvider>
      </AuthGuard>
    </BrowserRouter>
  </React.StrictMode>
);
