import {
  Archive,
  Database,
  HardDrive,
  Hash,
  Plus,
  RefreshCw,
  Search,
} from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState, LoadingState, PageIntro } from '@/components/PageStates';
import { StatsCard } from '@/components/StatsCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { CreateBucketRequest } from '@/lib/api';
import { serverConfig } from '@/lib/config';
import { useSearchQuery } from '@/lib/useSearchQuery';
import { cn, formatBytes } from '@/lib/utils';
import { BucketsTable } from './BucketsTable';
import { CreateBucketModal } from './CreateBucketModal';
import { useCreateKVBucket, useDeleteKVBucket, useKVBuckets } from './useKV';

export function KeyValuePage() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [bucketToDelete, setBucketToDelete] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useSearchQuery();

  const {
    data: bucketsData,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useKVBuckets();
  const createBucketMutation = useCreateKVBucket();
  const deleteBucketMutation = useDeleteKVBucket();

  const buckets = bucketsData?.buckets || [];
  const filteredBuckets = buckets.filter((b) =>
    b.bucket.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreateBucket = (config: CreateBucketRequest) =>
    createBucketMutation.mutate(config, {
      onSuccess: () => setIsCreateModalOpen(false),
    });

  // Creating is a write: not on a read-only dashboard.
  const createButton = serverConfig.readOnly ? null : (
    <Button onClick={() => setIsCreateModalOpen(true)}>
      <Plus />
      Create bucket
    </Button>
  );

  return (
    <div className="p-4 sm:p-6">
      <PageIntro
        description="Key-value buckets backed by JetStream."
        actions={createButton}
      />

      {error ? (
        <EmptyState
          tone="error"
          title="Couldn't load buckets"
          description={
            error instanceof Error ? error.message : 'Failed to load buckets'
          }
          action={
            <Button variant="outline" onClick={() => refetch()}>
              Try again
            </Button>
          }
        />
      ) : isLoading ? (
        <LoadingState label="Loading buckets…" />
      ) : buckets.length === 0 ? (
        <EmptyState
          icon={<Database />}
          title="No buckets yet"
          description="Buckets store keys and values with optional history and TTL."
          action={createButton}
        />
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatsCard
              title="Buckets"
              value={buckets.length}
              icon={<Database />}
            />
            <StatsCard
              title="Entries"
              value={buckets.reduce((n, b) => n + b.values, 0)}
              icon={<Hash />}
            />
            <StatsCard
              title="Storage used"
              value={formatBytes(buckets.reduce((n, b) => n + b.bytes, 0))}
              icon={<HardDrive />}
            />
            <StatsCard
              title="Compressed"
              value={`${buckets.filter((b) => b.is_compressed).length} / ${buckets.length}`}
              icon={<Archive />}
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
                aria-label="Search buckets"
                placeholder="Search buckets…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <span className="text-sm text-muted-foreground" aria-live="polite">
              {searchTerm
                ? `${filteredBuckets.length} of ${buckets.length}`
                : `${buckets.length} buckets`}
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

          {filteredBuckets.length > 0 ? (
            <BucketsTable
              buckets={filteredBuckets}
              onDelete={setBucketToDelete}
            />
          ) : (
            <EmptyState
              icon={<Search />}
              title="No buckets match your search"
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

      <CreateBucketModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateBucket}
        isLoading={createBucketMutation.isPending}
      />
      <ConfirmDialog
        open={bucketToDelete !== null}
        onOpenChange={(open) => !open && setBucketToDelete(null)}
        title="Delete bucket?"
        description={
          <>
            Bucket <strong>{bucketToDelete}</strong> and all its keys will be
            permanently deleted.
          </>
        }
        confirmLabel="Delete bucket"
        destructive
        onConfirm={() =>
          bucketToDelete && deleteBucketMutation.mutate(bucketToDelete)
        }
      />
    </div>
  );
}
