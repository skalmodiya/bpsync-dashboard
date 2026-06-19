import { useEffect, useState, type ReactNode } from 'react';

// The AppRouter handles authentication — this guard just cleans up
// any leftover error fragments from failed auth attempts and shows
// a loading screen while the app initializes.
export function getXsuaaToken(): string | null {
  // Token management is handled by the AppRouter session cookie —
  // the frontend doesn't need to manage tokens directly.
  return null;
}

interface AuthGuardProps {
  children: ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Clear error fragments and redirect /index.html → / for SPA routing
    if (window.location.hash.includes('error=')) {
      window.history.replaceState(null, '', window.location.pathname);
    }
    if (window.location.pathname === '/index.html') {
      window.history.replaceState(null, '', '/');
    }
    setReady(true);
  }, []);

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-[#2d1bb5] to-[#a020c0]">
        <div className="flex gap-1">
          {[0,1,2].map(i => (
            <div key={i} className="h-2 w-2 rounded-full bg-white/60 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
