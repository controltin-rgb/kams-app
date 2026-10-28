// Client-safe types and constants for the 3D Office scene

/** URL of a model file under storage/3dmodels, served by app/api/models. */
export const modelUrl = (file: string) => `/api/models/${file}`;

export type Vec3 = [number, number, number];

export type LayoutItem = { id: string; model: string; position: Vec3; rotationY: number };
export type ScenePlacement = { position: Vec3; rotationY: number };
/** office_layout.json with an id per item (glTF coords, rotationY in degrees) */
export type SceneLayoutConfig = {
  version: number;
  shell: string;
  items: LayoutItem[];
  zones: Record<string, ScenePlacement>;
  waypoints: Vec3[];
};

/** Walk speed that matches the `walk` clip (0.83 s cycle) without visible foot sliding. */
export const WALK_SPEED = 0.65;

/** Model folder per key (manifest.json `path`) */
const folders: Record<string, string> = {};
const group = (folder: string, keys: readonly string[]) => keys.forEach((k) => (folders[k] = folder));

export const ASSET_MODELS = [
  "ac_ceiling",
  "ac_wall",
  "barcode_scanner",
  "generic_equipment",
  "ip_phone",
  "keyboard",
  "laptop",
  "monitor",
  "mouse",
  "network_switch",
  "pc_tower",
  "printer_mfp",
  "projector",
  "tablet",
  "ups",
  "wifi_ap",
] as const;
export type AssetModel = (typeof ASSET_MODELS)[number];

export const CHARACTER_MODELS = [
  "char_staff_a",
  "char_staff_b",
  "char_staff_c",
  "char_helpdesk",
  "char_technician",
  "char_auditor",
  "char_manager",
  "char_courier",
  "char_vendor_tech",
] as const;
export type CharacterModel = (typeof CHARACTER_MODELS)[number];

group("assets", ASSET_MODELS);
group("characters", CHARACTER_MODELS);
group("architecture", ["ceiling_panel", "column", "door_single", "door_vendor", "floor_tile", "floor_tile_lab", "glass_partition", "wall_corner", "wall_door_frame", "wall_straight", "wall_window", "zone_sign"]);
group("furniture", [
  "cabinet_file",
  "chair_office",
  "chair_visitor",
  "desk_helpdesk",
  "desk_manager",
  "desk_staff",
  "meeting_table",
  "plant_pot",
  "printer_station",
  "rack_server",
  "shelf_storage",
  "sofa_waiting",
  "trash_bin",
  "trolley_cart",
  "water_cooler",
  "whiteboard",
  "workbench_repair",
  "workbench_tools_wall",
]);
group("props", ["box_large", "box_small", "cable_roll", "clipboard", "ladder", "package_courier", "parts_box", "screwdriver", "smartphone", "ticket_paper", "toolbox"]);
group("ui", ["marker_alert", "marker_check", "marker_pause", "marker_pin", "marker_wrench", "spawn_marker", "status_ring"]);

/** URL of a model by manifest key, e.g. "desk_staff" → /api/models/furniture/desk_staff.glb */
export function modelKeyUrl(key: string) {
  const folder = folders[key];
  if (!folder) throw new Error(`Unknown 3D model "${key}"`);
  return modelUrl(`${folder}/${key}.glb`);
}

export const isAssetModel = (key: string): key is AssetModel => (ASSET_MODELS as readonly string[]).includes(key);
export const isCharacterModel = (key: string): key is CharacterModel => (CHARACTER_MODELS as readonly string[]).includes(key);
