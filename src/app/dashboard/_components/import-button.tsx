"use client";

import { useRouter } from "next/navigation";
import { startTransition, useId, useRef, useState } from "react";
import { importRows } from "@/lib/import-actions";
import { ImportFileError, readTable } from "@/lib/import/parse-file";
import {
  IMPORT_COLUMNS,
  MAX_IMPORT_ROWS,
  applyMapping,
  autoMap,
  checkRows,
  columnLetter,
  readSheet,
  templateCsv,
  unmappedRequired,
  type ColumnMapping,
  type ImportKind,
  type ImportRows,
  type RowIssue,
  type SheetInfo,
} from "@/lib/import/specs";
import { FormError, SubmitButton } from "@/components/form-ui";
import type { Dictionary } from "@/i18n/dictionaries";

type T = Dictionary["dashboard"]["importer"];

/** The chosen file, kept while the user moves between mapping, preview and errors. */
type Sheet = { file: string; table: string[][]; info: SheetInfo; mapping: ColumnMapping };

type Step =
  | { step: "idle" }
  | { step: "reading" }
  | { step: "map" }
  | { step: "ready"; rows: ImportRows }
  | { step: "issues"; issues: RowIssue[] }
  | { step: "done"; added: number; failed: RowIssue[] };

const ACCEPT = ".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const SHOWN_ISSUES = 8;
const fill = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
const clip = (s: string, n = 28) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

const secondaryBtn =
  "inline-flex h-12 items-center justify-center rounded-full px-6 text-base font-medium text-muted transition-colors hover:bg-accent/60 hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent-strong disabled:opacity-50";
const primaryBtn =
  "inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground px-6 text-base font-medium text-background transition enabled:hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Upload icon button + "Import from a file" popup for a section (CSV / XLSX).
 *   1. Choose a file (read in the browser).
 *   2. Match each field to one of the sheet's columns (pre-filled by header name).
 *   3. Every row is checked with the Add form's rules, then sent to
 *      importRows(), which checks them again. Owners only; the server checks too.
 */
