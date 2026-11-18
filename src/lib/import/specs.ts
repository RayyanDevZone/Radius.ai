// Bulk import (CSV / XLSX) column rules. Shared by the import dialog (client)
// and importRows() (server). The server always re-validates every row.
import { normalizeProductInput, validateProductInput, type ProductInput } from "@/lib/products";
import { normalizeShopInput, validateShopInput, type ShopInput } from "@/lib/shops";
import { normalizeVehicleInput, validateVehicleInput, type VehicleInput } from "@/lib/vehicles";
import { normalizeEmployeeInput, validateEmployeeInput, type EmployeeInput } from "@/lib/employees";

export const IMPORT_KINDS = ["products", "shops", "vehicles", "employees"] as const;
export type ImportKind = (typeof IMPORT_KINDS)[number];

/** Employees each create a login (several auth calls), so they get a lower cap. */
export const MAX_IMPORT_ROWS: Record<ImportKind, number> = { products: 1000, shops: 1000, vehicles: 1000, employees: 50 };

export type ImportColumn = {
  field: string;
  /** Header written in the template. Matching is case/space/punctuation-insensitive. */
  header: string;
  /** Other header spellings that are accepted. */
  aliases: string[];
  required: boolean;
  /** Example value for the template's sample row. */
  sample: string;
  /** Allowed values, shown in the dialog (enum columns only). */
  values?: readonly string[];
};

export const IMPORT_COLUMNS: Record<ImportKind, ImportColumn[]> = {
  products: [
    { field: "name", header: "Name", aliases: ["product", "product name", "item", "item name"], required: true, sample: "Basmati rice" },
    { field: "price", header: "Price", aliases: ["rate", "mrp", "price (₹)", "price rs"], required: true, sample: "450.50" },
    { field: "sizeValue", header: "Size", aliases: ["size value", "weight", "volume", "pack size"], required: true, sample: "25" },
    { field: "sizeUnit", header: "Size unit", aliases: ["measure", "uom", "size uom", "weight unit"], required: true, sample: "kg", values: ["g", "kg", "ml", "l"] },
    { field: "unit", header: "Unit", aliases: ["sale unit", "sold as", "pack"], required: false, sample: "bag", values: ["bag", "piece", "packet", "crate"] },
    { field: "hsnCode", header: "HSN code", aliases: ["hsn", "hsn sac", "hsn/sac"], required: false, sample: "1006" },
  ],
  shops: [
    { field: "firmName", header: "Firm name", aliases: ["firm", "shop", "shop name", "name"], required: true, sample: "Sharma General Store" },
    { field: "firmAddress", header: "Firm address", aliases: ["address", "shop address"], required: true, sample: "12 MG Road, Pune" },
    { field: "ownerName", header: "Owner name", aliases: ["owner", "contact", "contact name"], required: true, sample: "Ramesh Sharma" },
    { field: "mobile", header: "Mobile", aliases: ["mobile number", "phone", "phone number", "contact number"], required: true, sample: "9876543210" },
  ],
  vehicles: [
    { field: "number", header: "Vehicle number", aliases: ["number", "registration", "registration number", "reg no", "vehicle no"], required: true, sample: "MH 12 AB 1234" },
    { field: "type", header: "Type", aliases: ["vehicle type"], required: true, sample: "truck", values: ["bike", "auto", "pickup", "truck", "van", "other"] },
  ],
  employees: [
    { field: "name", header: "Name", aliases: ["employee", "employee name", "full name"], required: true, sample: "Suresh Kumar" },
    { field: "phone", header: "Phone", aliases: ["mobile", "phone number", "mobile number"], required: true, sample: "9800000020" },
    { field: "designation", header: "Designation", aliases: ["role", "title", "job title", "position"], required: true, sample: "Delivery" },
    { field: "password", header: "Password", aliases: ["initial password", "temporary password"], required: true, sample: "ChangeMe123" },
  ],
};

export type ImportRaw = Record<string, string>;
export type ImportInput = ProductInput | ShopInput | VehicleInput | EmployeeInput;

const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Common spellings of the enum values ("Kgs", "Litre", "Pcs", "Pick-up" …). */
const ENUM_ALIASES: Record<string, Record<string, string>> = {
  sizeUnit: {
    g: "g", gm: "g", gms: "g", gram: "g", grams: "g", gr: "g",
    kg: "kg", kgs: "kg", kilo: "kg", kilos: "kg", kilogram: "kg", kilograms: "kg",
    ml: "ml", mls: "ml", millilitre: "ml", milliliter: "ml", millilitres: "ml", milliliters: "ml",
    l: "l", lt: "l", ltr: "l", ltrs: "l", litre: "l", liter: "l", litres: "l", liters: "l",
  },
  unit: {
    bag: "bag", bags: "bag", sack: "bag",
    piece: "piece", pieces: "piece", pc: "piece", pcs: "piece", nos: "piece", no: "piece",
    packet: "packet", packets: "packet", pkt: "packet", pkts: "packet", pack: "packet",
    crate: "crate", crates: "crate", box: "crate",
  },
  type: {
    bike: "bike", motorbike: "bike", motorcycle: "bike", scooter: "bike", twowheeler: "bike",
    auto: "auto", autorickshaw: "auto", erickshaw: "auto", rickshaw: "auto", autoerickshaw: "auto",
    pickup: "pickup", tempo: "pickup", pickuptempo: "pickup",
    truck: "truck", lorry: "truck",
    van: "van", other: "other",
  },
};

