"use client";

import { useEffect, useId, useRef, useState } from "react";

type Day = { date: string; total: string; count: number };

type Labels = {
  chartLabel: string;
  showTable: string;
  date: string;
  sales: string;
  count: string;
  deliveries: string;
  deliveriesOne: string;
};

const HEIGHT = 200;
const PAD = { top: 12, right: 8, bottom: 26, left: 52 };
const BAR_MAX = 24;
const GAP = 2;

/** Rounded "nice" step for about 4 gridlines. */
function niceMax(max: number): { top: number; step: number } {
  if (max <= 0) return { top: 1000, step: 250 };
  const rough = max / 4;
  const mag = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= rough) ?? 10 * mag;
  return { top: Math.ceil(max / step) * step, step };
}

/**
 * Daily sales as columns (one series, so no legend: the card title names it).
 * Hover, tap or arrow keys show a tooltip for a day; the same numbers are in
 * a table under the chart.
 */
export function SalesChart({ days, locale, labels, totalLabel }: { days: Day[]; locale: string; labels: Labels; totalLabel: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [active, setActive] = useState<number | null>(null);
  const tableId = useId();
  const intl = locale === "hi" ? "hi-IN" : "en-IN";

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const values = days.map((d) => Number(d.total));
  const { top, step } = niceMax(Math.max(...values, 0));
  const plotW = width - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const slot = plotW / days.length;
  const barW = Math.max(2, Math.min(BAR_MAX, slot - GAP));
  const y = (v: number) => PAD.top + plotH - (v / top) * plotH;

  const moneyFull = new Intl.NumberFormat(intl, { style: "currency", currency: "INR", maximumFractionDigits: 0 });
  const moneyAxis = new Intl.NumberFormat(intl, { notation: top >= 10_000 ? "compact" : "standard", maximumFractionDigits: 1 });
  const dayFmt = new Intl.DateTimeFormat(intl, { day: "numeric", month: "short", timeZone: "UTC" });
  const longFmt = new Intl.DateTimeFormat(intl, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  const asDate = (iso: string) => new Date(`${iso}T00:00:00Z`);

  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const xLabels = [0, Math.floor((days.length - 1) / 2), days.length - 1];

  function indexAt(clientX: number) {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const i = Math.floor((clientX - rect.left - PAD.left) / slot);
    return i >= 0 && i < days.length ? i : null;
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const dir = e.key === "ArrowRight" ? 1 : -1;
      setActive((i) => Math.min(days.length - 1, Math.max(0, (i ?? (dir > 0 ? -1 : days.length)) + dir)));
    } else if (e.key === "Escape") setActive(null);
  }

  const a = active !== null ? days[active] : null;
  const tipLeft = active !== null ? Math.min(Math.max(PAD.left + slot * active + slot / 2, 80), width - 80) : 0;

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={wrapRef}
        className="relative w-full overflow-hidden touch-pan-y select-none outline-none focus-visible:rounded-xl focus-visible:ring-2 focus-visible:ring-accent-strong"
        tabIndex={0}
        role="img"
        aria-label={labels.chartLabel.replace("{total}", totalLabel)}
        aria-describedby={tableId}
        onPointerMove={(e) => setActive(indexAt(e.clientX))}
        onPointerDown={(e) => setActive(indexAt(e.clientX))}
        onPointerLeave={(e) => e.pointerType === "mouse" && setActive(null)}
        onKeyDown={onKeyDown}
        onBlur={() => setActive(null)}
        data-testid="sales-chart"
      >
        <svg width={width} height={HEIGHT} className="block" aria-hidden>
          {/* Gridlines + y ticks */}
          {ticks.map((v) => (
            <g key={v}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(v)} y2={y(v)} stroke="currentColor" className="text-foreground/10" strokeWidth={1} />
              <text x={PAD.left - 8} y={y(v)} dy="0.32em" textAnchor="end" className="fill-muted text-[11px] tabular-nums">
                {moneyAxis.format(v)}
              </text>
            </g>
          ))}

          {/* Columns: 4px rounded top, square at the baseline */}
          {days.map((d, i) => {
            const v = values[i];
            if (v <= 0) return null;
            const h = Math.max(2, PAD.top + plotH - y(v));
            const x = PAD.left + slot * i + (slot - barW) / 2;
            const yTop = PAD.top + plotH - h;
            const r = Math.min(4, barW / 2, h);
            return (
              <path
                key={d.date}
                d={`M${x},${yTop + h} V${yTop + r} Q${x},${yTop} ${x + r},${yTop} H${x + barW - r} Q${x + barW},${yTop} ${x + barW},${yTop + r} V${yTop + h} Z`}
                fill="var(--brand)"
                opacity={active === null || active === i ? 1 : 0.45}
              />
            );
          })}

          {/* Hover guide for empty days too */}
          {active !== null && (
            <rect
              x={PAD.left + slot * active}
              y={PAD.top}
              width={slot}
              height={plotH}
              fill="currentColor"
              className="text-foreground/5"
            />
          )}

          {/* Baseline + x labels */}
          <line x1={PAD.left} x2={width - PAD.right} y1={PAD.top + plotH} y2={PAD.top + plotH} stroke="currentColor" className="text-foreground/25" />
          {xLabels.map((i, k) => (
            <text
              key={i}
              x={PAD.left + slot * i + slot / 2}
              y={HEIGHT - 6}
              textAnchor={k === 0 ? "start" : k === 2 ? "end" : "middle"}
              className="fill-muted text-[11px]"
            >
              {dayFmt.format(asDate(days[i].date))}
            </text>
          ))}
        </svg>

        {a && (
          <div
            role="status"
            className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 whitespace-nowrap rounded-xl border border-foreground/10 bg-background px-3 py-2 text-xs shadow-[0_12px_30px_-12px_rgba(31,58,43,0.45)]"
            style={{ left: tipLeft }}
          >
            <p className="text-muted">{longFmt.format(asDate(a.date))}</p>
            <p className="text-sm font-semibold">{moneyFull.format(Number(a.total))}</p>
            <p className="text-muted">{a.count === 1 ? labels.deliveriesOne : labels.deliveries.replace("{n}", String(a.count))}</p>
          </div>
        )}
      </div>

      <details className="group text-sm">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium text-muted transition hover:bg-accent/50 hover:text-foreground">
          <span aria-hidden className="transition-transform group-open:rotate-90">
            ›
          </span>
          {labels.showTable}
        </summary>
        <div className="mt-2 max-h-64 overflow-y-auto rounded-xl border border-foreground/10">
          <table id={tableId} className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-background">
              <tr className="text-xs uppercase tracking-[0.1em] text-muted">
                <th scope="col" className="px-3 py-2 font-medium">
                  {labels.date}
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  {labels.sales}
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  {labels.count}
                </th>
              </tr>
            </thead>
            <tbody>
              {[...days].reverse().map((d) => (
                <tr key={d.date} className="border-t border-foreground/10">
                  <td className="px-3 py-1.5">{longFmt.format(asDate(d.date))}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{moneyFull.format(Number(d.total))}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{d.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
