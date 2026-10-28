# AMS 3D Office — 3D Models

สร้างใน Blender 5.2 ด้วยสคริปต์ (`3d Models/Blender/scripts/`) ตามสเปก `3D_MODELS_SPEC.md`
สไตล์อ้างอิงจาก model sheet ใน `References/Model Sheet/`
คัดลอกทั้งโฟลเดอร์นี้ไปไว้ที่ `/storage/3dmodels` ของโปรเจกต์ Next.js ได้เลย

## สรุป

| หมวด | จำนวน | หมายเหตุ |
|---|---|---|
| characters | 10 | rig เดียวกัน 17 bones, แอนิเมชัน 20 clips (30 fps), ~3.9–4.6k tris |
| architecture | 12 | พื้น ผนัง หน้าต่าง ประตู ฉากกั้นกระจก ป้ายโซน |
| furniture | 18 | โต๊ะ เก้าอี้ Helpdesk workbench ชั้นวาง rack ฯลฯ |
| assets | 16 | ครุภัณฑ์ AMS ทุกชิ้นมี `mat_status_light` + `anchor_badge` |
| props | 11 | ของถือ มี `anchor_hand_r/l` |
| ui | 7 | status ring + markers |
| scenes | 4 | `office_shell`, `zone_helpdesk`, `zone_repair_lab`, `office_demo` |

รวม 78 ไฟล์ ประมาณ 6.4 MB รายละเอียดแต่ละไฟล์ (tris, ขนาด, anchors, materials, clips) อยู่ใน `manifest.json`
ทุกไฟล์ผ่าน glTF Validator (0 errors) และทดสอบโหลด + เล่นแอนิเมชันใน three.js แล้ว

## Conventions (glTF)

- หน่วยเมตร, **Y-up**, ด้านหน้าของโมเดลหันไปทาง **+Z**
- Origin = กึ่งกลางฐานบนพื้น ยกเว้น: `floor_tile*` (ผิวบนอยู่ที่ y=0), ของติดผนัง (`ac_wall`, `zone_sign`, `whiteboard`, `workbench_tools_wall` = จุดยึดผนัง), `ac_ceiling` (ติดเพดาน), `marker_*` (ปลายหมุดด้านล่าง)
- **Anchor** = empty node ชื่อขึ้นต้นด้วย `anchor_` — แกน +Z ของ anchor คือทิศที่ตัวละครควรหัน
  - `anchor_stand`, `anchor_visitor` (Helpdesk), `anchor_chair` (จุดวางเก้าอี้ของโต๊ะ), `anchor_sit` (เบาะ สูง ~0.49 m), `anchor_prop`, `anchor_prop_01..06` (ช่องชั้นวาง), `anchor_badge`, `anchor_text`, `anchor_door`, `anchor_hinge`, `anchor_hand`
- ตัวละครมี `socket_hand_l` / `socket_hand_r` (ผูกกับ bone มือ) ไว้ attach props ผ่าน `anchor_hand_r` ของ prop

## Materials ที่เปลี่ยนสีตอน runtime

| ชื่อ | ใช้กับ |
|---|---|
| `mat_palette` | วัสดุหลักของทุกชิ้น (palette texture 64×32 เดียวกันทั้งชุด → draw call น้อย) |
| `mat_status_light` | ไฟ LED/วงแหวนสถานะ — เปลี่ยนสีตาม AssetStatus (เขียว/เหลือง/แดง/น้ำเงิน/เทา) |
| `mat_screen` | จอ (เปลี่ยนสี/emissive หรือใส่ texture) |
| `mat_accent` | สีเน้น: ป้าย, markers (alert=แดง, wrench=น้ำเงิน, pause=เหลือง, check=เขียว), เครื่องแต่งกายตัวละคร |
| `mat_glass`, `mat_whiteboard` | กระจกโปร่งใส / กระดาน (UV 0..1 สำหรับ texture KPI) |
| `mat_skin`, `mat_hair`, `mat_shirt`, `mat_pants` | ตัวละคร — เปลี่ยนสีเพื่อทำตัวแปรได้โดยไม่ต้องโหลดโมเดลใหม่ |

## ตัวละคร

`char_base`, `char_staff_a/b/c`, `char_helpdesk`, `char_technician`, `char_auditor`, `char_manager`, `char_courier`, `char_vendor_tech`

Bones (ชื่อแบบ Mixamo ไม่มี prefix): `Hips, Spine, Chest, Neck, Head, Left/RightArm, Left/RightForeArm, Left/RightHand, Left/RightUpLeg, Left/RightLeg, Left/RightFoot`

Clips: `idle, walk, walk_carry, idle_carry, sit_down, stand_up, sit_idle, sit_type, talk, point, wave, handover, pickup, putdown, repair_stand, repair_crouch, inspect_clipboard, scan_phone, think_wait, celebrate`
- แอนิเมชันเป็น in-place (ไม่มี root motion) — ให้เลื่อนตำแหน่งตัวละครด้วยโค้ด
- clip ที่นั่ง: วางตัวละครที่ตำแหน่ง XZ ของ `anchor_sit` ของเก้าอี้ (y=0) แล้วหันตามเก้าอี้ clip จะยกสะโพกขึ้นไปที่เบาะเอง
- ใน three.js ให้ clone ด้วย `SkeletonUtils.clone()` เมื่อใช้โมเดลเดียวกันหลายตัว

## ฉาก

- `scenes/office_shell.glb` — ห้อง 14×10 m (พื้น ผนัง ประตู ห้อง Lab กระจก ป้าย) + `anchor_zone_*`, `anchor_door_vendor`, `anchor_entrance`, `anchor_lab_gate`, `anchor_wp_01..14` (waypoints)
- `office_layout.json` — ตำแหน่ง/การหมุน (glTF coords) ของเฟอร์นิเจอร์และครุภัณฑ์ 88 รายการ + zones + waypoints → ใช้เป็นค่าเริ่มต้นของ `SceneLayout.config`
- `scenes/office_demo.glb` — ฉากตกแต่งครบในไฟล์เดียว (instanced) สำหรับ Spike/Demo
- `scenes/zone_helpdesk.glb`, `scenes/zone_repair_lab.glb` — prefab โซนพร้อม anchors

## แก้ไข / สร้างใหม่

ไฟล์ต้นฉบับ: `3d Models/Blender/AMS_Projects.blend` (collections `SRC_*`, `CHAR_models`, `SCN_office`, `SCN_cast` = ฉาก preview)
สคริปต์: `amsgen.py` (helpers/export), `build_arch_furniture.py`, `build_assets_props_ui.py`, `build_characters.py`, `char_anims.py`, `export_characters.py`, `build_scenes.py`, `preview.py`
แก้ค่าในสคริปต์แล้วรันใน Blender จะ export ทับไฟล์เดิมและอัปเดต manifest

## License

โมเดลทั้งหมดสร้างขึ้นใหม่ด้วยสคริปต์ ไม่มี asset จากภายนอก (ดู `LICENSES.md`)
