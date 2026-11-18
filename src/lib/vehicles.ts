// Vehicle input rules. Shared by the Add vehicle form (client) and the server
// action. The server always re-validates.

export const VEHICLE_TYPES = ["bike", "auto", "pickup", "truck", "van", "other"] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

export type VehicleInput = { number: string; type: VehicleType };
export type VehicleField = keyof VehicleInput;

const str = (v: unknown) => (typeof v === "string" ? v : "");

/** "mh-12 ab 1234" → "MH12AB1234". This is the stored form. */
export function normalizeVehicleNumber(raw: unknown): string {
  return str(raw).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

// Standard plate: state (2 letters) + RTO (1-2 digits) + series (0-3 letters) + number (1-4 digits).
//   MH12AB1234, DL1C1234, KA05M12
const STANDARD_RE = /^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{1,4}$/;
// Bharat (BH) series: year (2 digits) + BH + 4 digits + 1-2 letters, e.g. 22BH1234AA.
const BH_RE = /^\d{2}BH\d{4}[A-Z]{1,2}$/;

export function isValidVehicleNumber(n: string): boolean {
  return n.length >= 6 && n.length <= 11 && (STANDARD_RE.test(n) || BH_RE.test(n));
}

/** "MH12AB1234" → "MH 12 AB 1234", "22BH1234AA" → "22 BH 1234 AA". Display only. */
export function formatVehicleNumber(n: string): string {
  const bh = n.match(/^(\d{2})(BH)(\d{4})([A-Z]{1,2})$/);
  if (bh) return bh.slice(1).join(" ");
  const std = n.match(/^([A-Z]{2})(\d{1,2})([A-Z]{0,3})(\d{1,4})$/);
  if (std) return std.slice(1).filter(Boolean).join(" ");
  return n;
}

export function normalizeVehicleInput(raw: Record<string, unknown>): VehicleInput {
  return { number: normalizeVehicleNumber(raw.number), type: str(raw.type) as VehicleType };
}

/** Returns the first invalid field, or null when the input is valid. */
export function validateVehicleInput(input: VehicleInput): VehicleField | null {
  if (!isValidVehicleNumber(input.number)) return "number";
  if (!(VEHICLE_TYPES as readonly string[]).includes(input.type)) return "type";
  return null;
}
