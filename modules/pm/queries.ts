import "server-only";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { listLocations } from "@/modules/master/queries";
import { checklistSchema, type ChecklistItem, type ChecklistResult } from "./schemas";

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

export async function listSchedules() {
  const [rows, locations] = await Promise.all([
    prisma.pmSchedule.findMany({
      orderBy: [{ active: "desc" }, { nextDueDate: "asc" }],
      include: {
        asset: { select: { assetCode: true, name: true } },
        assignedTech: { select: { name: true } },
        _count: { select: { runs: { where: { status: "DONE" } } } },
      },
    }),
    listLocations(),
  ]);
  const path = new Map(locations.map((l) => [l.id, l.path]));
  return rows.map((s) => ({
    id: s.id,
    title: s.title,
    frequency: s.frequency,
    target: s.asset ? `${s.asset.assetCode} ${s.asset.name}` : s.locationId ? (path.get(s.locationId) ?? "") : "",
    assignedTech: s.assignedTech?.name ?? "",
    nextDueDate: iso(s.nextDueDate),
    active: s.active,
    doneCount: s._count.runs,
  }));
}
export type ScheduleRow = Awaited<ReturnType<typeof listSchedules>>[number];

export async function getSchedule(id: string) {
  const s = await prisma.pmSchedule.findUnique({ where: { id } });
  if (!s) return null;
  const checklist = checklistSchema.safeParse(s.checklistTemplate);
  return {
    id: s.id,
    title: s.title,
    description: s.description,
    assetId: s.assetId,
    locationId: s.locationId,
    frequency: s.frequency,
    startDate: iso(s.startDate)!,
    assignedTechId: s.assignedTechId,
    active: s.active,
    checklist: checklist.success ? checklist.data : ([] as ChecklistItem[]),
  };
}
export type ScheduleDetail = NonNullable<Awaited<ReturnType<typeof getSchedule>>>;

/** Runs between two dates (inclusive) for the calendar and the work list. */
export async function listRuns(from: Date, to: Date) {
  const [rows, locations] = await Promise.all([
    prisma.pmRun.findMany({
      where: { dueDate: { gte: from, lte: to } },
      orderBy: [{ dueDate: "asc" }],
      include: {
        schedule: {
          select: { title: true, frequency: true, locationId: true, asset: { select: { assetCode: true, name: true } }, assignedTech: { select: { id: true, name: true } } },
        },
      },
    }),
    listLocations(),
  ]);
  const path = new Map(locations.map((l) => [l.id, l.path]));
  return rows.map((r) => ({
    id: r.id,
    dueDate: iso(r.dueDate)!,
    status: r.status,
    title: r.schedule.title,
    target: r.schedule.asset ? `${r.schedule.asset.assetCode} ${r.schedule.asset.name}` : r.schedule.locationId ? (path.get(r.schedule.locationId) ?? "") : "",
    assignedTech: r.schedule.assignedTech?.name ?? "",
    assignedTechId: r.schedule.assignedTech?.id ?? null,
  }));
}
export type RunRow = Awaited<ReturnType<typeof listRuns>>[number];

/** Open work: overdue + upcoming not-yet-done runs */
export async function openRuns() {
  const rows = await prisma.pmRun.findMany({ where: { status: { in: ["SCHEDULED", "OVERDUE", "IN_PROGRESS"] } }, select: { dueDate: true } });
  if (!rows.length) return [];
  const dates = rows.map((r) => r.dueDate.getTime());
  return listRuns(new Date(Math.min(...dates)), new Date(Math.max(...dates))).then((all) => all.filter((r) => ["SCHEDULED", "OVERDUE", "IN_PROGRESS"].includes(r.status)));
}

export async function getRun(id: string) {
  const r = await prisma.pmRun.findUnique({
    where: { id },
    include: { schedule: { include: { asset: { select: { id: true, assetCode: true, name: true } }, assignedTech: { select: { name: true } } } } },
  });
  if (!r) return null;
  const [doneBy, locations] = await Promise.all([
    r.doneById ? prisma.user.findUnique({ where: { id: r.doneById }, select: { name: true } }) : null,
    listLocations(),
  ]);
  const checklist = checklistSchema.safeParse(r.schedule.checklistTemplate);
  return {
    id: r.id,
    dueDate: iso(r.dueDate)!,
    status: r.status,
    notes: r.notes,
    startedAt: r.startedAt,
    doneAt: r.doneAt,
    doneBy: doneBy?.name ?? null,
    results: (Array.isArray(r.checklistResult) ? r.checklistResult : []) as ChecklistResult[],
    schedule: {
      id: r.schedule.id,
      title: r.schedule.title,
      description: r.schedule.description,
      frequency: r.schedule.frequency,
      asset: r.schedule.asset,
      location: r.schedule.locationId ? (locations.find((l) => l.id === r.schedule.locationId)?.path ?? null) : null,
      assignedTech: r.schedule.assignedTech?.name ?? null,
      checklist: checklist.success ? checklist.data : ([] as ChecklistItem[]),
    },
  };
}
export type RunDetail = NonNullable<Awaited<ReturnType<typeof getRun>>>;

export async function scheduleFormOptions() {
  const [assets, locations, users] = await Promise.all([
    prisma.asset.findMany({ where: { deletedAt: null, status: { not: "DISPOSED" } }, orderBy: { assetCode: "asc" }, select: { id: true, assetCode: true, name: true } }),
    listLocations(),
    prisma.user.findMany({ where: { banned: false }, orderBy: { name: "asc" }, select: { id: true, name: true, role: true } }),
  ]);
  return {
    assets: assets.map((a) => ({ value: a.id, label: `${a.assetCode} ${a.name}` })),
    locations: locations.map((l) => ({ value: l.id, label: l.path })),
    techs: users.filter((u) => can(u.role, "pm", "execute")).map((u) => ({ value: u.id, label: u.name })),
  };
}
export type ScheduleFormOptions = Awaited<ReturnType<typeof scheduleFormOptions>>;
