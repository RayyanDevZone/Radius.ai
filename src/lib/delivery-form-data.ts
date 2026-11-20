import "server-only";
import { listEmployees } from "@/lib/employees-data";
import { listProducts } from "@/lib/products-data";
import { listShops } from "@/lib/shops-data";
import { listVehicles } from "@/lib/vehicles-data";
import { formatVehicleNumber } from "@/lib/vehicles";

export type Option = { id: string; label: string; hint?: string };
export type ProductOption = Option & { price: string };

export type DeliveryFormOptions = {
  shops: Option[];
  products: ProductOption[];
  vehicles: Option[];
  employees: Option[];
};

/** Choices for the delivery form, all from the current business. Owners only (listEmployees checks). */
export async function getDeliveryFormOptions(): Promise<DeliveryFormOptions> {
  const [shops, products, vehicles, employees] = await Promise.all([listShops(), listProducts(), listVehicles(), listEmployees()]);
  return {
    shops: shops.map((s) => ({ id: s.id, label: s.firmName, hint: s.ownerName })),
    products: products.map((p) => ({ id: p.id, label: p.name, price: p.price })),
    vehicles: vehicles.map((v) => ({ id: v.id, label: formatVehicleNumber(v.number) })),
    employees: employees.map((e) => ({ id: e.userId, label: e.name, hint: e.designation ?? undefined })),
  };
}
