import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { ToastContainer } from './Toast';
import { CopilotWidget } from './copilot/CopilotWidget';
import { useDashboardConfig } from '../hooks/useDashboardConfig';
import { useEffect } from 'react';

export function Layout() {
  const location = useLocation();
  const { config } = useDashboardConfig();

  // Apply custom background color as a CSS variable override on the root element
  useEffect(() => {
    const root = document.documentElement;
    if (config.bgColor) {
      // Convert hex to HSL for the CSS variable
      root.style.setProperty('--background-override', config.bgColor);
      document.body.style.backgroundColor = config.bgColor;
    } else {
      root.style.removeProperty('--background-override');
      document.body.style.removeProperty('backgroundColor');
    }
    return () => {
      root.style.removeProperty('--background-override');
      document.body.style.removeProperty('backgroundColor');
    };
  }, [config.bgColor]);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Ambient background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-secondary/40 pointer-events-none" />
        {/* Subtle glow orbs */}
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -left-16 w-80 h-80 bg-primary/3 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex-1 overflow-y-auto px-5 py-5">
          <div key={location.pathname} className="animate-fade-in-up h-full">
            <Outlet />
          </div>
        </div>

        {/* AI Copilot widget — floats above everything */}
        <CopilotWidget />
      </main>
      <ToastContainer />
    </div>
  );
}
