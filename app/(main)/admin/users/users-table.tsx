"use client";

import { useMemo, useState, type ComponentProps, type ReactNode } from "react";
import { Ban, KeyRound, LogOut, Plus, ShieldCheck, VenetianMask } from "lucide-react";
import { DataTable, type DataTableFilter } from "@/components/data-table/data-table";
import { dataTableColumns } from "@/components/data-table/features";
import { DeleteIconButton, EditIconButton } from "@/components/data-table/row-actions";
import { ConfirmAction } from "@/components/forms/confirm-action";
import { Field, SelectField } from "@/components/forms/field";
import { AddButton, FormDialog } from "@/components/forms/form-dialog";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { userStatusLabels } from "@/lib/labels";
import { formatDateTime } from "@/lib/utils/date";
import { banUser, createUser, deleteUser, revokeSessions, setUserPassword, unbanUser, updateUser } from "@/modules/users/actions";
import type { UserListItem, UserManageFlags } from "@/modules/users/queries";

type Option = { value: string; label: string };

function IconAction({ label, children, ...props }: { label: string; children: ReactNode } & ComponentProps<typeof Button>) {
  return (
    <Button variant="ghost" size="icon-sm" aria-label={label} title={label} className="rounded-lg text-muted-foreground hover:text-primary" {...props}>
      {children}
    </Button>
  );
}

const roleText = (role: string, roles: Option[]) =>
  role
    .split(",")
    .map((r) => roles.find((o) => o.value === r.trim())?.label ?? r.trim())
    .join(", ");

function UserDialog({
  row,
  departments,
  roles,
  canSetRole,
  isSelf,
  trigger,
}: {
  row?: UserListItem;
  departments: Option[];
  roles: Option[];
  canSetRole: boolean;
  isSelf: boolean;
  trigger: ReactNode;
}) {
  const roleLocked = !!row && (isSelf || !canSetRole);
  return (
    <FormDialog
      title={row ? `แก้ไขผู้ใช้ ${row.name}` : "เพิ่มผู้ใช้"}
      trigger={trigger}
      action={row ? updateUser : createUser}
      hidden={row ? { id: row.id, ...(roleLocked ? { role: row.role } : {}) } : undefined}
    >
      {(state) => {
        const fe = (state.fieldErrors ?? {}) as Partial<Record<string, string[]>>;
        return (
          <>
            <Field label="ชื่อ-นามสกุล" name="name" defaultValue={row?.name} required autoFocus errors={fe.name} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Username" name="username" defaultValue={row?.username} required autoComplete="off" errors={fe.username} />
              <Field label="อีเมล" name="email" type="email" defaultValue={row?.email} required errors={fe.email} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {roleLocked ? (
                <div className="space-y-1.5">
                  <p className="text-sm font-semibold">บทบาท</p>
                  <p className="flex h-12 items-center rounded-xl bg-muted/50 px-4 text-sm text-muted-foreground">
                    {roleText(row.role, roles)}
                    {isSelf && " (บัญชีของคุณ)"}
                  </p>
                </div>
              ) : (
                <SelectField label="บทบาท" name="role" options={roles} defaultValue={row?.role ?? "user"} required errors={fe.role} />
              )}
              <SelectField label="แผนก" name="departmentId" options={departments} defaultValue={row?.departmentId || undefined} allowEmpty errors={fe.departmentId} />
            </div>
            <Field label="โทรศัพท์" name="phone" defaultValue={row?.phone} errors={fe.phone} />
            {!row && <Field label="รหัสผ่านเริ่มต้น" name="password" type="password" required autoComplete="new-password" hint="อย่างน้อย 8 ตัวอักษร" errors={fe.password} />}
          </>
        );
      }}
    </FormDialog>
  );
}