/** Spreadsheet number cells drop leading zeros: HSN "0401" arrives as "401". */
function fixHsn(v: string) {
  const digits = v.replace(/[\s.-]/g, "");
  return /^\d{3}$|^\d{5}$|^\d{7}$/.test(digits) ? `0${digits}` : v;
}

/** Turns one raw row (field → cell text) into the section's normalized input. */
export function toInput(kind: ImportKind, raw: ImportRaw): ImportInput {
  const r: ImportRaw = { ...raw };
  for (const [field, map] of Object.entries(ENUM_ALIASES)) {
    if (field in r) r[field] = map[key(r[field])] ?? r[field].trim().toLowerCase();
  }
  switch (kind) {
    case "products":
      return normalizeProductInput({ ...r, hsnCode: fixHsn(r.hsnCode ?? "") });
    case "shops":
      return normalizeShopInput(r);
    case "vehicles":
      return normalizeVehicleInput(r);
    case "employees":
      return normalizeEmployeeInput(r);
  }
}

/** First invalid field of a normalized input, or null. */
export function validateInput(kind: ImportKind, input: ImportInput): string | null {
  switch (kind) {
    case "products":
      return validateProductInput(input as ProductInput);
    case "shops":
      return validateShopInput(input as ShopInput);
    case "vehicles":
      return validateVehicleInput(input as VehicleInput);
    case "employees":
      return validateEmployeeInput(input as EmployeeInput);
  }
}

/** The field that must be unique within one file (and the business), if any. */
export const UNIQUE_FIELD: Partial<Record<ImportKind, string>> = { vehicles: "number", employees: "phone" };

/** One entry per non-blank data row; `row` is the spreadsheet row number (header = 1). */
export type ImportRows = { row: number; raw: ImportRaw }[];

/** field → index of the sheet column it's read from (null = not in the file). */
export type ColumnMapping = Record<string, number | null>;

export type SheetInfo = {
  /** Index of the header row (the first non-blank row). */
  headerIdx: number;
  /** Header text per column ("" when that header cell is blank). */
  headers: string[];
  /** First non-blank value under each column, to help the user recognise it. */
  samples: string[];
  /** Number of non-blank data rows. */
  dataRows: number;
};

/** Finds the header row and describes the sheet's columns, or null when the sheet is empty. */
export function readSheet(table: string[][]): SheetInfo | null {
  const headerIdx = table.findIndex((r) => r.some((c) => c.trim() !== ""));
  if (headerIdx < 0) return null;
  const data = table.slice(headerIdx + 1).filter((r) => r.some((c) => c.trim() !== ""));
  const width = Math.max(table[headerIdx].length, ...data.map((r) => r.length));
  const headers = Array.from({ length: width }, (_, i) => (table[headerIdx][i] ?? "").trim());
  const samples = headers.map((_, i) => data.find((r) => (r[i] ?? "").trim() !== "")?.[i]?.trim() ?? "");
  return { headerIdx, headers, samples, dataRows: data.length };
}

/** Best-guess mapping from header names (each sheet column is used at most once). */
export function autoMap(kind: ImportKind, headers: string[]): ColumnMapping {
  const keys = headers.map(key);
  const used = new Set<number>();
  const mapping: ColumnMapping = {};
  for (const col of IMPORT_COLUMNS[kind]) {
    const names = [col.header, col.field, ...col.aliases].map(key);
    const i = keys.findIndex((h, idx) => h !== "" && !used.has(idx) && names.includes(h));
    mapping[col.field] = i >= 0 ? i : null;
    if (i >= 0) used.add(i);
  }
  return mapping;
}

/** Required fields that aren't mapped to a column yet (template header names). */
export function unmappedRequired(kind: ImportKind, mapping: ColumnMapping): string[] {
  return IMPORT_COLUMNS[kind].filter((c) => c.required && mapping[c.field] == null).map((c) => c.header);
}

/** Reads every data row through the mapping. */
export function applyMapping(kind: ImportKind, table: string[][], headerIdx: number, mapping: ColumnMapping): ImportRows {
  const rows: ImportRows = [];
  for (let i = headerIdx + 1; i < table.length; i++) {
    const cells = table[i];
    if (!cells.some((c) => c.trim() !== "")) continue;
    const raw: ImportRaw = {};
    for (const col of IMPORT_COLUMNS[kind]) {
      const idx = mapping[col.field];
      raw[col.field] = idx == null ? "" : (cells[idx] ?? "").trim();
    }
    rows.push({ row: i + 1, raw });
  }
  return rows;
}

/** 0 → "A", 27 → "AB". */
export function columnLetter(i: number): string {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

export type RowIssue = { row: number; field: string; duplicateOf?: number };

/** Validates every row, plus duplicates inside the file for unique fields. */
export function checkRows(kind: ImportKind, rows: ImportRows): RowIssue[] {
  const issues: RowIssue[] = [];
  const unique = UNIQUE_FIELD[kind];
  const seen = new Map<string, number>();
  for (const { row, raw } of rows) {
    const input = toInput(kind, raw);
    const invalid = validateInput(kind, input);
    if (invalid) {
      issues.push({ row, field: invalid });
      continue;
    }
    if (unique) {
      const v = (input as Record<string, string>)[unique];
      const first = seen.get(v);
      if (first !== undefined) issues.push({ row, field: unique, duplicateOf: first });
      else seen.set(v, row);
    }
  }
  return issues;
}

const csvCell = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** Template CSV: header row + one example row. */
export function templateCsv(kind: ImportKind): string {
  const cols = IMPORT_COLUMNS[kind];
  return [cols.map((c) => csvCell(c.header)).join(","), cols.map((c) => csvCell(c.sample)).join(",")].join("\r\n") + "\r\n";
}
