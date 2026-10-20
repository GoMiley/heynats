import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { AutocompleteInput } from '@/components/ui/autocomplete-input';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { subscribeApi } from '@/lib/api';
import { serverConfig } from '@/lib/config';
import type { SubscriptionType } from './types';

export type SubscribeFn = (
  subject: string,
  type: SubscriptionType,
  queueGroup?: string,
  maxMessages?: number,
  autoReply?: boolean,
  replyTemplate?: string
) => void;

export function SubscribeForm({ subscribe }: { subscribe: SubscribeFn }) {
  // Regular subscription state
  const [subject, setSubject] = useState('');
  const [queueGroup, setQueueGroup] = useState('');
  const [maxMessages, setMaxMessages] = useState<number | ''>('');

  // Reply subscription state
  const [replySubject, setReplySubject] = useState('');
  const [replyMaxMessages, setReplyMaxMessages] = useState<number | ''>('');

  // Request handler state
  const [requestSubject, setRequestSubject] = useState('');
  const [requestQueueGroup, setRequestQueueGroup] = useState('');
  const [autoReply, setAutoReply] = useState(false);
  const [replyTemplate, setReplyTemplate] = useState(
    '{"status": "received", "timestamp": "${timestamp}"}'
  );

  // Get subject suggestions
  const { data: subjectsData } = useQuery({
    queryKey: ['subscribe-subjects'],
    queryFn: subscribeApi.getSubjects,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const handleSubscribe = () => {
    if (!subject.trim()) return;

    const subscriptionType = queueGroup ? 'queue' : 'regular';
    subscribe(
      subject,
      subscriptionType,
      queueGroup || undefined,
      maxMessages || undefined
    );

    // Clear form
    setSubject('');
    setQueueGroup('');
    setMaxMessages('');
  };

  const handleReplySubscribe = () => {
    if (!replySubject.trim()) return;

    subscribe(replySubject, 'reply', undefined, replyMaxMessages || undefined);

    setReplySubject('');
    setReplyMaxMessages('');
  };

  const handleRequestHandlerSubscribe = () => {
    if (!requestSubject.trim()) return;

    subscribe(
      requestSubject,
      'request-handler',
      requestQueueGroup || undefined,
      undefined,
      autoReply,
      replyTemplate
    );

    setRequestSubject('');
    setRequestQueueGroup('');
    setAutoReply(false);
    setReplyTemplate('{"status": "received", "timestamp": "${timestamp}"}');
  };

  return (
    <div className="bg-card rounded-lg border border-border p-4 mb-4">
      <Tabs defaultValue="regular" className="w-full">
        {/* A request handler replies (publishes), so read-only hides it. */}
        <TabsList
          className={`grid w-full ${serverConfig.readOnly ? 'grid-cols-2' : 'grid-cols-3'}`}
        >
          <TabsTrigger value="regular">
            {serverConfig.readOnly ? 'Regular' : 'Regular/Queue'}
          </TabsTrigger>
          <TabsTrigger value="reply">Reply Subject</TabsTrigger>
          {!serverConfig.readOnly && (
            <TabsTrigger value="request-handler">Request Handler</TabsTrigger>
          )}
        </TabsList>

        {/* Regular/Queue Subscription Tab */}
        <TabsContent value="regular" className="space-y-4">
          <div
            className={`grid grid-cols-1 gap-4 items-end ${serverConfig.readOnly ? 'md:grid-cols-3' : 'md:grid-cols-4'}`}
          >
            <div>
              <label
                htmlFor="sub-subject"
                className="block text-sm font-medium text-foreground/80 mb-1"
              >
                Subject *
              </label>
              <AutocompleteInput
                id="sub-subject"
                value={subject}
                onChange={setSubject}
                placeholder="e.g., events.*, orders.created"
                suggestions={subjectsData?.subjects || []}
                className="w-full"
              />
            </div>

            {/* A queue group would divert deliveries from a real subscriber. */}
            {!serverConfig.readOnly && (
              <div>
                <label
                  htmlFor="sub-queue-group"
                  className="block text-sm font-medium text-foreground/80 mb-1"
                >
                  Queue Group
                </label>
                <Input
                  id="sub-queue-group"
                  value={queueGroup}
                  onChange={(e) => setQueueGroup(e.target.value)}
                  placeholder="optional"
                  className="w-full"
                />
              </div>
            )}

            <div>
              <label
                htmlFor="sub-max-messages"
                className="block text-sm font-medium text-foreground/80 mb-1"
              >
                Max Messages
              </label>
              <Input
                id="sub-max-messages"
                type="number"
                value={maxMessages}
                onChange={(e) =>
                  setMaxMessages(
                    e.target.value ? Number.parseInt(e.target.value) : ''
                  )
                }
                placeholder="unlimited"
                min="1"
                className="w-full"
              />
            </div>

            <div>
              <Button
                onClick={handleSubscribe}
                disabled={!subject.trim()}
                className="w-full"
              >
                Subscribe
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* Reply Subject Tab */}
        <TabsContent value="reply" className="space-y-4">
          <div className="space-y-4">
            <div className="bg-primary/5 border border-primary/30 rounded-md p-3">
              <p className="text-sm text-primary">
                Subscribe to reply subjects to monitor responses in
                request-reply patterns. Use wildcards like "reply.{'>'}'" or
                specific patterns like "_INBOX.{'>'}"
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div>
                <label
                  htmlFor="sub-reply-subject-pattern"
                  className="block text-sm font-medium text-foreground/80 mb-1"
                >
                  Reply Subject Pattern *
                </label>
                <AutocompleteInput
                  id="sub-reply-subject-pattern"
                  value={replySubject}
                  onChange={setReplySubject}
                  placeholder="e.g., _INBOX.>, reply.*"
                  suggestions={['_INBOX.>', 'reply.>', 'response.*', '*.reply']}
                  className="w-full"
                />
              </div>

              <div>
                <label
                  htmlFor="sub-max-messages-2"
                  className="block text-sm font-medium text-foreground/80 mb-1"
                >
                  Max Messages
                </label>
                <Input
                  id="sub-max-messages-2"
                  type="number"
                  value={replyMaxMessages}
                  onChange={(e) =>
                    setReplyMaxMessages(
                      e.target.value ? Number.parseInt(e.target.value) : ''
                    )
                  }
                  placeholder="unlimited"
                  min="1"
                  className="w-full"
                />
              </div>

              <div>
                <Button
                  onClick={handleReplySubscribe}
                  disabled={!replySubject.trim()}
                  className="w-full"
                >
                  Subscribe to Replies
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Request Handler Tab */}
        {!serverConfig.readOnly && (
          <TabsContent value="request-handler" className="space-y-4">
            <div className="space-y-4">
              <div className="bg-success/5 border border-success/30 rounded-md p-3">
                <p className="text-sm text-success">
                  Subscribe to handle incoming requests and optionally send
                  automatic replies. Perfect for creating service endpoints and
                  API handlers.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label
                    htmlFor="sub-request-subject"
                    className="block text-sm font-medium text-foreground/80 mb-1"
                  >
                    Request Subject *
                  </label>
                  <AutocompleteInput
                    id="sub-request-subject"
                    value={requestSubject}
                    onChange={setRequestSubject}
                    placeholder="e.g., api.*, service.orders.*"
                    suggestions={subjectsData?.subjects || []}
                    className="w-full"
                  />
                </div>

                <div>
                  <label
                    htmlFor="sub-queue-group-2"
                    className="block text-sm font-medium text-foreground/80 mb-1"
                  >
                    Queue Group
                  </label>
                  <Input
                    id="sub-queue-group-2"
                    value={requestQueueGroup}
                    onChange={(e) => setRequestQueueGroup(e.target.value)}
                    placeholder="load balancing group"
                    className="w-full"
                  />
                </div>

                <div className="flex items-end">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={autoReply}
                      onChange={(e) => setAutoReply(e.target.checked)}
                      className="rounded border-border"
                    />
                    <span className="text-sm font-medium text-foreground/80">
                      Auto Reply
                    </span>
                  </label>
                </div>
              </div>

              {autoReply && (
                <div>
                  <label
                    htmlFor="sub-reply-template-json"
                    className="block text-sm font-medium text-foreground/80 mb-1"
                  >
                    Reply Template (JSON)
                  </label>
                  <Textarea
                    id="sub-reply-template-json"
                    value={replyTemplate}
                    onChange={(e) => setReplyTemplate(e.target.value)}
                    placeholder='{"status": "received", "timestamp": "${timestamp}"}'
                    className="min-h-[80px] font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Use ${'{timestamp}'} for current time, ${'{subject}'} for
                    request subject, ${'{data}'} for request data
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={handleRequestHandlerSubscribe}
                  disabled={!requestSubject.trim()}
                  className="flex-1"
                >
                  Start Request Handler
                </Button>
              </div>
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
