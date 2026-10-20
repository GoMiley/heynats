import {
  Hash,
  Layers,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState, LoadingState, PageIntro } from '@/components/PageStates';
import { StatsCard } from '@/components/StatsCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { StreamConfig } from '@/lib/api';
import { serverConfig } from '@/lib/config';
import { useSearchQuery } from '@/lib/useSearchQuery';
import { cn } from '@/lib/utils';
import { CreateStreamModal } from './CreateStreamModal';
import { StreamsTable } from './StreamsTable';
import { useCreateStream, useDeleteStream, useStreams } from './useStreams';
import { ViewStreamDataModal } from './ViewStreamDataModal';

export function StreamsPage() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [browsing, setBrowsing] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useSearchQuery();
  const [streamToDelete, setStreamToDelete] = useState<string | null>(null);

  const {
    data: streamsData,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useStreams();
  const createStreamMutation = useCreateStream();
  const deleteStreamMutation = useDeleteStream();

  const streams = streamsData?.streams || [];
  const q = searchTerm.toLowerCase();
  const filteredStreams = streams.filter(
    (stream) =>
      (stream.config?.name || '').toLowerCase().includes(q) ||
      stream.config?.subjects?.some((subject) =>
        subject.toLowerCase().includes(q)
      )
  );

  const sum = (pick: (s: (typeof streams)[number]) => number) =>
    streams.reduce((total, s) => total + pick(s), 0);

  const handleCreateStream = async (config: Partial<StreamConfig>) => {
    try {
      await createStreamMutation.mutateAsync(config);
      setIsCreateModalOpen(false);
    } catch {
      // error toast shown by useCreateStream; keep the form open to fix input
    }
  };

  // Creating is a write: not on a read-only dashboard.
  const createButton = serverConfig.readOnly ? null : (
    <Button onClick={() => setIsCreateModalOpen(true)}>
      <Plus />
      Create stream
    </Button>
  );

  return (
    <div className="p-4 sm:p-6">
      <PageIntro
        description="JetStream streams on this server."
        actions={createButton}
      />

      {error ? (
        <EmptyState
          tone="error"
          title="Couldn't load streams"
          description={
            error instanceof Error ? error.message : 'Failed to load streams'
          }
          action={
            <Button variant="outline" onClick={() => refetch()}>
              Try again
            </Button>
          }
        />
      ) : isLoading ? (
        <LoadingState label="Loading streams…" />
      ) : streams.length === 0 ? (
        <EmptyState
          icon={<Layers />}
          title="No streams yet"
          description="Streams store messages published to their subjects. Create one to start persisting messages."
          action={createButton}
        />
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatsCard
              title="Streams"
              value={streams.length}
              icon={<Layers />}
            />
            <StatsCard
              title="Messages"
              value={sum((s) => s.state?.messages || 0)}
              icon={<MessageSquare />}
            />
            <StatsCard
              title="Consumers"
              value={sum((s) => s.state?.consumer_count || 0)}
              icon={<Users />}
            />
            <StatsCard
              title="Subjects"
              value={sum((s) => s.config?.subjects?.length || 0)}
              icon={<Hash />}
            />
          </div>

          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="relative min-w-56 flex-1 sm:max-w-sm">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                type="search"
                aria-label="Search streams"
                placeholder="Search by name or subject…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <span className="text-sm text-muted-foreground" aria-live="polite">
              {searchTerm
                ? `${filteredStreams.length} of ${streams.length}`
                : `${streams.length} streams`}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="ml-auto"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={cn(isFetching && 'animate-spin')} />
              Refresh
            </Button>
          </div>

          {filteredStreams.length > 0 ? (
            <StreamsTable
              streams={filteredStreams}
              onBrowse={setBrowsing}
              onDelete={serverConfig.readOnly ? undefined : setStreamToDelete}
            />
          ) : (
            <EmptyState
              icon={<Search />}
              title="No streams match your search"
              description={`Nothing matches “${searchTerm}”.`}
              action={
                <Button variant="outline" onClick={() => setSearchTerm('')}>
                  Clear search
                </Button>
              }
            />
          )}
        </>
      )}

      <CreateStreamModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateStream}
        isLoading={createStreamMutation.isPending}
      />
      {browsing && (
        <ViewStreamDataModal
          streamName={browsing}
          isOpen
          onClose={() => setBrowsing(null)}
        />
      )}
      <ConfirmDialog
        open={streamToDelete !== null}
        onOpenChange={(open) => !open && setStreamToDelete(null)}
        title="Delete stream?"
        description={
          <>
            Stream <strong>{streamToDelete}</strong> and all its messages and
            consumers will be permanently deleted.
          </>
        }
        confirmLabel="Delete stream"
        destructive
        onConfirm={() =>
          streamToDelete && deleteStreamMutation.mutate(streamToDelete)
        }
      />
    </div>
  );
}
