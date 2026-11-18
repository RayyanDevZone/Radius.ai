// Employee input rules. Shared by client and server; the server always re-validates.
import { isValidPhone, normalizePhone } from "@/lib/validation";

export type EmployeeInput = { name: string; phone: string; designation: string; password: string };
export type EmployeeField = keyof EmployeeInput;

export const EMPLOYEE_LIMITS = {
  name: { min: 2, max: 100 },
  designation: { min: 2, max: 60 },
  // Better Auth's default password length limits.
  password: { min: 8, max: 128 },
} as const;

const tidy = (v: unknown) => String(v ?? "").trim().replace(/\s+/g, " ");

export function normalizeEmployeeInput(raw: Partial<Record<EmployeeField, unknown>>): EmployeeInput {
  return {
    name: tidy(raw.name),
    // Same canonical format as business phones: "98765 43210" → "+919876543210".
    phone: normalizePhone(raw.phone),
    designation: tidy(raw.designation),
    // Passwords are used exactly as typed.
    password: String(raw.password ?? ""),
  };
}

const inRange = (s: string, { min, max }: { min: number; max: number }) => s.length >= min && s.length <= max;

/** Returns the first invalid field, or null when the input is valid. */
export function validateEmployeeInput(input: EmployeeInput): EmployeeField | null {
  if (!inRange(input.name, EMPLOYEE_LIMITS.name)) return "name";
  if (!isValidPhone(input.phone)) return "phone";
  if (!inRange(input.designation, EMPLOYEE_LIMITS.designation)) return "designation";
  if (!inRange(input.password, EMPLOYEE_LIMITS.password)) return "password";
  return null;
}

/** Domain of the placeholder login emails the app generates for employees (see employee-actions.ts). */
export const EMPLOYEE_EMAIL_DOMAIN = "employees.radius.invalid";

/** Editing keeps the password, so it has no password field. */
export type EmployeeUpdateInput = Omit<EmployeeInput, "password">;

export function validateEmployeeUpdate(input: EmployeeUpdateInput): Exclude<EmployeeField, "password"> | null {
  const invalid = validateEmployeeInput({ ...input, password: "x".repeat(EMPLOYEE_LIMITS.password.min) });
  return invalid === "password" ? null : invalid;
}
