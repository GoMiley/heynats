import { Radio } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState, PageIntro } from '@/components/PageStates';
import { apiUrl } from '@/lib/config';
import { appendCapped, useEventSources } from '@/lib/useEventSources';
import { type SubscribeFn, SubscribeForm } from './SubscribeForm';
import { SubscriptionsPanel } from './SubscriptionsPanel';
import {
  type Subscription,
  type SubscriptionType,
  subscriptionTypeIcon,
} from './types';

function TypeIcon({ type }: { type: SubscriptionType }) {
  const Icon = subscriptionTypeIcon[type];
  return (
    <Icon
      className="size-4 shrink-0 text-muted-foreground"
      aria-hidden="true"
    />
  );
}

export function SubscribePage() {
  // Common state
  const { open: openSource, close: closeSource } = useEventSources();
  const [subscriptions, setSubscriptions] = useState<
    Record<string, Subscription>
  >({});
  const [activeTab, setActiveTab] = useState<string | null>(null);

  // Confirmation state
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState<
    string | null
  >(null);

  const startSubscription = (
    subscriptionSubject: string,
    subscriptionType: SubscriptionType = 'regular',
    subscriptionQueueGroup?: string,
    subscriptionMaxMessages?: number,
    subscriptionAutoReply?: boolean,
    subscriptionReplyTemplate?: string
  ) => {
    let key = subscriptionSubject;
    if (subscriptionType === 'queue' && subscriptionQueueGroup) {
      key = `${subscriptionSubject}:${subscriptionQueueGroup}`;
    } else if (subscriptionType === 'reply') {
      key = `reply:${subscriptionSubject}`;
    } else if (subscriptionType === 'request-handler') {
      key = subscriptionQueueGroup
        ? `handler:${subscriptionSubject}:${subscriptionQueueGroup}`
        : `handler:${subscriptionSubject}`;
    }

    // Build URL with query parameters
    let url = apiUrl(
      `/nats/subscribe/messages/${encodeURIComponent(subscriptionSubject)}`
    );
    const params = new URLSearchParams();
    if (subscriptionQueueGroup) {
      params.append('queue_group', subscriptionQueueGroup);
    }
    if (subscriptionMaxMessages && subscriptionMaxMessages > 0) {
      params.append('max_messages', subscriptionMaxMessages.toString());
    }
    if (params.toString()) {
      url += `?${params.toString()}`;
    }

    openSource(key, url, {
      onOpen: () =>
        setSubscriptions((prev) => ({
          ...prev,
          [key]: {
            ...prev[key],
            subject: subscriptionSubject,
            queueGroup: subscriptionQueueGroup,
            maxMessages: subscriptionMaxMessages,
            subscriptionType,
            isActive: true,
            messages: prev[key]?.messages || [],
            autoReply: subscriptionAutoReply,
            replyTemplate: subscriptionReplyTemplate,
          },
        })),
      onMessage: (messageData) =>
        setSubscriptions((prev) => {
          const currentSub = prev[key] || {
            subject: subscriptionSubject,
            queueGroup: subscriptionQueueGroup,
            maxMessages: subscriptionMaxMessages,
            subscriptionType,
            isActive: true,
            messages: [],
            autoReply: subscriptionAutoReply,
            replyTemplate: subscriptionReplyTemplate,
          };

          // Handle connection/status messages
          if (messageData.type) {
            return {
              ...prev,
              [key]: {
                ...currentSub,
                connectionStatus: messageData.type as
                  | 'connected'
                  | 'disconnected'
                  | 'connecting',
                lastStatusUpdate: messageData.timestamp,
              },
            };
          }

          // Handle data messages
          if (messageData.data !== undefined) {
            return {
              ...prev,
              [key]: {
                ...currentSub,
                messages: appendCapped(currentSub.messages, messageData),
              },
            };
          }

          return prev;
        }),
      onError: () => {
        console.error('SSE error for subject:', subscriptionSubject);
        markStopped(key);
      },
    });
    return key;
  };

  // Start a subscription and show it if nothing is selected yet.
  const subscribe: SubscribeFn = (...args) => {
    const key = startSubscription(...args);
    setActiveTab((current) => current ?? key);
  };

  const markStopped = (key: string) =>
    setSubscriptions((prev) => ({
      ...prev,
      [key]: { ...prev[key], isActive: false },
    }));

  const stopSubscription = (key: string) => {
    closeSource(key);
    markStopped(key);
  };

  const handleDisconnectClick = (key: string) => {
    setShowDisconnectConfirm(key);
  };

  const confirmDisconnect = (key: string) => {
    stopSubscription(key);
    setShowDisconnectConfirm(null);
  };

  const handleDisconnectAll = () => {
    activeSubscriptions.forEach(([key]) => stopSubscription(key));
  };

  const activeSubscriptions = Object.entries(subscriptions).filter(
    ([, sub]) => sub.isActive
  );

  // When the shown subscription stops (manually or on SSE error), fall back to the first active one.
  const firstActiveKey = activeSubscriptions[0]?.[0] ?? null;
  useEffect(() => {
    if (activeTab && !subscriptions[activeTab]?.isActive) {
      setActiveTab(firstActiveKey);
    }
  }, [activeTab, subscriptions, firstActiveKey]);

  return (
    <div className="flex h-full flex-col p-4 sm:p-6">
      <PageIntro description="Listen to subjects and watch messages arrive in real time." />

      <SubscribeForm subscribe={subscribe} />

      {/* Active Subscriptions */}
      {activeSubscriptions.length > 0 && (
        <SubscriptionsPanel
          subscriptions={subscriptions}
          activeSubscriptions={activeSubscriptions}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          handleDisconnectClick={handleDisconnectClick}
          handleDisconnectAll={handleDisconnectAll}
        />
      )}

      {activeSubscriptions.length === 0 && (
        <EmptyState
          icon={<Radio />}
          title="No active subscriptions"
          description={
            <>
              Subscribe to a subject above to watch messages arrive live.
              Wildcards like <code className="font-mono">orders.*</code> and{' '}
              <code className="font-mono">events.&gt;</code> work.
              <ul className="mt-4 space-y-1.5 text-left">
                <li className="flex items-center gap-2">
                  <TypeIcon type="regular" />
                  <span>
                    <span className="font-medium text-foreground">Regular</span>{' '}
                    — every message on the subject
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <TypeIcon type="queue" />
                  <span>
                    <span className="font-medium text-foreground">
                      Queue group
                    </span>{' '}
                    — load-balanced across members
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <TypeIcon type="reply" />
                  <span>
                    <span className="font-medium text-foreground">
                      Reply subject
                    </span>{' '}
                    — watch replies to requests
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <TypeIcon type="request-handler" />
                  <span>
                    <span className="font-medium text-foreground">
                      Request handler
                    </span>{' '}
                    — answer requests, optionally automatically
                  </span>
                </li>
              </ul>
            </>
          }
        />
      )}

      <ConfirmDialog
        open={showDisconnectConfirm !== null}
        onOpenChange={(open) => !open && setShowDisconnectConfirm(null)}
        title="Disconnect subscription?"
        description={
          showDisconnectConfirm && (
            <>
              <div className="mb-3 rounded bg-muted p-3">
                <div className="font-medium text-foreground">
                  {subscriptions[showDisconnectConfirm]?.subject}
                </div>
                {subscriptions[showDisconnectConfirm]?.queueGroup && (
                  <div className="text-xs">
                    Queue: {subscriptions[showDisconnectConfirm].queueGroup}
                  </div>
                )}
                <div className="text-xs capitalize">
                  Type:{' '}
                  {subscriptions[
                    showDisconnectConfirm
                  ]?.subscriptionType.replace('-', ' ')}
                </div>
              </div>
              This stops receiving messages. You can subscribe again later.
            </>
          )
        }
        confirmLabel="Disconnect"
        destructive
        onConfirm={() =>
          showDisconnectConfirm && confirmDisconnect(showDisconnectConfirm)
        }
      />
    </div>
  );
}
