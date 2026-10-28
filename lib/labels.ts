export const roleLabels: Record<string, string> = {
  admin: "ผู้ดูแลระบบ",
  manager: "ผู้จัดการ",
  technician: "ช่างเทคนิค",
  helpdesk: "เจ้าหน้าที่ Helpdesk",
  auditor: "ผู้ตรวจนับ",
  user: "ผู้ใช้งาน",
};

export const userStatusLabels = {
  active: "ใช้งาน",
  banned: "ระงับ",
} as const;

// ---------- Asset ----------
export const assetStatusLabels = {
  SPARE: "สำรอง/ในคลัง",
  ACTIVE: "พร้อมใช้งาน",
  IN_USE: "ใช้งานอยู่",
  IN_MAINTENANCE: "ระหว่างซ่อม",
  CLAIMING: "ส่งเคลม",
  PENDING_DISPOSAL: "รอจำหน่าย",
  DISPOSED: "จำหน่ายแล้ว",
} as const;

/** Tailwind classes for status badges (light + dark) */
export const assetStatusTone = {
  SPARE: "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  ACTIVE: "bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300",
  IN_USE: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  IN_MAINTENANCE: "bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
  CLAIMING: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  PENDING_DISPOSAL: "bg-pink-50 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300",
  DISPOSED: "bg-muted text-muted-foreground",
} as const;

/** Statuses allowed when registering a new asset; later changes go through Ticket/Swap/Claim/Audit */
export const initialAssetStatuses = ["SPARE", "ACTIVE", "IN_USE"] as const;

export const assetConditionLabels = {
  GOOD: "ดี",
  FAIR: "พอใช้",
  DAMAGED: "ชำรุด",
} as const;

export const assetHistoryLabels: Record<string, string> = {
  CREATED: "ลงทะเบียน",
  UPDATED: "แก้ไขข้อมูล",
  ASSIGNED: "เปลี่ยนผู้ถือครอง",
  MOVED: "ย้ายสถานที่",
  STATUS_CHANGED: "เปลี่ยนสถานะ",
  CONDITION_CHANGED: "เปลี่ยนสภาพ",
  ATTACHED: "ติดตั้งเข้าชุด",
  DETACHED: "ถอดออกจากชุด",
  SWAPPED: "เปลี่ยนเครื่อง (Swap)",
  PM_DONE: "บำรุงรักษา (PM)",
  SERIAL_REPLACED: "เปลี่ยนเครื่องจากการเคลม",
  AUDIT_MISSING: "ไม่พบในการตรวจนับ",
  DELETED: "ลบ",
};

// ---------- Master data ----------
export const locationTypeLabels = {
  BUILDING: "อาคาร",
  FLOOR: "ชั้น",
  ROOM: "ห้อง",
  SPOT: "จุด",
} as const;

/** Hierarchy order: a child must be a deeper level than its parent */
export const locationTypeOrder = ["BUILDING", "FLOOR", "ROOM", "SPOT"] as const;

export const propertyTypeLabels = {
  TEXT: "ข้อความ",
  NUMBER: "ตัวเลข",
  DATE: "วันที่",
  SELECT: "ตัวเลือก",
  BOOLEAN: "ใช่/ไม่ใช่",
} as const;

// ---------- Ticket ----------
export const ticketStatusLabels = {
  OPEN: "รอดำเนินการ",
  IN_PROGRESS: "กำลังดำเนินการ",
  ON_HOLD: "รอชิ้นส่วน/พักไว้",
  RESOLVED: "แก้ไขเสร็จ",
  CLOSED: "ปิดงาน",
  CANCELLED: "ยกเลิก",
} as const;

export const ticketStatusTone = {
  OPEN: "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  IN_PROGRESS: "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  ON_HOLD: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  RESOLVED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  CLOSED: "bg-muted text-muted-foreground",
  CANCELLED: "bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300",
} as const;

export const ticketPriorityLabels = {
  LOW: "ต่ำ",
  MEDIUM: "ปานกลาง",
  HIGH: "สูง",
  CRITICAL: "วิกฤต",
} as const;

export const ticketPriorityTone = {
  LOW: "bg-muted text-muted-foreground",
  MEDIUM: "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  HIGH: "bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
  CRITICAL: "bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300",
} as const;

export const ticketCategoryLabels = {
  IT: "ไอที",
  FACILITY: "อาคาร/ไฟฟ้า",
  GENERAL: "ทั่วไป",
} as const;

