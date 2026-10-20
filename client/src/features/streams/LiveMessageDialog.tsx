import { formatJSON } from '@/components/JsonViewer';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import type { MessageEvent } from './types';

interface LiveMessageDialogProps {
  message: MessageEvent | null;
  open: boolean;
  onClose: () => void;
}

export function LiveMessageDialog({
  message,
  open,
  onClose,
}: LiveMessageDialogProps) {
  return (
    <Dialog
      open={open && message !== null}
      onOpenChange={(open) => !open && onClose()}
    >
      {message && (
        <DialogContent
          aria-describedby={undefined}
          className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl"
        >
          <div className="px-4 py-3 border-b bg-muted">
            <DialogTitle>Message Details</DialogTitle>
          </div>

          {/* Modal Content */}
          <div className="p-4 overflow-y-auto max-h-[calc(90vh-7rem)]">
            {/* Message Metadata */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              <div className="bg-muted p-3 rounded-lg">
                <h3 className="font-semibold text-foreground mb-2 text-sm">
                  Subject
                </h3>
                <p className="text-xs font-mono bg-card p-2 rounded border">
                  {message.subject}
                </p>
              </div>
              <div className="bg-muted p-3 rounded-lg">
                <h3 className="font-semibold text-foreground mb-2 text-sm">
                  Timestamp
                </h3>
                <p className="text-xs font-mono bg-card p-2 rounded border">
                  {new Date(message.timestamp).toLocaleString()}
                </p>
              </div>
            </div>

            {/* Message Data */}
            <div className="mb-4">
              <h3 className="font-semibold text-foreground mb-2 text-sm">
                Data
              </h3>
              <div className="bg-muted text-foreground p-3 rounded-lg overflow-x-auto">
                <pre className="text-sm font-mono whitespace-pre-wrap">
                  {typeof message.data === 'string'
                    ? formatJSON(message.data)
                    : JSON.stringify(message.data, null, 2)}
                </pre>
              </div>
            </div>

            {/* Headers */}
            {message.headers && Object.keys(message.headers).length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold text-foreground mb-2">Headers</h3>
                <div className="bg-warning/5 border border-warning/30 p-4 rounded-lg">
                  <pre className="text-sm font-mono whitespace-pre-wrap">
                    {JSON.stringify(message.headers, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {/* Raw JSON */}
            <div>
              <h3 className="font-semibold text-foreground mb-2">Raw JSON</h3>
              <div className="bg-primary/5 border border-primary/30 p-4 rounded-lg">
                <pre className="text-sm font-mono whitespace-pre-wrap">
                  {JSON.stringify(message, null, 2)}
                </pre>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="px-6 py-4 border-t bg-muted flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(message, null, 2));
              }}
            >
              Copy JSON
            </Button>
            <Button
              onClick={onClose}
              className="bg-primary hover:bg-primary/90"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
