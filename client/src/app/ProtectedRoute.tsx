import { type ReactNode, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useConnectionStatus } from '@/features/connection/useNATS';

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { data: status, isLoading } = useConnectionStatus();
  const wasConnected = useRef(false);
  const connected = !!status?.connected;

  useEffect(() => {
    if (connected) {
      wasConnected.current = true;
    } else if (wasConnected.current) {
      toast.error('Connection to NATS lost', {
        description: 'The dashboard keeps trying to reconnect.',
      });
    }
  }, [connected]);

  // Show loading state while checking connection
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary" />
      </div>
    );
  }

  // The server dials its one NATS by itself; there is nothing to log in to.
  if (!connected) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-lg font-semibold text-foreground">
          NATS is not reachable
        </p>
        <p className="text-sm text-muted-foreground">
          The dashboard server keeps trying to connect; this page refreshes on
          its own.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
