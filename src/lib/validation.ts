// Shared by client and server. The server always re-validates.

export type BusinessInput = { businessName: string; phone: string };
export type BusinessField = keyof BusinessInput;

/**
 * Canonical phone format, used both when storing a business phone and when
 * looking one up at login: E.164-style, a leading + and digits only.
 * Indian numbers default to +91, so these are all the same number:
 *   "+91 98765-43210", "98765 43210", "098765 43210", "91 98765 43210"
 *   → "+919876543210"
 */
export function normalizePhone(raw: unknown): string {
  const cleaned = String(raw ?? "").trim().replace(/(?!^\+)[^\d]/g, "");
  if (cleaned.startsWith("+")) return cleaned;
  if (/^\d{10}$/.test(cleaned)) return `+91${cleaned}`; // 98765 43210
  if (/^0\d{10}$/.test(cleaned)) return `+91${cleaned.slice(1)}`; // 098765 43210
  if (/^91\d{10}$/.test(cleaned)) return `+${cleaned}`; // 91 98765 43210
  return cleaned;
}

export function isValidPhone(phone: string): boolean {
  return /^\+?\d{7,15}$/.test(phone);
}

export function normalizeBusinessInput(raw: { businessName?: unknown; phone?: unknown }): BusinessInput {
  return {
    businessName: String(raw.businessName ?? "").trim().replace(/\s+/g, " "),
    phone: normalizePhone(raw.phone),
  };
}

/** Returns the first invalid field, or null when the input is valid. */
export function validateBusinessInput(input: BusinessInput): BusinessField | null {
  if (input.businessName.length < 2 || input.businessName.length > 100) return "businessName";
  if (!isValidPhone(input.phone)) return "phone";
  return null;
}
