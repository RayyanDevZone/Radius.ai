"use client";

import { deleteVehicle } from "@/lib/vehicle-actions";
import { formatVehicleNumber, type VehicleInput } from "@/lib/vehicles";
import type { Dictionary } from "@/i18n/dictionaries";
import { RowActions } from "../_components/row-actions";
import { AddVehicleDialog } from "./add-vehicle-dialog";

/** ⋮ menu for one vehicle row: Edit (prefilled popup) and Delete. */
export function VehicleRowActions({
  t,
  labels,
  vehicle,
}: {
  t: Dictionary["dashboard"]["vehicles"];
  labels: Dictionary["dashboard"]["rowActions"];
  vehicle: VehicleInput & { id: string };
}) {
  const { id, ...values } = vehicle;
  return (
    <RowActions
      labels={labels}
      manage={t.manage}
      name={formatVehicleNumber(vehicle.number)}
      onDelete={() => deleteVehicle(id)}
      renderEdit={(close) => <AddVehicleDialog t={t} edit={{ id, values }} onClose={close} />}
    />
  );
}
