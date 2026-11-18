// Reads a .csv or .xlsx file in the browser into rows of cell text.
// No dependencies: CSV is parsed by hand, and XLSX (a zip of XML files) is
// unzipped with the built-in DecompressionStream and read with DOMParser.

export class ImportFileError extends Error {
  constructor(public code: "unsupported" | "unreadable") {
    super(code);
  }
}

export async function readTable(file: File): Promise<string[][]> {
  const name = file.name.toLowerCase();
  try {
    if (name.endsWith(".csv")) return parseCsv(await file.text());
    if (name.endsWith(".xlsx")) return await parseXlsx(await file.arrayBuffer());
  } catch (err) {
    console.error("[import] could not read file", err);
    throw new ImportFileError("unreadable");
  }
  throw new ImportFileError("unsupported");
}

/* ------------------------------- CSV ---------------------------------- */

/** RFC 4180 CSV (quoted fields, "" escapes, newlines in quotes). Detects , ; or tab. */
export function parseCsv(text: string): string[][] {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const firstLine = text.slice(0, text.search(/\r?\n|$/));
  const delimiter = [",", ";", "\t"].reduce((best, d) => (count(firstLine, d) > count(firstLine, best) ? d : best), ",");

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"' && cell === "") {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

const count = (s: string, ch: string) => s.split(ch).length - 1;

/* ------------------------------- XLSX --------------------------------- */

async function parseXlsx(buf: ArrayBuffer): Promise<string[][]> {
  const zip = readZip(buf);
  const read = async (path: string) => {
    const entry = zip.get(path);
    return entry ? new TextDecoder().decode(await entry()) : null;
  };
  const xml = (s: string) => new DOMParser().parseFromString(s, "application/xml");

  const sharedXml = await read("xl/sharedStrings.xml");
  const shared = sharedXml ? [...byTag(xml(sharedXml), "si")].map(textOf) : [];

  const sheet = await read(await firstSheetPath(read, xml));
  if (!sheet) throw new Error("no worksheet");

  const rows: string[][] = [];
  let nextRow = 0;
  for (const r of byTag(xml(sheet), "row")) {
    const rowIndex = Number(r.getAttribute("r") ?? nextRow + 1) - 1;
    nextRow = rowIndex + 1;
    const cells: string[] = [];
    let nextCol = 0;
    for (const c of children(r, "c")) {
      const ref = c.getAttribute("r");
      const col = ref ? colIndex(ref) : nextCol;
      nextCol = col + 1;
      const type = c.getAttribute("t");
      const v = children(c, "v")[0]?.textContent ?? "";
      let text: string;
      if (type === "s") text = shared[Number(v)] ?? "";
      else if (type === "inlineStr") text = textOf(children(c, "is")[0]);
      else if (type === "b") text = v === "1" ? "TRUE" : "FALSE";
      else text = v;
      while (cells.length < col) cells.push("");
      cells[col] = text;
    }
    rows[rowIndex] = cells;
  }
  // Keep row numbers aligned with the spreadsheet (skipped rows become empty).
  return Array.from(rows, (r) => r ?? []);
}

async function firstSheetPath(read: (p: string) => Promise<string | null>, xml: (s: string) => Document) {
  const fallback = "xl/worksheets/sheet1.xml";
  const wb = await read("xl/workbook.xml");
  const rels = await read("xl/_rels/workbook.xml.rels");
  if (!wb || !rels) return fallback;
  const first = byTag(xml(wb), "sheet")[0];
  const rid = first && [...first.attributes].find((a) => a.localName === "id")?.value;
  const rel = [...byTag(xml(rels), "Relationship")].find((el) => el.getAttribute("Id") === rid);
  const target = rel?.getAttribute("Target");
  if (!target) return fallback;
  return target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`;
}

/** "AB12" → 27 (0-based column). */
function colIndex(ref: string) {
  let n = 0;
  for (const ch of ref.replace(/\d+$/, "").toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

const byTag = (root: Document | Element, name: string) => root.getElementsByTagNameNS("*", name);
const children = (el: Element | undefined, name: string) => (el ? [...el.children].filter((c) => c.localName === name) : []);

/** Text of a shared/inline string: all <t> runs, skipping phonetic (<rPh>) hints. */
function textOf(el: Element | undefined): string {
  if (!el) return "";
  let s = "";
  for (const t of byTag(el, "t")) if (t.parentElement?.localName !== "rPh") s += t.textContent ?? "";
  return s;
}

/* ------------------------------- ZIP ---------------------------------- */

/** Minimal zip reader: path → lazy loader of the uncompressed bytes. */
function readZip(buf: ArrayBuffer): Map<string, () => Promise<Uint8Array>> {
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 22 - 0xffff); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("not a zip file");

  const total = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const entries = new Map<string, () => Promise<Uint8Array>>();
  const decoder = new TextDecoder();

  for (let n = 0; n < total; n++) {
    if (view.getUint32(p, true) !== 0x02014b50) throw new Error("bad zip directory");
    const method = view.getUint16(p + 10, true);
    const size = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const local = view.getUint32(p + 42, true);
    const name = decoder.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;

    entries.set(name, async () => {
      const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
      const data = bytes.slice(start, start + size);
      if (method === 0) return data;
      if (method !== 8) throw new Error(`unsupported zip method ${method}`);
      const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    });
  }
  return entries;
}
