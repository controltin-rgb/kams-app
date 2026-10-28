import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { requirePermission } from "@/lib/session";
import { updateAsset } from "@/modules/assets/actions";
import { getAsset, getAssetFormOptions } from "@/modules/assets/queries";
import { AssetForm } from "../../asset-form";

export const metadata: Metadata = { title: "แก้ไขครุภัณฑ์ | AMS" };

export default async function EditAssetPage({ params }: PageProps<"/assets/[id]/edit">) {
  await requirePermission("asset", "update");
  const { id } = await params;
  const [asset, options] = await Promise.all([getAsset(id), getAssetFormOptions()]);
  if (!asset) notFound();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader icon={Pencil} tone="orange" title={`แก้ไข ${asset.assetCode}`} description={asset.name} />
      <AssetForm
        mode="edit"
        action={updateAsset}
        options={options}
        cancelHref={`/assets/${asset.id}`}
        values={{
          id: asset.id,
          categoryId: asset.categoryId,
          name: asset.name,
          brand: asset.brand,
          model: asset.model,
          serialNumber: asset.serialNumber,
          barcode: asset.barcode,
          purchaseDate: asset.purchaseDate,
          warrantyExpiry: asset.warrantyExpiry,
          cost: asset.cost,
          condition: asset.condition,
          ownerId: asset.ownerId,
          departmentId: asset.departmentId,
          locationId: asset.locationId,
          note: asset.note,
          propertyValues: asset.propertyValues,
        }}
      />
    </div>
  );
}
