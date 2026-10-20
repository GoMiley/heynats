import {
  Archive,
  Clock,
  HardDrive,
  Hash,
  Key,
  Plus,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState, LoadingState, PageIntro } from '@/components/PageStates';
import { StatsCard } from '@/components/StatsCard';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useConnectionStatus } from '@/features/connection/useNATS';
import { serverConfig } from '@/lib/config';
import { formatBytes, formatTTL } from '@/lib/utils';
import { KVKeysTab } from './KVKeysTab';
import { useDeleteKVBucket, useKVBucket, useKVBucketKeys } from './useKV';

export function KVBucketDetailPage() {
  const { bucketName } = useParams<{ bucketName: string }>();
  const navigate = useNavigate();

  // State management
  const [activeTab, setActiveTab] = useState('overview');
  const [isAddingKey, setIsAddingKey] = useState(false);

  // Check connection status
  const { data: connectionStatus } = useConnectionStatus();
  const isConnected = connectionStatus?.connected || false;

  // Fetch bucket data
  const {
    data: bucket,
    isLoading: bucketLoading,
    error: bucketError,
  } = useKVBucket(bucketName!, isConnected && !!bucketName);

  const {
    data: keysData,
    isLoading: keysLoading,
    error: keysError,
  } = useKVBucketKeys(bucketName!, isConnected && !!bucketName);

  // Mutations
  const deleteBucketMutation = useDeleteKVBucket();

  const keys = keysData?.items || [];

  // Filter keys based on search term

  const [confirmDeleteBucket, setConfirmDeleteBucket] = useState(false);
  const deleteBucket = () => {
    if (bucketName) {
      deleteBucketMutation.mutate(bucketName, {
        onSuccess: () => {
          navigate('/dashboard/kv');
        },
      });
    }
  };

  if (bucketLoading) {
    return <LoadingState label="Loading bucket…" />;
  }

  if (bucketError) {
    return (
      <div className="p-4 sm:p-6">
        <EmptyState
          tone="error"
          title="Couldn't load this bucket"
          description="It may have been deleted, or the name in the URL is wrong."
          action={
            <Button variant="outline" onClick={() => navigate('/dashboard/kv')}>
              Back to buckets
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="max-w-full">
        <PageIntro
          description="Key-value bucket"
          actions={
            !serverConfig.readOnly && (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsAddingKey(true);
                    setActiveTab('keys');
                  }}
                >
                  <Plus />
                  Add key
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setConfirmDeleteBucket(true)}
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 />
                  Delete bucket
                </Button>
              </>
            )
          }
        />

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          defaultValue="overview"
          className="space-y-6"
        >
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="keys">Keys ({keys.length})</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            {bucket && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatsCard
                  title="Total Keys"
                  value={bucket.values?.toLocaleString() || 'N/A'}
                  icon={<Hash className="w-4 h-4 text-primary" />}
                />
                <StatsCard
                  title="Storage Used"
                  value={formatBytes(bucket.bytes)}
                  icon={<HardDrive className="w-4 h-4 text-primary" />}
                />
                <StatsCard
                  title="History"
                  value={`${bucket.history} revisions`}
                  icon={<Archive className="w-4 h-4 text-primary" />}
                />
                <StatsCard
                  title="TTL"
                  value={formatTTL(bucket.ttl)}
                  icon={<Clock className="w-4 h-4 text-primary" />}
                />
              </div>
            )}

            {/* Bucket Configuration */}
            {bucket && (
              <div className="bg-card rounded-lg border border-border p-4">
                <h3 className="text-base font-semibold text-foreground mb-3">
                  Configuration
                </h3>
                <dl className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 text-sm">
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">
                      Storage Type
                    </dt>
                    <dd className="text-sm text-foreground capitalize">
                      {bucket.backing_store}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">
                      Compression
                    </dt>
                    <dd className="text-sm text-foreground">
                      {bucket.is_compressed ? 'Enabled' : 'Disabled'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">
                      History per Key
                    </dt>
                    <dd className="text-sm text-foreground">
                      {bucket.history} revisions
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">
                      Time to Live
                    </dt>
                    <dd className="text-sm text-foreground">
                      {formatTTL(bucket.ttl)}
                    </dd>
                  </div>
                </dl>
              </div>
            )}

            {/* Quick Actions */}
            <div className="bg-card rounded-lg border border-border p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">
                Quick Actions
              </h3>
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={() => {
                    setIsAddingKey(true);
                    setActiveTab('keys');
                  }}
                  className="flex items-center"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add New Key
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setActiveTab('keys')}
                  className="flex items-center"
                >
                  <Key className="w-4 h-4 mr-2" />
                  View All Keys ({keys.length})
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* Keys Tab */}
          <TabsContent value="keys" className="space-y-6">
            <KVKeysTab
              bucketName={bucketName!}
              keys={keys}
              keysLoading={keysLoading}
              keysError={keysError}
              isAddingKey={isAddingKey}
              setIsAddingKey={setIsAddingKey}
            />
          </TabsContent>
        </Tabs>
      </div>

      <ConfirmDialog
        open={confirmDeleteBucket}
        onOpenChange={setConfirmDeleteBucket}
        title="Delete bucket?"
        description={
          <>
            Bucket <strong>{bucketName}</strong> and all {keys.length} keys will
            be permanently deleted.
          </>
        }
        confirmLabel="Delete bucket"
        destructive
        onConfirm={deleteBucket}
      />
    </div>
  );
}
