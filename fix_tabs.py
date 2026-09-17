#!/usr/bin/env python3
"""
fix_tabs.py — patch admin.html เพื่อทำให้แถบแท็บ
🎯 Attention / 📊 Analytics / 🚀 Product Engine / 🩺 System Health /
🎪 Community Hub / 🔎 Market Discovery / 🤖 Multi-Agent
responsive (scroll แนวนอนได้ ไม่ล้นจอ ไม่ถูกตัดคำ)

วิธีรัน:
    cd /workspaces/gravity-blog
    python3 fix_tabs.py

สคริปต์นี้:
1. หาไฟล์ admin.html อัตโนมัติ (ถ้าไม่เจอในตำแหน่งปัจจุบันจะ search ในโปรเจกต์)
2. เช็คว่าเคย patch ไปแล้วหรือยัง (กัน patch ซ้ำ)
3. Backup ไฟล์เดิมเป็น admin.html.bak ก่อนแก้ทุกครั้ง
4. แทรก <style> + <script> เข้าไปก่อน </body> โดยไม่แตะโค้ดเดิม
   - style: ทำให้ container ของแท็บ scroll แนวนอนได้ ซ่อน scrollbar
     ให้สวย, ลด font-size บนจอเล็ก
   - script: หา element ที่มีข้อความแท็บครบ แล้วเติม class 'gx-tabbar'
     ให้อัตโนมัติ (ไม่ต้องรู้ class เดิมของคุณ)
"""

import os
import re
import sys
import glob

MARKER = "<!-- GX-TABBAR-PATCH-V1 -->"

PATCH_BLOCK = """
<!-- GX-TABBAR-PATCH-V1 -->
<style>
  /* ทำให้แถบแท็บ (Attention/Analytics/Product Engine/...) responsive */
  .gx-tabbar {
    display: flex !important;
    flex-wrap: nowrap !important;
    overflow-x: auto !important;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
    gap: 4px;
    white-space: nowrap;
  }
  .gx-tabbar::-webkit-scrollbar {
    height: 4px;
  }
  .gx-tabbar::-webkit-scrollbar-thumb {
    background: rgba(255,255,255,0.15);
    border-radius: 4px;
  }
  .gx-tabbar > * {
    flex: 0 0 auto !important;
  }
  @media (max-width: 768px) {
    .gx-tabbar {
      font-size: 13px;
    }
    .gx-tabbar > * {
      padding-left: 10px !important;
      padding-right: 10px !important;
    }
  }
</style>
<script>
(function () {
  // รายชื่อแท็บที่ต้องหาให้เจอในหน้า
  var labels = ["Attention", "Analytics", "Product Engine", "System Health",
                "Community Hub", "Market Discovery", "Multi-Agent"];

  function findTabbarContainer() {
    // หา element ที่ตัวมันเองไม่มีลูกเป็น text ตรงๆ แต่มีลูกหลานรวมกันครบทุก label
    var all = document.body.querySelectorAll("*");
    var best = null, bestScore = 0;
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (el.children.length < 2 || el.children.length > 12) continue;
      var text = el.textContent || "";
      var score = 0;
      for (var j = 0; j < labels.length; j++) {
        if (text.indexOf(labels[j]) !== -1) score++;
      }
      if (score > bestScore) {
        bestScore = score;
        best = el;
      }
    }
    return bestScore >= 5 ? best : null; // ต้องเจออย่างน้อย 5/7 ถึงจะมั่นใจ
  }

  function applyPatch() {
    var el = findTabbarContainer();
    if (el && !el.classList.contains("gx-tabbar")) {
      el.classList.add("gx-tabbar");
      console.log("[gx-tabbar-patch] applied to:", el);
    } else if (!el) {
      console.warn("[gx-tabbar-patch] ไม่เจอ container ของแถบแท็บ ลองรันใหม่หลังโหลดหน้าเสร็จ");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyPatch);
  } else {
    applyPatch();
  }
})();
</script>
"""


def find_admin_html():
    candidates = ["admin.html", "./admin.html"]
    for c in candidates:
        if os.path.isfile(c):
            return c
    # fallback: search recursively (skip node_modules)
    for path in glob.glob("**/admin.html", recursive=True):
        if "node_modules" not in path:
            return path
    return None


def main():
    path = find_admin_html()
    if not path:
        print("❌ ไม่เจอไฟล์ admin.html ในโปรเจกต์ กรุณาเช็ค path แล้วรันใหม่จากโฟลเดอร์ที่ถูกต้อง")
        sys.exit(1)

    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    if MARKER in content:
        print(f"⚠️  {path} ถูก patch ไปแล้วก่อนหน้านี้ (เจอ marker) — ข้ามการแก้ไข")
        sys.exit(0)

    if "</body>" not in content:
        print("❌ ไม่เจอ tag </body> ใน admin.html — โครงสร้างไฟล์ผิดปกติ ไม่แก้ไขเพื่อความปลอดภัย")
        sys.exit(1)

    # backup ก่อนแก้เสมอ
    backup_path = path + ".bak"
    with open(backup_path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"🗂️  Backup ไฟล์เดิมไว้ที่ {backup_path}")

    new_content = content.replace("</body>", PATCH_BLOCK + "\n</body>", 1)

    with open(path, "w", encoding="utf-8") as f:
        f.write(new_content)

    print(f"✅ Patch เสร็จสมบูรณ์ — {path} ถูกแก้ไขแล้ว")
    print("   1. เพิ่ม CSS class .gx-tabbar สำหรับทำ scroll แนวนอน")
    print("   2. เพิ่ม JS ที่หา container ของแท็บอัตโนมัติแล้วเติม class ให้")
    print("   3. ถ้าต้องการย้อนกลับ: cp admin.html.bak admin.html")


if __name__ == "__main__":
    main()