export const ticketSourceLabels = {
  WEB: "เว็บ",
  QR: "สแกน QR",
  QR_PUBLIC: "สแกน QR (ไม่ล็อกอิน)",
} as const;

// ---------- Deployment / Bundle ----------
export const transferTypeLabels = {
  HANDOVER: "ส่งมอบ",
  RETURN: "คืนคลัง",
  MOVE: "ย้ายสถานที่",
  SWAP_PARTIAL: "เปลี่ยนชิ้นส่วน (Partial Swap)",
  SWAP_FULL: "เปลี่ยนทั้งชุด (Full Set Swap)",
} as const;

export const transferItemActionLabels = {
  ASSIGN: "ส่งมอบ",
  RETURN: "คืน",
  MOVE: "ย้าย",
  ATTACH: "ติดตั้งเข้าชุด",
  DETACH: "ถอดออกจากชุด",
} as const;

export const relationTypeLabels = {
  COMPONENT: "ชิ้นส่วน",
  ACCESSORY: "อุปกรณ์เสริม",
  SOFTWARE: "ซอฟต์แวร์",
} as const;

/** Statuses a detached / returned / swapped-out asset can go to */
export const returnStatuses = ["SPARE", "IN_MAINTENANCE", "PENDING_DISPOSAL"] as const;

// ---------- PM ----------
export const pmFrequencyLabels = {
  WEEKLY: "ทุกสัปดาห์",
  MONTHLY: "ทุกเดือน",
  QUARTERLY: "ทุก 3 เดือน",
  YEARLY: "ทุกปี",
} as const;

export const pmRunStatusLabels = {
  SCHEDULED: "รอดำเนินการ",
  IN_PROGRESS: "กำลังทำ",
  DONE: "เสร็จแล้ว",
  SKIPPED: "ข้าม",
  OVERDUE: "เลยกำหนด",
} as const;

export const pmRunStatusTone = {
  SCHEDULED: "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  IN_PROGRESS: "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  DONE: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  SKIPPED: "bg-muted text-muted-foreground",
  OVERDUE: "bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300",
} as const;

export const checklistItemTypeLabels = {
  CHECK: "ผ่าน / ไม่ผ่าน",
  NUMBER: "ตัวเลข",
  TEXT: "ข้อความ",
} as const;

// ---------- Claim ----------
export const claimStatusLabels = {
  SENT: "ส่งเคลมแล้ว",
  IN_REPAIR: "ผู้ขายกำลังซ่อม",
  RETURNED: "รับคืนแล้ว",
  REPLACED: "เปลี่ยนเครื่องใหม่",
  CANCELLED: "ยกเลิก",
} as const;

export const claimStatusTone = {
  SENT: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  IN_REPAIR: "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  RETURNED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  REPLACED: "bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300",
  CANCELLED: "bg-muted text-muted-foreground",
} as const;

// ---------- Stock Take ----------
export const campaignStatusLabels = {
  DRAFT: "ร่าง",
  IN_PROGRESS: "กำลังตรวจนับ",
  COMPLETED: "ปิดการสแกน / รอตรวจสอบ",
  CLOSED: "ปิดรอบแล้ว",
} as const;

export const campaignStatusTone = {
  DRAFT: "bg-muted text-muted-foreground",
  IN_PROGRESS: "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  COMPLETED: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  CLOSED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
} as const;

export const auditResultLabels = {
  MATCHED: "ตรงตามทะเบียน",
  RELOCATED: "พบต่างสถานที่",
  MISSING: "ไม่พบ",
  UNREGISTERED: "ไม่มีในทะเบียน",
} as const;

export const auditResultTone = {
  MATCHED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  RELOCATED: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  MISSING: "bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300",
  UNREGISTERED: "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
} as const;

export const auditDecisionLabels = {
  APPLY: "ปรับปรุงทะเบียน",
  IGNORE: "ไม่ปรับปรุง",
} as const;

// ---------- Audit log ----------
export const logModuleLabels: Record<string, string> = {
  auth: "เข้าสู่ระบบ",
  profile: "โปรไฟล์",
  user: "ผู้ใช้งาน",
  asset: "ครุภัณฑ์",
  category: "ประเภทครุภัณฑ์",
  location: "สถานที่",
  department: "แผนก",
  vendor: "ผู้ขาย",
  ticket: "แจ้งซ่อม",
  deployment: "ส่งมอบ/เปลี่ยนเครื่อง",
  label: "ฉลาก",
  pm: "บำรุงรักษา (PM)",
  claim: "ส่งเคลม",
  audit: "ตรวจนับ",
  system: "ระบบ",
  log: "Audit Log",
  backup: "Backup",
  notification: "การแจ้งเตือน",
  role: "สิทธิ์การใช้งาน",
};