export function ImportDialog({
  kind,
  label,
  t,
  errors,
}: {
  kind: ImportKind;
  /** Button label / tooltip. */
  label: string;
  t: T;
  /** The section's Add form error messages, keyed by field (plus taken / phoneTaken / failed). */
  errors: Record<string, string>;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<Step>({ step: "idle" });
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const uid = useId();
  const columns = IMPORT_COLUMNS[kind];

  function open() {
    setState({ step: "idle" });
    setSheet(null);
    setError(null);
    dialogRef.current?.showModal();
  }

  function close() {
    if (pending) return;
    dialogRef.current?.close();
  }

  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([templateCsv(kind)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${kind}-template.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking the same (fixed) file again
    if (!file) return;
    setError(null);
    setState({ step: "reading" });

    let table: string[][];
    try {
      table = await readTable(file);
    } catch (err) {
      setState({ step: "idle" });
      setError(err instanceof ImportFileError && err.code === "unsupported" ? t.unsupported : t.unreadable);
      return;
    }

    const info = readSheet(table);
    if (!info || info.dataRows === 0) {
      setState({ step: "idle" });
      setError(t.noRows);
      return;
    }
    setSheet({ file: file.name, table, info, mapping: autoMap(kind, info.headers) });
    setState({ step: "map" });
  }

  function setColumn(field: string, value: string) {
    setSheet((s) => (s ? { ...s, mapping: { ...s.mapping, [field]: value === "" ? null : Number(value) } } : s));
  }

  function onContinue() {
    if (!sheet) return;
    setError(null);
    const rows = applyMapping(kind, sheet.table, sheet.info.headerIdx, sheet.mapping);
    if (rows.length > MAX_IMPORT_ROWS[kind]) {
      setError(fill(t.tooMany, { n: rows.length, max: MAX_IMPORT_ROWS[kind] }));
      return;
    }
    const issues = checkRows(kind, rows);
    setState(issues.length ? { step: "issues", issues } : { step: "ready", rows });
  }

  async function onImport() {
    if (state.step !== "ready") return;
    setPending(true);
    setError(null);
    try {
      const result = await importRows(kind, state.rows);
      if (result.ok) {
        setState({ step: "done", added: result.added, failed: result.failed });
        if (result.added > 0) startTransition(() => router.refresh());
      } else if (result.error === "invalid_rows") {
        setState({ step: "issues", issues: result.issues });
      } else if (result.error === "forbidden") {
        setError(t.forbidden);
      } else if (result.error === "too_many") {
        setError(fill(t.tooMany, { n: state.rows.length, max: MAX_IMPORT_ROWS[kind] }));
      } else if (result.error === "empty") {
        setError(t.noRows);
      } else {
        setError(t.failed);
      }
    } catch {
      setError(t.failed);
    } finally {
      setPending(false);
    }
  }

  const issueText = (i: RowIssue) =>
    i.duplicateOf !== undefined ? fill(t.duplicate, { row: i.duplicateOf }) : (errors[i.field] ?? errors.failed ?? t.failed);

  // Mapping checks (map step only).
  const missing = sheet ? unmappedRequired(kind, sheet.mapping) : [];
  const chosen = sheet ? Object.values(sheet.mapping).filter((v): v is number => v != null) : [];
  const reused = new Set(chosen).size !== chosen.length;

  const columnName = (i: number) => sheet?.info.headers[i] || fill(t.columnN, { c: columnLetter(i) });

  const chooseFileButton = (text: string, primary: boolean) => (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      disabled={pending || state.step === "reading"}
      className={primary ? primaryBtn : secondaryBtn}
    >
      {state.step === "reading" ? t.reading : text}
    </button>
  );

  const backToMapping = (
    <button type="button" onClick={() => (setError(null), setState({ step: "map" }))} disabled={pending} className={secondaryBtn}>
      {t.changeMapping}
    </button>
  );

  const title = state.step === "map" ? t.mapTitle : t.title;
  const subtitle = state.step === "idle" || state.step === "reading" ? t.subtitle : null;

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-label={label}
        title={label}
        data-testid="import-file"
        className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-accent-strong/60 bg-white/70 text-foreground shadow-sm transition hover:-translate-y-0.5 hover:bg-accent/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
      >
        <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z" />
          <path d="M14 3v5h5M12 18v-6M9 15l3-3 3 3" />
        </svg>
      </button>

      <input ref={inputRef} type="file" accept={ACCEPT} onChange={onPick} className="hidden" tabIndex={-1} aria-hidden />

      <dialog
        ref={dialogRef}
        aria-labelledby={`${uid}-title`}
        data-testid={`import-${kind}-dialog`}
        onCancel={(e) => {
          if (pending) e.preventDefault();
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-3xl border border-accent-strong/70 bg-background p-0 text-left text-foreground shadow-[0_24px_60px_-28px_rgba(31,58,43,0.45)] backdrop:bg-foreground/40 backdrop:backdrop-blur-sm"
      >
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (state.step === "map") onContinue();
            else void onImport();
          }}
          className="flex max-h-[85dvh] flex-col gap-4 overflow-y-auto p-6 sm:p-8"
        >
          <header className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h2 id={`${uid}-title`} className="text-3xl leading-tight">
                {title}
              </h2>
              {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
              {state.step === "map" && sheet && <p className="text-sm text-muted">{fill(t.mapIntro, { file: sheet.file })}</p>}
            </div>
            <button
              type="button"
              onClick={close}
              aria-label={t.close}
              className="-mr-2 -mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-accent/60 hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent-strong"
            >
              <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </header>

          {(state.step === "idle" || state.step === "reading") && (
            <>
              <ul className="flex flex-col gap-1.5 rounded-2xl border border-accent-strong/50 bg-white/60 p-4 text-sm">
                {columns.map((c) => (
                  <li key={c.field} className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-medium">{c.header}</span>
                    <span className="text-xs text-muted">{c.required ? t.required : t.optional}</span>
                    {c.values && (
                      <span className="w-full text-xs text-muted">
                        {t.allowed} {c.values.join(", ")}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={downloadTemplate}
                className="inline-flex items-center gap-2 self-start text-sm font-medium text-brand underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-accent-strong"
              >
                <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
                </svg>
                {t.template}
              </button>
            </>
          )}

          {state.step === "map" && sheet && (
            <ul className="flex flex-col divide-y divide-accent-strong/40 rounded-2xl border border-accent-strong/50 bg-white/60 text-sm" data-testid="import-mapping">
              {columns.map((c) => {
                const value = sheet.mapping[c.field];
                const unset = value == null;
                return (
                  <li key={c.field} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <label htmlFor={`${uid}-map-${c.field}`} className="flex min-w-0 flex-col">
                      <span className="flex items-baseline gap-2">
                        <span className="font-medium">{c.header}</span>
                        <span className="text-xs text-muted">{c.required ? t.required : t.optional}</span>
                      </span>
                      {c.values && (
                        <span className="text-xs text-muted">
                          {t.allowed} {c.values.join(", ")}
                        </span>
                      )}
                    </label>
                    <select
                      id={`${uid}-map-${c.field}`}
                      value={unset ? "" : String(value)}
                      onChange={(e) => setColumn(c.field, e.target.value)}
                      aria-invalid={c.required && unset ? true : undefined}
                      data-testid={`map-${c.field}`}
                      className={`h-11 w-full rounded-xl border bg-background px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-accent-strong sm:w-60 ${
                        c.required && unset ? "border-red-300" : "border-accent-strong/60"
                      }`}
                    >
                      <option value="">{c.required ? t.chooseColumn : t.notInFile}</option>
                      {sheet.info.headers.map((_, i) => (
                        <option key={i} value={i}>
                          {clip(columnName(i))}
                          {sheet.info.samples[i] ? ` · ${fill(t.sample, { v: clip(sheet.info.samples[i], 18) })}` : ""}
                        </option>
                      ))}
                    </select>
                  </li>
                );
              })}
            </ul>
          )}

          {state.step === "map" && missing.length > 0 && (
            <p className="text-sm text-muted" data-testid="import-map-missing">
              {fill(t.mapMissing, { cols: missing.join(", ") })}
            </p>
          )}
          {state.step === "map" && missing.length === 0 && reused && <p className="text-sm text-muted">{t.reused}</p>}

          {state.step === "ready" && sheet && (
            <p className="rounded-xl bg-accent/50 px-4 py-3 text-sm" role="status" data-testid="import-ready">
              {fill(state.rows.length === 1 ? t.readyOne : t.ready, { n: state.rows.length, file: sheet.file })}
            </p>
          )}

          {state.step === "issues" && <IssueList title={t.fixRows} issues={state.issues} t={t} text={issueText} />}

          {state.step === "done" && (
            <>
              <p className="rounded-xl bg-accent/50 px-4 py-3 text-sm font-medium" role="status" data-testid="import-done">
                {fill(state.failed.length ? t.partial : t.done, { n: state.added })}
              </p>
              {state.failed.length > 0 && <IssueList issues={state.failed} t={t} text={issueText} />}
            </>
          )}

          <FormError message={error} />

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
            {state.step === "done" ? (
              <div className="flex-1">
                <button type="button" onClick={close} className={primaryBtn}>
                  {t.close}
                </button>
              </div>
            ) : state.step === "map" ? (
              <>
                {chooseFileButton(t.chooseAnother, false)}
                <div className="flex-1">
                  <button type="submit" disabled={missing.length > 0} className={primaryBtn} data-testid="import-continue">
                    {t.continue}
                  </button>
                </div>
              </>
            ) : state.step === "ready" ? (
              <>
                {backToMapping}
                <div className="flex-1">
                  <SubmitButton pending={pending} label={fill(t.submit, { n: state.rows.length })} pendingLabel={t.pending} />
                </div>
              </>
            ) : state.step === "issues" ? (
              <>
                {backToMapping}
                <div className="flex-1">{chooseFileButton(t.chooseAnother, true)}</div>
              </>
            ) : (
              <>
                <button type="button" onClick={close} className={secondaryBtn}>
                  {t.cancel}
                </button>
                <div className="flex-1">{chooseFileButton(t.choose, true)}</div>
              </>
            )}
          </div>
        </form>
      </dialog>
    </>
  );
}

function IssueList({ title, issues, t, text }: { title?: string; issues: RowIssue[]; t: T; text: (i: RowIssue) => string }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900" role="alert" data-testid="import-issues">
      {title && <p className="font-medium">{title}</p>}
      <ul className="flex flex-col gap-1">
        {issues.slice(0, SHOWN_ISSUES).map((i) => (
          <li key={`${i.row}-${i.field}`}>
            <span className="font-medium">{fill(t.row, { row: i.row })}:</span> {text(i)}
          </li>
        ))}
      </ul>
      {issues.length > SHOWN_ISSUES && <p>{fill(t.more, { n: issues.length - SHOWN_ISSUES })}</p>}
    </div>
  );
}
