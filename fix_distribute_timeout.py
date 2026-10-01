#!/usr/bin/env python3
"""
fix_distribute_timeout.py — เพิ่มเวลารอ (timeout) ของขั้นตอน Distribute
(/api/distribute) จาก 45 วินาที เป็น 60 วินาที เพราะทดสอบยิงตรงผ่าน curl
แล้ว backend ทำงานได้ปกติ (Discord/Mastodon/Threads สำเร็จหมด) แต่บางครั้ง
เครือข่าย/AI provider อาจตอบช้ากว่า 45 วิ ทำให้ frontend ตัดสายทิ้งก่อน
ขึ้น "Load failed" ทั้งที่ backend ยังทำงานอยู่จริง

วิธีรัน:
    cd /workspaces/gravity-blog
    python3 fix_distribute_timeout.py
"""

import os
import sys
import glob

MARKER = "/* GX-DISTRIBUTE-TIMEOUT-PATCH */"

OLD = """      const data = await apiCall('/api/distribute', {"""

NEW = """      const data = await apiCall('/api/distribute', { /* GX-DISTRIBUTE-TIMEOUT-PATCH */"""


def find_admin_html():
    candidates = ["admin.html", "./admin.html"]
    for c in candidates:
        if os.path.isfile(c):
            return c
    for path in glob.glob("**/admin.html", recursive=True):
        if "node_modules" not in path:
            return path
    return None


def main():
    path = find_admin_html()
    if not path:
        print("❌ ไม่เจอไฟล์ admin.html")
        sys.exit(1)

    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    if MARKER in content:
        print(f"⚠️  {path} ถูก patch distribute timeout ไปแล้วก่อนหน้านี้ — ข้ามการแก้ไข")
        sys.exit(0)

    if OLD not in content:
        print("❌ ไม่เจอโค้ดต้นฉบับที่คาดไว้ (อาจถูกแก้ไปแล้วโดยระบบอื่น)")
        print("   กรุณาส่งผลลัพธ์คำสั่งนี้กลับมาดู:")
        print("   grep -n \"api/distribute\" admin.html")
        sys.exit(1)

    if content.count(OLD) > 1:
        print("❌ เจอโค้ดต้นฉบับมากกว่า 1 จุด — หยุดไว้ก่อนเพื่อความปลอดภัย")
        print("   กรุณาส่งผลลัพธ์คำสั่งนี้กลับมาดู:")
        print("   grep -n \"api/distribute\" admin.html")
        sys.exit(1)

    # หา label string บรรทัดถัดไป เพื่อแทรก 60000 เข้าไปเป็น argument สุดท้าย
    idx = content.find(OLD)
    # หาจุดปิดของ apiCall(...) โดยหา ");" ที่ใกล้ที่สุดหลังจากนี้
    close_idx = content.find(");", idx)
    if close_idx == -1:
        print("❌ หาจุดปิดวงเล็บของ apiCall(/api/distribute...) ไม่เจอ")
        sys.exit(1)

    backup_path = path + ".distribute-timeout.bak"
    with open(backup_path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"🗂️  Backup ไฟล์เดิมไว้ที่ {backup_path}")

    new_content = (
        content[:idx]
        + NEW
        + content[idx + len(OLD):close_idx]
        + ", 60000"
        + content[close_idx:]
    )

    with open(path, "w", encoding="utf-8") as f:
        f.write(new_content)

    print(f"✅ Patch เสร็จสมบูรณ์ — {path} ถูกแก้ไขแล้ว")
    print("   เปลี่ยน timeout ของ /api/distribute จาก 45 วินาที → 60 วินาที")


if __name__ == "__main__":
    main()
