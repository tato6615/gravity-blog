#!/usr/bin/env python3
"""
fix_tabs_v2.py — อัปเกรดแถบแท็บให้เป็น:
1. ไอคอนอย่างเดียว (ชื่อเล็กๆ ใต้ไอคอน ซ่อนบนจอเล็กมาก)
2. พอดีในหนึ่งแถวเสมอ ไม่ต้อง scroll
3. ลากสลับตำแหน่งได้ (จำตำแหน่งไว้ใน localStorage ของเบราว์เซอร์)

ต้องรัน fix_tabs.py (v1) ไปแล้วก่อน เพราะ v2 นี้อาศัย class
'gx-tabbar' ที่ v1 ติดไว้ให้กับ container ของแท็บ

วิธีรัน:
    cd /workspaces/gravity-blog
    python3 fix_tabs_v2.py
"""

import os
import sys
import glob

MARKER = "<!-- GX-TABBAR-PATCH-V2 -->"

PATCH_BLOCK = """
<!-- GX-TABBAR-PATCH-V2 -->
<style>
  /* v2: ไอคอนอย่างเดียว, พอดีในหนึ่งแถว, ลากสลับได้ */
  .gx-tabbar {
    display: flex !important;
    flex-wrap: nowrap !important;
    overflow: visible !important;
    overflow-x: visible !important;
    width: 100% !important;
    justify-content: space-between !important;
    gap: 2px !important;
  }
  .gx-tabbar > * {
    flex: 1 1 0 !important;
    min-width: 0 !important;
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
    justify-content: center !important;
    padding: 6px 2px !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    cursor: grab;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
  }
  .gx-tabbar > *:active {
    cursor: grabbing;
  }
  .gx-tabbar > *.gx-dragging {
    opacity: 0.35;
  }
  .gx-icon {
    font-size: 20px;
    line-height: 1;
    pointer-events: none;
  }
  .gx-label {
    font-size: 9px;
    line-height: 1.2;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-top: 2px;
    opacity: 0.8;
    pointer-events: none;
  }
  @media (max-width: 480px) {
    .gx-label { display: none; }
    .gx-icon { font-size: 22px; }
  }
</style>
<script>
(function () {
  var STORAGE_KEY = "gx-tab-order-v1";

  function extractIcon(text) {
    var m = text.match(/[\\u{1F000}-\\u{1FFFF}\\u{2600}-\\u{27BF}]/u);
    return m ? m[0] : text.trim().slice(0, 2);
  }

  function init(container) {
    if (container.dataset.gxV2Ready === "1") return;
    container.dataset.gxV2Ready = "1";

    var items = Array.prototype.slice.call(container.children);

    items.forEach(function (el) {
      var fullText = (el.getAttribute("data-gx-label") || el.textContent).trim();
      var icon = extractIcon(fullText);
      var label = fullText.replace(icon, "").trim();

      el.setAttribute("data-gx-label", fullText);
      el.setAttribute("title", fullText);
      el.classList.add("gx-tab-item");
      el.innerHTML =
        '<span class="gx-icon">' + icon + "</span>" +
        '<span class="gx-label">' + label + "</span>";
    });

    // เรียงลำดับตามที่เคยบันทึกไว้ (ถ้ามี)
    try {
      var saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (Array.isArray(saved) && saved.length) {
        saved.forEach(function (label) {
          var match = items.find(function (el) {
            return el.getAttribute("data-gx-label") === label;
          });
          if (match) container.appendChild(match);
        });
      }
    } catch (e) {
      console.warn("[gx-tabbar-v2] อ่าน localStorage ไม่ได้:", e);
    }

    function saveOrder() {
      try {
        var order = Array.prototype.slice
          .call(container.children)
          .map(function (el) { return el.getAttribute("data-gx-label"); });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
      } catch (e) {
        console.warn("[gx-tabbar-v2] บันทึก localStorage ไม่ได้:", e);
      }
    }

    // ---- Drag to reorder (mouse + touch ผ่าน Pointer Events) ----
    var dragEl = null;

    function onPointerDown(e) {
      dragEl = e.currentTarget;
      dragEl.classList.add("gx-dragging");
      document.addEventListener("pointermove", onPointerMove);
      document.addEventListener("pointerup", onPointerUp, { once: true });
    }

    function onPointerMove(e) {
      if (!dragEl) return;
      var target = document.elementFromPoint(e.clientX, e.clientY);
      var hovered = target ? target.closest(".gx-tab-item") : null;
      if (hovered && hovered !== dragEl && hovered.parentElement === container) {
        var rect = hovered.getBoundingClientRect();
        var before = e.clientX < rect.left + rect.width / 2;
        container.insertBefore(dragEl, before ? hovered : hovered.nextSibling);
      }
    }

    function onPointerUp() {
      if (dragEl) dragEl.classList.remove("gx-dragging");
      dragEl = null;
      document.removeEventListener("pointermove", onPointerMove);
      saveOrder();
    }

    Array.prototype.slice.call(container.children).forEach(function (el) {
      el.addEventListener("pointerdown", onPointerDown);
    });
  }

  function waitForContainer(retries) {
    var c = document.querySelector(".gx-tabbar");
    if (c) {
      init(c);
    } else if (retries > 0) {
      setTimeout(function () { waitForContainer(retries - 1); }, 100);
    } else {
      console.warn("[gx-tabbar-v2] ไม่เจอ .gx-tabbar — ต้องรัน fix_tabs.py (v1) ก่อน");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      waitForContainer(30);
    });
  } else {
    waitForContainer(30);
  }
})();
</script>
"""


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
        print("❌ ไม่เจอไฟล์ admin.html กรุณาเช็ค path แล้วรันใหม่จากโฟลเดอร์ที่ถูกต้อง")
        sys.exit(1)

    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    if MARKER in content:
        print(f"⚠️  {path} ถูก patch v2 ไปแล้วก่อนหน้านี้ — ข้ามการแก้ไข")
        sys.exit(0)

    if "gx-tabbar" not in content:
        print("⚠️  ยังไม่เจอ class 'gx-tabbar' — กรุณารัน fix_tabs.py (v1) ให้สำเร็จก่อน แล้วค่อยรันตัวนี้")
        sys.exit(1)

    if "</body>" not in content:
        print("❌ ไม่เจอ tag </body> — โครงสร้างไฟล์ผิดปกติ ไม่แก้ไขเพื่อความปลอดภัย")
        sys.exit(1)

    backup_path = path + ".v2.bak"
    with open(backup_path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"🗂️  Backup ไฟล์เดิมไว้ที่ {backup_path}")

    new_content = content.replace("</body>", PATCH_BLOCK + "\n</body>", 1)

    with open(path, "w", encoding="utf-8") as f:
        f.write(new_content)

    print(f"✅ Patch v2 เสร็จสมบูรณ์ — {path} ถูกแก้ไขแล้ว")
    print("   1. แท็บทั้งหมดกลายเป็นไอคอนอย่างเดียว (ชื่อเล็กๆ อยู่ใต้ไอคอน)")
    print("   2. พอดีในหนึ่งแถวเสมอ ไม่ต้อง scroll")
    print("   3. กดค้างแล้วลากเพื่อสลับตำแหน่งได้ ตำแหน่งจะถูกจำไว้ในเบราว์เซอร์")


if __name__ == "__main__":
    main()