function PasswordDialog({ row }: { row: UserListItem }) {
  return (
    <FormDialog
      title={`ตั้งรหัสผ่านใหม่ให้ ${row.name}`}
      description="ผู้ใช้จะถูกออกจากระบบทุกอุปกรณ์"
      trigger={
        <IconAction label="ตั้งรหัสผ่านใหม่">
          <KeyRound />
        </IconAction>
      }
      action={setUserPassword}
      hidden={{ id: row.id }}
      submitLabel="ตั้งรหัสผ่าน"
    >
      {(state) => (
        <>
          <Field label="รหัสผ่านใหม่" name="password" type="password" required autoFocus autoComplete="new-password" errors={state.fieldErrors?.password} />
          <Field label="ยืนยันรหัสผ่านใหม่" name="confirmPassword" type="password" required autoComplete="new-password" errors={state.fieldErrors?.confirmPassword} />
        </>
      )}
    </FormDialog>
  );
}

function BanDialog({ row }: { row: UserListItem }) {
  return (
    <FormDialog
      title={`ระงับการใช้งาน ${row.name}?`}
      description="ผู้ใช้จะถูกออกจากระบบทันทีและเข้าสู่ระบบไม่ได้จนกว่าจะเปิดใช้งาน"
      trigger={
        <IconAction label="ระงับการใช้งาน" className="rounded-lg text-muted-foreground hover:text-destructive">
          <Ban />
        </IconAction>
      }
      action={banUser}
      hidden={{ id: row.id }}
      submitLabel="ระงับการใช้งาน"
    >
      {(state) => <Field label="เหตุผล" name="reason" errors={state.fieldErrors?.reason} />}
    </FormDialog>
  );
}

function ImpersonateButton({ row }: { row: UserListItem }) {
  const [pending, setPending] = useState(false);
  return (
    <ConfirmAction
      title={`เข้าใช้งานในฐานะ ${row.name}?`}
      description="ทุกการกระทำจะถูกบันทึกว่าทำแทนโดยคุณ ระหว่างนี้ใช้งาน Backup/Restore และล้าง Log ไม่ได้ (หมดอายุอัตโนมัติใน 1 ชั่วโมง)"
      confirmLabel="เข้าใช้งานแทน"
      variant="gradient"
      onConfirm={async () => {
        setPending(true);
        const { error } = await authClient.admin.impersonateUser({ userId: row.id });
        if (error) {
          setPending(false);
          return { message: error.message ?? "ไม่สามารถเข้าใช้งานแทนได้" };
        }
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full reload drops routes cached with the previous session
        window.location.href = "/dashboard";
        return { ok: true, message: `กำลังเข้าใช้งานในฐานะ ${row.name}` };
      }}
      trigger={
        <IconAction label="เข้าใช้งานแทน (Impersonate)" disabled={pending}>
          <VenetianMask />
        </IconAction>
      }
    />
  );
}

const col = dataTableColumns<UserListItem>();

