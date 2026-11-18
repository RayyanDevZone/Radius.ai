import type { ReactNode } from "react";
import type { VehicleType } from "@/lib/vehicles";

/** Line icons per vehicle type. Plain JSX, usable from server and client components. */
const svg = (children: ReactNode) => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round">
    {children}
  </svg>
);

export const TYPE_ICONS: Record<VehicleType, ReactNode> = {
  bike: svg(
    <>
      <circle cx="5.5" cy="16" r="3" />
      <circle cx="18.5" cy="16" r="3" />
      <path d="M5.5 16l4-6h5l4 6M9.5 10L8 7H6M14.5 10l1.5-3h2" />
    </>,
  ),
  auto: svg(
    <>
      <path d="M4 16V9a4 4 0 014-4h5l5 5v6H4zM13 5v5h5M4 11h9" />
      <circle cx="7.5" cy="17" r="1.8" />
      <circle cx="16" cy="17" r="1.8" />
    </>,
  ),
  pickup: svg(
    <>
      <path d="M2 16v-4h9V8h5l3 4h3v4H2z" />
      <circle cx="6.5" cy="17" r="1.8" />
      <circle cx="17.5" cy="17" r="1.8" />
    </>,
  ),
  truck: svg(
    <>
      <path d="M2 6h12v10H2zM14 10h4l3 3v3h-7" />
      <circle cx="6" cy="17.5" r="1.8" />
      <circle cx="17" cy="17.5" r="1.8" />
    </>,
  ),
  van: svg(
    <>
      <path d="M2 16V8a2 2 0 012-2h11l5 5v5H2zM15 6v5h5M2 11h13" />
      <circle cx="6.5" cy="17" r="1.8" />
      <circle cx="16.5" cy="17" r="1.8" />
    </>,
  ),
  other: svg(
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M8 12h.01M12 12h.01M16 12h.01" strokeWidth="2.4" />
    </>,
  ),
};
