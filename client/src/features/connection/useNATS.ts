import { useQuery } from '@tanstack/react-query';
import { natsApi } from '@/lib/api';

// Query keys
export const queryKeys = {
  nats: {
    all: ['nats'] as const,
    status: () => [...queryKeys.nats.all, 'status'] as const,
    info: () => [...queryKeys.nats.all, 'info'] as const,
    account: () => [...queryKeys.nats.all, 'account'] as const,
  },
};

// Connection status query
export function useConnectionStatus() {
  return useQuery({
    queryKey: queryKeys.nats.status(),
    queryFn: natsApi.getStatus,
    staleTime: 1000, // Consider data stale after 1 second
    refetchInterval: 5000, // Refetch every 5 seconds
    retry: false, // Don't retry on connection errors
  });
}

// NATS server info query (only when connected)
export function useNATSInfo(enabled = true) {
  return useQuery({
    queryKey: queryKeys.nats.info(),
    queryFn: natsApi.getInfo,
    enabled,
    staleTime: 2000,
    refetchInterval: 5000,
    retry: 1,
  });
}

// Account info query (only when connected)
export function useAccountInfo(enabled = true) {
  return useQuery({
    queryKey: queryKeys.nats.account(),
    queryFn: natsApi.getAccountInfo,
    enabled,
    staleTime: 2000,
    refetchInterval: 5000,
    retry: 1,
  });
}
