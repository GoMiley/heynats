import type { ConsumerInfo } from '@/lib/api';
import { cn, formatAgo } from '@/lib/utils';

interface ConsumersTableProps {
  consumers: ConsumerInfo[];
}

const num = (n: number | undefined) => (n ?? 0).toLocaleString();

/**
 * A stream's readers (durable consumers) and how far behind each is: events
 * not yet delivered (pending), delivered but not acknowledged (ack pending),
 * delivered more than once (redelivered), and when it last delivered and
 * last acknowledged. A reader with a backlog and no recent ack is stuck.
 */
export function ConsumersTable({ consumers }: ConsumersTableProps) {
  const rows = [...consumers].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div className="relative overflow-x-auto rounded-lg border bg-card">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
          <tr>
            <th scope="col" className="px-3 py-2.5 text-left font-medium">
              Reader
            </th>
            <th
              scope="col"
              className="hidden px-3 py-2.5 text-left font-medium 2xl:table-cell"
            >
              Reads
            </th>
            <th
              scope="col"
              className="px-3 py-2.5 text-right font-medium"
              title="Events not delivered yet"
            >
              Pending
            </th>
            <th
              scope="col"
              className="px-3 py-2.5 text-right font-medium"
              title="Delivered, not acknowledged yet"
            >
              Ack pending
            </th>
            <th
              scope="col"
              className="px-3 py-2.5 text-right font-medium"
              title="Events delivered more than once"
            >
              Redelivered
            </th>
            <th scope="col" className="px-3 py-2.5 text-right font-medium">
              Last delivered
            </th>
            <th scope="col" className="px-3 py-2.5 text-right font-medium">
              Last ack
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((c) => {
            const filters = c.config.filter_subjects?.length
              ? c.config.filter_subjects
              : c.config.filter_subject
                ? [c.config.filter_subject]
                : ['all subjects'];
            const behind = c.num_pending + c.num_ack_pending > 0;
            return (
              <tr key={c.name} className="transition-colors hover:bg-muted/50">
                <td className="px-3 py-2.5">
                  <div className="font-medium text-foreground">{c.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {[
                      c.config.deliver_policy &&
                        `deliver ${c.config.deliver_policy}`,
                      c.config.max_deliver &&
                        `max ${c.config.max_deliver} deliveries`,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                </td>
                <td className="hidden px-3 py-2.5 font-mono text-xs text-muted-foreground 2xl:table-cell">
                  {filters.join(', ')}
                </td>
                <td
                  className={cn(
                    'px-3 py-2.5 text-right tabular-nums',
                    c.num_pending > 0 && 'font-semibold text-warning'
                  )}
                >
                  {num(c.num_pending)}
                </td>
                <td
                  className={cn(
                    'px-3 py-2.5 text-right tabular-nums',
                    c.num_ack_pending > 0 && 'font-semibold text-warning'
                  )}
                >
                  {num(c.num_ack_pending)}
                </td>
                <td
                  className={cn(
                    'px-3 py-2.5 text-right tabular-nums',
                    c.num_redelivered > 0 && 'font-semibold text-destructive'
                  )}
                >
                  {num(c.num_redelivered)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                  {formatAgo(c.delivered?.last_active)}
                </td>
                <td
                  className={cn(
                    'px-3 py-2.5 text-right tabular-nums',
                    behind ? 'text-foreground' : 'text-muted-foreground'
                  )}
                >
                  {formatAgo(c.ack_floor?.last_active)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
