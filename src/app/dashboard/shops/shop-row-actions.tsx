"use client";

import { deleteShop } from "@/lib/shop-actions";
import type { ShopInput } from "@/lib/shops";
import type { Dictionary } from "@/i18n/dictionaries";
import { RowActions } from "../_components/row-actions";
import { AddShopDialog } from "./add-shop-dialog";

/** ⋮ menu for one shop row: Edit (prefilled popup) and Delete. */
export function ShopRowActions({
  t,
  labels,
  shop,
}: {
  t: Dictionary["dashboard"]["shops"];
  labels: Dictionary["dashboard"]["rowActions"];
  shop: ShopInput & { id: string };
}) {
  const { id, ...values } = shop;
  return (
    <RowActions
      labels={labels}
      manage={t.manage}
      name={shop.firmName}
      onDelete={() => deleteShop(id)}
      renderEdit={(close) => <AddShopDialog t={t} edit={{ id, values }} onClose={close} />}
    />
  );
}
