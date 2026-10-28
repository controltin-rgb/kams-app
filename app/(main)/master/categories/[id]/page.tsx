import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Shapes } from "lucide-react";
import { PageHeader, Panel } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { crudFlags } from "@/lib/permissions-server";
import { requirePermission } from "@/lib/session";
import { getCategoryWithProperties } from "@/modules/master/queries";
import { PropertiesTable } from "./properties-table";

export const metadata: Metadata = { title: "Property ของประเภท | AMS" };

export default async function CategoryPropertiesPage({ params }: PageProps<"/master/categories/[id]">) {
  const session = await requirePermission("masterData", "view");
  const { id } = await params;
  const category = await getCategoryWithProperties(id);
  if (!category) notFound();

  return (
    <div className="mx-auto max-w-400 space-y-6">
      <PageHeader
        icon={Shapes}
        tone="violet"
        title={
          <>
            {category.name} <span className="ml-1 font-mono text-lg text-muted-foreground">({category.codePrefix})</span>
          </>
        }
        description={category.description || "กำหนดข้อมูลเฉพาะที่ต้องกรอกสำหรับครุภัณฑ์ประเภทนี้"}
        actions={
          <Button asChild variant="outline" className="h-10 rounded-xl">
            <Link href="/master/categories">
              <ChevronLeft /> กลับ
            </Link>
          </Button>
        }
      />
      <Panel>
        <PropertiesTable categoryId={category.id} rows={category.propertyDefs} can={crudFlags(session.user.role, "masterData")} />
      </Panel>
    </div>
  );
}
