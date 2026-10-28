import "server-only";
import { can } from "@/lib/permissions";

/** CRUD flags for a resource, passed from server pages to client tables (UX only). */
export function crudFlags(role: string | null | undefined, resource: "masterData" | "asset" | "label") {
  return {
    create: can(role, resource, "create"),
    update: can(role, resource, "update"),
    delete: can(role, resource, "delete"),
  };
}
export type CrudFlags = ReturnType<typeof crudFlags>;
