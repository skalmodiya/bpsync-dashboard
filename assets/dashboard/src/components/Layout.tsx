import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { ToastContainer } from './Toast';

export function Layout() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden bg-background p-6">
        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </main>
      <ToastContainer />
    </div>
  );
}
