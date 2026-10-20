import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { streamsApi } from '@/lib/api';
import { showErrorToast, showSuccessToast } from '@/lib/error-utils';

export const streamKeys = {
  all: ['streams'] as const,
  detail: (name: string) => [...streamKeys.all, 'detail', name] as const,
  consumers: (name: string) => [...streamKeys.all, 'consumers', name] as const,
  messages: (name: string, page: number, limit: number, search: string) =>
    [...streamKeys.all, 'messages', name, page, limit, search] as const,
};

export function useStreams() {
  return useQuery({
    queryKey: streamKeys.all,
    queryFn: streamsApi.getStreams,
    refetchInterval: 30000,
  });
}

export function useStream(name: string | undefined) {
  return useQuery({
    queryKey: streamKeys.detail(name ?? ''),
    queryFn: () => streamsApi.getStream(name!),
    enabled: !!name,
  });
}

/** A stream's readers, refreshed every 5 s so their backlog stays live. */
export function useStreamConsumers(name: string | undefined) {
  return useQuery({
    queryKey: streamKeys.consumers(name ?? ''),
    queryFn: () => streamsApi.getConsumers(name!),
    enabled: !!name,
    refetchInterval: 5000,
  });
}

// `page` is zero-based; the API takes a message offset.
export function useStreamMessages(
  name: string,
  page: number,
  limit: number,
  search: string,
  enabled: boolean
) {
  return useQuery({
    queryKey: streamKeys.messages(name, page, limit, search),
    queryFn: () =>
      streamsApi.getStreamMessages(name, page * limit, limit, search),
    enabled,
  });
}

export function useCreateStream() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: streamsApi.createStream,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: streamKeys.all, exact: true });
      showSuccessToast(
        'Stream created successfully!',
        'The new stream is now available for publishing messages'
      );
    },
    onError: (error) =>
      showErrorToast(
        'create stream',
        error,
        'Failed to create stream. Please try again.'
      ),
  });
}

export function useDeleteStream() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: streamsApi.deleteStream,
    onSuccess: (_, name) => {
      queryClient.invalidateQueries({ queryKey: streamKeys.all, exact: true });
      queryClient.removeQueries({ queryKey: streamKeys.detail(name) });
      queryClient.removeQueries({
        queryKey: [...streamKeys.all, 'messages', name],
      });
      showSuccessToast(
        'Stream deleted successfully!',
        'All associated messages and consumers have been removed'
      );
    },
    onError: (error) =>
      showErrorToast(
        'delete stream',
        error,
        'Failed to delete stream. Please try again.'
      ),
  });
}