function buildColumns(can: UserManageFlags, departments: Option[], roles: Option[], currentUserId: string, impersonating: boolean) {
  return col.columns([
    col.accessor("name", {
      header: "ชื่อ",
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand/15 font-semibold text-brand">{row.original.name.charAt(0)}</span>
          <div>
            <div className="font-semibold">{row.original.name}</div>
            <div className="text-xs text-muted-foreground">@{row.original.username}</div>
          </div>
        </div>
      ),
    }),
    col.accessor("username", { header: "Username" }),
    col.accessor("email", { header: "อีเมล" }),
    col.accessor("department", { header: "แผนก", cell: ({ getValue }) => getValue() || "-" }),
    col.accessor("role", {
      header: "บทบาท",
      filterFn: "equalsString",
      cell: ({ getValue }) => <span className="rounded-full bg-brand/10 px-2.5 py-1 text-xs font-semibold text-brand">{roleText(getValue(), roles)}</span>,
      meta: { export: (u) => roleText(u.role, roles) },
    }),
    col.accessor("status", {
      header: "สถานะ",
      filterFn: "equalsString",
      cell: ({ row }) => (
        <span
          title={row.original.banReason || undefined}
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
            row.original.status === "active" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : "bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300"
          }`}
        >
          {userStatusLabels[row.original.status]}
        </span>
      ),
      meta: { export: (u) => userStatusLabels[u.status] },
    }),
    col.accessor("lastActiveAt", {
      header: "ใช้งานล่าสุด",
      sortFn: "datetime",
      sortUndefined: "last",
      cell: ({ getValue }) => formatDateTime(getValue()),
      meta: { export: (u) => formatDateTime(u.lastActiveAt) },
    }),
    col.display({
      id: "actions",
      header: "",
      meta: { align: "right", export: false },
      cell: ({ row }) => {
        const u = row.original;
        const self = u.id === currentUserId;
        const isAdmin = u.role.split(",").includes("admin");
        return (
          <div className="flex justify-end gap-0.5">
            {can.update && <UserDialog row={u} departments={departments} roles={roles} canSetRole={can.setRole} isSelf={self} trigger={<EditIconButton />} />}
            {can.setPassword && <PasswordDialog row={u} />}
            {can.ban && !self && (
              <ConfirmAction
                title={`ออกจากระบบทุกอุปกรณ์ของ ${u.name}?`}
                confirmLabel="ออกจากระบบ"
                variant="default"
                onConfirm={() => revokeSessions(u.id)}
                trigger={
                  <IconAction label="ออกจากระบบทุกอุปกรณ์">
                    <LogOut />
                  </IconAction>
                }
              />
            )}
            {can.ban && !self && u.status === "active" && <BanDialog row={u} />}
            {can.ban && !self && u.status === "banned" && (
              <ConfirmAction
                title={`เปิดใช้งาน ${u.name}?`}
                confirmLabel="เปิดใช้งาน"
                variant="gradient"
                onConfirm={() => unbanUser(u.id)}
                trigger={
                  <IconAction label="เปิดใช้งาน">
                    <ShieldCheck />
                  </IconAction>
                }
              />
            )}
            {can.impersonate && !impersonating && !self && !isAdmin && u.status === "active" && <ImpersonateButton row={u} />}
            {can.delete && !self && (
              <ConfirmAction
                title={`ลบผู้ใช้ ${u.name}?`}
                description="บัญชีจะเข้าสู่ระบบไม่ได้อีก ประวัติการใช้งานยังคงอยู่"
                onConfirm={() => deleteUser(u.id)}
                trigger={<DeleteIconButton />}
              />
            )}
          </div>
        );
      },
    }),
  ]);
}

const statusFilter: DataTableFilter = { columnId: "status", label: "สถานะ", options: Object.entries(userStatusLabels).map(([value, label]) => ({ value, label })) };

export function UsersTable({
  users,
  departments,
  roles,
  can,
  currentUserId,
  impersonating,
}: {
  users: UserListItem[];
  departments: Option[];
  roles: Option[];
  can: UserManageFlags;
  currentUserId: string;
  impersonating: boolean;
}) {
  const columns = useMemo(() => buildColumns(can, departments, roles, currentUserId, impersonating), [can, departments, roles, currentUserId, impersonating]);
  const filters = useMemo<DataTableFilter[]>(() => [{ columnId: "role", label: "บทบาท", options: roles }, statusFilter], [roles]);
  return (
    <DataTable
      data={users}
      columns={columns}
      filters={filters}
      exportName="users"
      printTitle="รายชื่อผู้ใช้งาน"
      searchPlaceholder="ค้นหาชื่อ, username, อีเมล..."
      actions={
        can.create && (
          <UserDialog
            departments={departments}
            roles={roles}
            canSetRole={can.setRole}
            isSelf={false}
            trigger={
              <AddButton>
                <Plus /> เพิ่มผู้ใช้
              </AddButton>
            }
          />
        )
      }
    />
  );
}