export const logActionLabels: Record<string, string> = {
  LOGIN: "เข้าสู่ระบบ",
  LOGOUT: "ออกจากระบบ",
  IMPERSONATE_START: "เริ่มเข้าใช้งานแทน",
  IMPERSONATE_STOP: "จบการเข้าใช้งานแทน",
  CREATE: "สร้าง",
  UPDATE: "แก้ไข",
  DELETE: "ลบ",
  SET_ROLE: "เปลี่ยนบทบาท",
  SET_PASSWORD: "ตั้งรหัสผ่านใหม่",
  CHANGE_PASSWORD: "เปลี่ยนรหัสผ่าน",
  BAN: "ระงับผู้ใช้",
  UNBAN: "เปิดใช้งานผู้ใช้",
  REVOKE_SESSIONS: "ออกจากระบบทุกอุปกรณ์",
  IMPORT: "นำเข้า",
  PRINT: "พิมพ์",
  UPDATE_SETTINGS: "แก้ไขการตั้งค่า",
  LOG_CLEAR: "ล้าง Log",
  BACKUP: "สำรองข้อมูล",
  BACKUP_AUTO: "สำรองข้อมูลอัตโนมัติ",
  BACKUP_FAILED: "สำรองข้อมูลล้มเหลว",
  RESTORE: "กู้คืนข้อมูล",
  RESTORE_FAILED: "กู้คืนข้อมูลล้มเหลว",
  DOWNLOAD: "ดาวน์โหลด",
  CRON_NOTIFY: "ส่งการแจ้งเตือนตามรอบเวลา",
  NOTIFY_FAILED: "ส่งการแจ้งเตือนล้มเหลว",
  NOTIFY_TEST: "ทดสอบการแจ้งเตือน",
  RESET: "คืนค่าเริ่มต้น",
};

export const backupKindLabels = {
  manual: "สร้างเอง",
  auto: "อัตโนมัติ",
  prerestore: "ก่อนกู้คืน",
} as const;

export const notificationEventLabels: Record<string, string> = {
  TICKET_CREATED: "งานแจ้งซ่อมใหม่",
  TICKET_ASSIGNED: "มอบหมายงาน",
  TICKET_STATUS: "สถานะงานซ่อม",
  TICKET_SLA_OVERDUE: "เกิน SLA",
  PM_DUE: "PM ใกล้ถึงกำหนด",
  PM_OVERDUE: "PM เลยกำหนด",
  CLAIM_OVERDUE: "เคลมเกินกำหนด",
  WARRANTY_EXPIRING: "ประกันใกล้หมด",
  BACKUP_FAILED: "สำรองข้อมูลล้มเหลว",
  TEST: "ทดสอบ",
};

export const notificationStatusLabels = { unread: "ยังไม่อ่าน", read: "อ่านแล้ว" } as const;

// ---------- Roles & permissions ----------
export const resourceLabels: Record<string, string> = {
  asset: "ครุภัณฑ์",
  masterData: "ข้อมูลหลัก",
  deployment: "การถือครอง & Swap",
  ticket: "แจ้งซ่อม",
  pm: "บำรุงรักษา (PM)",
  claim: "ส่งเคลม",
  audit: "ตรวจนับครุภัณฑ์",
  label: "ฉลาก",
  report: "รายงาน / Dashboard",
  user: "ผู้ใช้งาน",
  role: "สิทธิ์การใช้งาน",
  log: "Audit Log",
  backup: "Backup / Restore",
  system: "ระบบ / การตั้งค่า",
  office3d: "3D Office",
};

