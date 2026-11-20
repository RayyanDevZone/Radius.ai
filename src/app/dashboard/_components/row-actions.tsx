"use client";

import { useRouter } from "next/navigation";
import { startTransition, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { FormError } from "@/components/form-ui";
import type { Dictionary } from "@/i18n/dictionaries";
import type { DeleteResult } from "@/lib/row-action-result";

type Labels = Dictionary["dashboard"]["rowActions"];
type Manage = Dictionary["dashboard"]["products"]["manage"];

const fill = (template: string, name: string) => template.replace("{name}", name);

/**
 * "⋮" menu at the end of a table row with Edit and Delete.
 *  - Edit renders the section's own form popup, prefilled (`renderEdit`).
 *  - Delete asks for confirmation, then shows a success message. The list is
 *    refreshed only when that message is closed, because the refresh removes
 *    this row (and this component) from the page.
 */
export function RowActions({
  labels,
  manage,
  name,
  onDelete,
  renderEdit,
  extraItems = [],
}: {
  labels: Labels;
  manage: Manage;
  /** Shown in the confirmation and success messages. */
  name: string;
  /** Omit to hide Delete. */
  onDelete?: () => Promise<DeleteResult>;
  /** Omit to hide Edit. `close` must be called when the popup closes. */
  renderEdit?: (close: () => void) => ReactNode;
  /** More actions, listed before Edit (e.g. "Mark delivered"). */
  extraItems?: RowMenuItem[];
}) {
  const [editing, setEditing] = useState(false);
  // The Delete popup is mounted only when asked for, so long lists stay light.
  const [deleting, setDeleting] = useState(false);

  return (
    <>
      <RowMenu
        label={`${labels.menu}: ${name}`}
        items={[
          ...extraItems,
          ...(renderEdit ? [{ key: "edit", label: labels.edit, icon: editIcon, onSelect: () => setEditing(true) }] : []),
          ...(onDelete
            ? [{ key: "delete", label: labels.delete, icon: trashIcon, danger: true, onSelect: () => setDeleting(true) }]
            : []),
        ]}
      />
      {editing && renderEdit?.(() => setEditing(false))}
      {onDelete && deleting && (
        <DeleteDialog labels={labels} manage={manage} name={name} onDelete={onDelete} onClosed={() => setDeleting(false)} />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Menu                                                               */
/* ------------------------------------------------------------------ */

export type RowMenuItem = { key: string; label: string; icon: ReactNode; danger?: boolean; onSelect: () => void };
type MenuItem = RowMenuItem;

const MENU_WIDTH = 176; // w-44
const ITEM_HEIGHT = 40; // h-10
const MENU_CHROME = 14; // p-1.5 + border

/**
 * Uses the native Popover API: it renders in the top layer (so the table's
 * scroll container can't clip it), closes on outside click and Escape, and
 * returns focus to the button. Position is set from the button when it opens.
 */
function RowMenu({ label, items }: { label: string; items: MenuItem[] }) {
  const menuId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const menu = menuRef.current;
    const button = buttonRef.current;
    if (!menu || !button) return;

    const place = () => {
      const r = button.getBoundingClientRect();
      const height = items.length * ITEM_HEIGHT + MENU_CHROME;
      const below = r.bottom + 6;
      const top = below + height > window.innerHeight - 8 ? Math.max(8, r.top - height - 6) : below;
      const left = Math.min(Math.max(8, r.right - MENU_WIDTH), window.innerWidth - MENU_WIDTH - 8);
      menu.style.top = `${top}px`;
      menu.style.left = `${left}px`;
    };
    // A fixed menu would drift away from its row on scroll, so just close it.
    const hide = () => menu.hidePopover();

    const onBeforeToggle = (e: Event) => {
      if ((e as ToggleEvent).newState === "open") place();
    };
    const onToggle = (e: Event) => {
      const isOpen = (e as ToggleEvent).newState === "open";
      setOpen(isOpen);
      if (isOpen) {
        menu.querySelector<HTMLElement>("[role=menuitem]")?.focus();
        window.addEventListener("scroll", hide, { capture: true, passive: true });
        window.addEventListener("resize", hide);
      } else {
        window.removeEventListener("scroll", hide, { capture: true });
        window.removeEventListener("resize", hide);
      }
    };

    menu.addEventListener("beforetoggle", onBeforeToggle);
    menu.addEventListener("toggle", onToggle);
    return () => {
      menu.removeEventListener("beforetoggle", onBeforeToggle);
      menu.removeEventListener("toggle", onToggle);
      window.removeEventListener("scroll", hide, { capture: true });
      window.removeEventListener("resize", hide);
    };
  }, [items.length]);

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const all = [...e.currentTarget.querySelectorAll<HTMLElement>("[role=menuitem]")];
    const i = all.indexOf(document.activeElement as HTMLElement);
    const go = (n: number) => {
      e.preventDefault();
      all[(n + all.length) % all.length]?.focus();
    };
    if (e.key === "ArrowDown") go(i + 1);
    else if (e.key === "ArrowUp") go(i - 1);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(all.length - 1);
    else if (e.key === "Tab") menuRef.current?.hidePopover();
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        popoverTarget={menuId}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
        data-testid="row-actions"
        className={`ml-auto flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-accent/70 hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent-strong ${open ? "bg-accent/70 text-foreground" : ""}`}
      >
        <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
          <circle cx="12" cy="5" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="12" cy="19" r="1.8" />
        </svg>
      </button>

      <div
        ref={menuRef}
        id={menuId}
        popover="auto"
        role="menu"
        aria-label={label}
        onKeyDown={onKeyDown}
        className="fixed inset-auto m-0 w-44 rounded-2xl border border-accent-strong/70 bg-background p-1.5 text-foreground shadow-[0_20px_50px_-20px_rgba(31,58,43,0.45)]"
      >
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            role="menuitem"
            data-testid={`row-action-${item.key}`}
            onClick={() => {
              menuRef.current?.hidePopover();
              item.onSelect();
            }}
            className={`flex h-10 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium outline-none transition-colors ${
              item.danger ? "text-red-700 hover:bg-red-50 focus-visible:bg-red-50" : "hover:bg-accent/60 focus-visible:bg-accent/60"
            }`}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Delete: confirm → success message                                  */
/* ------------------------------------------------------------------ */

function DeleteDialog({
  labels,
  manage,
  name,
  onDelete,
  onClosed,
}: {
  labels: Labels;
  manage: Manage;
  name: string;
  onDelete: () => Promise<DeleteResult>;
  /** Runs after the popup closes, so the parent can unmount it. */
  onClosed: () => void;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [phase, setPhase] = useState<"confirm" | "done">("confirm");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();
  const bodyId = useId();

  // Mounted on demand: open as soon as it mounts.
  useEffect(() => {
    if (!dialogRef.current?.open) dialogRef.current?.showModal();
  }, []);

  function close() {
    if (pending) return;
    dialogRef.current?.close();
  }

  async function confirm() {
    setPending(true);
    setError(null);
    try {
      const result = await onDelete();
      if (result.ok) setPhase("done");
      else
        setError(
          result.error === "not_found"
            ? manage.notFound
            : result.error === "forbidden"
              ? labels.forbidden
              : result.error === "in_use"
                ? labels.inUse
                : labels.failed,
        );
    } catch {
      setError(labels.failed);
    } finally {
      setPending(false);
    }
  }

  const done = phase === "done";

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      data-testid="delete-dialog"
      onCancel={(e) => pending && e.preventDefault()}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      // The row is gone once deleted; reload the list when the success message closes.
      onClose={() => {
        if (done) startTransition(() => router.refresh());
        onClosed();
      }}
      className="m-auto w-[min(24rem,calc(100vw-2rem))] rounded-3xl border border-foreground/10 bg-background p-0 text-left text-foreground shadow-[0_24px_60px_-20px_rgba(31,58,43,0.5)] transition duration-200 ease-out starting:open:translate-y-4 starting:open:opacity-0 backdrop:bg-foreground/40 backdrop:backdrop-blur-sm"
    >
      <div className="flex flex-col items-center gap-3 p-6 text-center sm:p-7" role={done ? "status" : undefined}>
        {done ? (
          <span aria-hidden className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-brand">
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </span>
        ) : (
          <span aria-hidden className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600">
            {trashIconLarge}
          </span>
        )}
        <h2 id={titleId} className="text-3xl">
          {done ? manage.deleted : manage.deleteTitle}
        </h2>
        <p id={bodyId} className="text-sm leading-6 text-muted">
          {fill(done ? manage.deletedBody : manage.deleteBody, name)}
        </p>

        {!done && error && (
          <div className="w-full text-left">
            <FormError message={error} />
          </div>
        )}

        <div className="mt-3 flex w-full flex-col-reverse gap-2 sm:flex-row">
          {done ? (
            <button
              type="button"
              autoFocus
              onClick={close}
              data-testid="delete-done"
              className="h-12 flex-1 rounded-full bg-foreground text-base font-medium text-background transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
            >
              {labels.done}
            </button>
          ) : (
            <>
              <button
                type="button"
                autoFocus
                disabled={pending}
                onClick={close}
                className="h-12 flex-1 rounded-full border border-foreground/20 text-base font-medium transition hover:bg-accent/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong disabled:opacity-50"
              >
                {labels.cancel}
              </button>
              <button
                type="button"
                disabled={pending}
                aria-busy={pending || undefined}
                onClick={confirm}
                data-testid="confirm-delete"
                className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-red-600 text-base font-medium text-white transition hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400 disabled:cursor-wait disabled:opacity-70"
              >
                {pending && <span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
                {pending ? labels.deleting : labels.confirmDelete}
              </button>
            </>
          )}
        </div>
      </div>
    </dialog>
  );
}

/* ------------------------------------------------------------------ */

const editIcon = (
  <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4zM13.5 6.5l4 4" />
  </svg>
);

const trashPath = <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />;

const trashIcon = (
  <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {trashPath}
  </svg>
);

const trashIconLarge = (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {trashPath}
  </svg>
);
