import { Suspense } from "react";
import { getContext } from "@/lib/auth-context";
import { listProducts } from "@/lib/products-data";
import { getI18n } from "@/i18n/server";
import { EmptyState, Icon, SectionHeader } from "../_components/section";
import { SectionSkeleton } from "../_components/section-skeleton";
import { ImportDialog } from "../_components/import-button";
import { SearchableTable } from "../_components/searchable-list";
import { AddProductDialog } from "./add-product-dialog";
import { ProductRowActions } from "./product-row-actions";

/** "25.000" → "25", "0.500" → "0.5" */
const trimZeros = (n: string) => n.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");

async function ProductsContent() {
  // Tenant and role come from the session (getContext()); listProducts() is tenant-scoped.
  const [ctx, products, { locale, t }] = await Promise.all([getContext(), listProducts(), getI18n()]);
  const d = t.dashboard;
  const p = d.products;
  const isOwner = ctx.role === "owner";
  const money = new Intl.NumberFormat(locale === "hi" ? "hi-IN" : "en-IN", { style: "currency", currency: "INR" });

  return (
    <section aria-labelledby="products-title" className="flex flex-col gap-5">
      <SectionHeader
        id="products-title"
        title={p.title}
        count={products.length}
        countLabel={p}
        addLabel={p.add}
        comingSoon={d.comingSoon}
        importAction={<ImportDialog kind="products" label={d.importFile} t={d.importer} errors={p.form.errors} />}
        canAdd={isOwner}
        addAction={<AddProductDialog t={p} />}
      />

      {products.length === 0 ? (
        <EmptyState title={p.empty} hint={p.emptyHint} icon={<Icon name="box" className="h-7 w-7" />} />
      ) : (
        <SearchableTable
          testId="product-list"
          labels={{ ...d.search, placeholder: p.search }}
          columns={[
            { label: p.columns.name },
            { label: p.columns.size, className: "whitespace-nowrap" },
            { label: p.columns.unit },
            { label: p.columns.hsn, className: "whitespace-nowrap" },
            { label: p.columns.price, className: "whitespace-nowrap text-right" },
            ...(isOwner ? [{ label: d.rowActions.actions, srOnly: true, className: "w-14 py-1.5 pr-2 text-right" }] : []),
          ]}
          rows={products.map((row) => {
            const size = `${trimZeros(row.sizeValue)} ${p.sizeUnits[row.sizeUnit]}`;
            return {
              id: row.id,
              search: [row.name, size, row.unit ? p.units[row.unit] : "", row.hsnCode ?? "", row.price].join(" "),
              cells: [
                <span key="n" className="flex items-center gap-3 font-medium">
                  <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/70 text-brand">
                    <Icon name="box" className="h-4 w-4" />
                  </span>
                  {row.name}
                </span>,
                size,
                row.unit ? (
                  <span key="u" className="rounded-full bg-accent/60 px-2.5 py-0.5 text-xs font-medium text-muted">
                    {p.units[row.unit]}
                  </span>
                ) : (
                  <span key="u" className="text-muted">—</span>
                ),
                row.hsnCode ?? <span className="text-muted">—</span>,
                <span key="p" className="font-medium">
                  {money.format(Number(row.price))}
                  {row.unit && <span className="font-normal text-muted"> / {p.units[row.unit].toLowerCase()}</span>}
                </span>,
                ...(isOwner ? [<ProductRowActions key="a" t={p} labels={d.rowActions} product={row} />] : []),
              ],
            };
          })}
        />
      )}
    </section>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<SectionSkeleton />}>
      <ProductsContent />
    </Suspense>
  );
}
