"use client";

import { deleteProduct } from "@/lib/product-actions";
import type { ProductInput } from "@/lib/products";
import type { Dictionary } from "@/i18n/dictionaries";
import { RowActions } from "../_components/row-actions";
import { AddProductDialog } from "./add-product-dialog";

/** "25.000" → "25", "0.500" → "0.5" */
const trimZeros = (n: string) => n.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");

/** ⋮ menu for one product row: Edit (prefilled popup) and Delete. */
export function ProductRowActions({
  t,
  labels,
  product,
}: {
  t: Dictionary["dashboard"]["products"];
  labels: Dictionary["dashboard"]["rowActions"];
  product: ProductInput & { id: string };
}) {
  const { id, ...values } = product;
  return (
    <RowActions
      labels={labels}
      manage={t.manage}
      name={product.name}
      onDelete={() => deleteProduct(id)}
      renderEdit={(close) => (
        <AddProductDialog t={t} edit={{ id, values: { ...values, sizeValue: trimZeros(values.sizeValue) } }} onClose={close} />
      )}
    />
  );
}
