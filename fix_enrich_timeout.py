#!/usr/bin/env python3
"""
fix_enrich_timeout.py — เพิ่มเวลารอ (timeout) ของขั้นตอน Generate Everything
(/api/enrich) จาก 45 วินาที เป็น 120 วินาที เพราะ AI สร้างเนื้อหา 1 ฟิลด์
บางทีใช้เวลานานกว่า 45 วิ ทำให้ frontend ตัดสายทิ้งก่อน AI ตอบเสร็จ

วิธีรัน:
    cd /workspaces/gravity-blog
    python3 fix_enrich_timeout.py
"""

import os
import sys
import glob

MARKER = "/* GX-ENRICH-TIMEOUT-PATCH */"

OLD = """      const data = await apiCall('/api/enrich', {
        method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ productId })
      }, 'POST /api/enrich (สร้างเนื้อหาขั้นต่อไป)');"""

NEW = """      const data = await apiCall('/api/enrich', { /* GX-ENRICH-TIMEOUT-PATCH */
        method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ productId })
      }, 'POST /api/enrich (สร้างเนื้อหาขั้นต่อไป)', 120000);"""


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
        print(f"⚠️  {path} ถูก patch timeout ไปแล้วก่อนหน้านี้ — ข้ามการแก้ไข")
        sys.exit(0)

    if OLD not in content:
        print("❌ ไม่เจอโค้ดต้นฉบับที่คาดไว้ (อาจถูกแก้ไปแล้วโดยระบบอื่น)")
        print("   กรุณาส่งผลลัพธ์คำสั่งนี้กลับมาดู:")
        print("   grep -n \"api/enrich\" admin.html")
        sys.exit(1)

    backup_path = path + ".enrich-timeout.bak"
    with open(backup_path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"🗂️  Backup ไฟล์เดิมไว้ที่ {backup_path}")

    new_content = content.replace(OLD, NEW, 1)

    with open(path, "w", encoding="utf-8") as f:
        f.write(new_content)

    print(f"✅ Patch เสร็จสมบูรณ์ — {path} ถูกแก้ไขแล้ว")
    print("   เปลี่ยน timeout ของ /api/enrich จาก 45 วินาที → 120 วินาที")


if __name__ == "__main__":
    main()
