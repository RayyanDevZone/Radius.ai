import type { DeliveryStatus } from "@/lib/deliveries";

/** Status colors, also used by the dashboard's status bar. Always shown with the label. */
export const STATUS_STYLE: Record<DeliveryStatus, { badge: string; dot: string }> = {
  pending: { badge: "bg-amber-100 text-amber-900", dot: "bg-amber-500" },
  out_for_delivery: { badge: "bg-sky-100 text-sky-900", dot: "bg-sky-600" },
  delivered: { badge: "bg-accent text-foreground", dot: "bg-brand" },
  cancelled: { badge: "bg-foreground/10 text-muted", dot: "bg-foreground/30" },
};

export function StatusBadge({ status, label }: { status: DeliveryStatus; label: string }) {
  const s = STATUS_STYLE[status];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${s.badge}`} data-status={status}>
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {label}
    </span>
  );
}