export const actionLabels: Record<string, string> = {
  view: "ดู",
  create: "เพิ่ม",
  update: "แก้ไข",
  delete: "ลบ",
  import: "นำเข้า",
  export: "ส่งออก",
  printLabel: "พิมพ์ฉลาก",
  swap: "เปลี่ยนเครื่อง",
  assign: "มอบหมายงาน",
  close: "ปิดงาน",
  viewAll: "ดูทุกรายการ",
  execute: "ทำ PM",
  scan: "สแกนตรวจนับ",
  approve: "อนุมัติผล",
  list: "ดูรายชื่อ",
  get: "ดูรายละเอียด",
  "set-role": "กำหนดบทบาท",
  "set-password": "ตั้งรหัสผ่าน",
  ban: "ระงับ/ออกจากระบบ",
  impersonate: "เข้าใช้งานแทน",
  clear: "ล้าง Log",
  run: "สำรองข้อมูล",
  restore: "กู้คืนข้อมูล",
  editInfo: "แก้ไขการตั้งค่า",
  configureLayout: "จัดผังสำนักงาน",
  viewAllZones: "ดูทุกโซน",
};

export const roleKindLabels = {
  locked: "ระบบ (ทุกสิทธิ์)",
  builtIn: "ค่าเริ่มต้น",
  customized: "ค่าเริ่มต้น (แก้ไขแล้ว)",
  custom: "กำหนดเอง",
} as const;

// ---------- 3D Office ----------
/** Zone signs in the 3D Office (keys = zones in office_layout.json) */
export const office3dZoneLabels: Record<string, string> = {
  zone_open_office: "สำนักงาน",
  zone_helpdesk: "Helpdesk แจ้งซ่อม",
  zone_waiting: "พื้นที่รอ",
  zone_manager: "ผู้จัดการ",
  zone_repair_lab: "ห้องซ่อม",
  zone_server: "ห้อง Server",
  zone_storage: "คลังพัสดุ",
};

/** Markers floating above people in the 3D Office */
export const office3dMarkerLabels = {
  reported: "แจ้งซ่อมค้าง",
  overdue: "งานเกินกำหนด",
  working: "กำลังซ่อม",
  onHold: "พักงาน",
} as const;

/** Rendering quality of the 3D Office */
export const office3dQualityLabels = {
  auto: "คุณภาพอัตโนมัติ",
  high: "คุณภาพสูง",
  low: "คุณภาพต่ำ (ประหยัด)",
} as const;

/** Live events in the 3D Office activity feed */
export const sceneEventLabels = {
  TICKET_CREATED: "แจ้งซ่อมใหม่",
  TICKET_ASSIGNED: "มอบหมายช่าง",
  TICKET_STARTED: "เริ่มซ่อม",
  TICKET_ON_HOLD: "พักงาน",
  TICKET_RESOLVED: "ซ่อมเสร็จ",
  TICKET_CLOSED: "ปิดงาน",
  TICKET_UPDATED: "ปรับปรุงงาน",
  PART_USED: "เบิกอะไหล่",
  SWAP_PARTIAL: "เปลี่ยนชิ้นส่วน",
  SWAP_FULL: "เปลี่ยนเครื่องทั้งชุด",
  CLAIM_SENT: "ส่งเคลม",
  CLAIM_RETURNED: "รับคืนจากเคลม",
  PM_STARTED: "เริ่มงาน PM",
  PM_DONE: "PM เสร็จ",
  AUDIT_SCAN: "สแกนตรวจนับ",
  ASSET_STATUS_CHANGED: "สถานะครุภัณฑ์เปลี่ยน",
} as const;

/** 3D models that stand for real things: asset models (category) and furniture slots (location) */
export const office3dModelLabels: Record<string, string> = {
  pc_tower: "คอมพิวเตอร์ (เคส)",
  monitor: "จอภาพ",
  keyboard: "คีย์บอร์ด",
  mouse: "เมาส์",
  laptop: "โน้ตบุ๊ก",
  ups: "UPS",
  printer_mfp: "เครื่องพิมพ์",
  ac_wall: "แอร์ติดผนัง",
  ac_ceiling: "แอร์ติดเพดาน",
  network_switch: "Network Switch",
  wifi_ap: "Wi-Fi AP",
  ip_phone: "โทรศัพท์ IP",
  projector: "โปรเจกเตอร์",
  tablet: "แท็บเล็ต",
  barcode_scanner: "เครื่องสแกนบาร์โค้ด",
  generic_equipment: "อุปกรณ์ทั่วไป",
  desk_staff: "โต๊ะพนักงาน",
  desk_manager: "โต๊ะผู้จัดการ",
  desk_helpdesk: "เคาน์เตอร์ Helpdesk",
  printer_station: "จุดเครื่องพิมพ์",
  workbench_repair: "โต๊ะซ่อม",
  shelf_storage: "ชั้นวางของ",
  rack_server: "ตู้ Server",
  meeting_table: "โต๊ะประชุม",
};
