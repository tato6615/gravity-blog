#!/usr/bin/env python3
"""
fix_dashboard_v4.py
  1. Redesign หน้า Multi-Agent Foundation ให้มินิมอล:
     - ปุ่ม "รันทั้งหมด" / "รันใหม่" / "รีเฟรช" เอา emoji/unicode icon ออก ใช้ class ใหม่ flat
     - กล่อง CONTROL DECISION เอา emoji สถานะ/ลูกศรออก ใช้สีพื้นหลัง/ขอบสื่อสถานะแทน
     - เอา emoji หัวข้อ (🤖🧠🧪🚀) และ emoji ใน JS string (⏳✅⚠️❌ ตัวอักษรเพี้ยน) ออก
     - แก้บั๊ก style= ซ้ำสองรอบในปุ่มรีเฟรช
  2. เพิ่ม drag-reorder กลับให้ .tab-nav (ผูกกับ selector จริง ไม่เดา container)
     บันทึกลำดับไว้ใน localStorage

ใช้ string/regex replace แบบยึด anchor ข้อความจริง มี backup อัตโนมัติ
"""
import re
import sys
import shutil
from datetime import datetime

TARGET = "admin.html"


def main():
    try:
        with open(TARGET, "r", encoding="utf-8") as f:
            content = f.read()
    except FileNotFoundError:
        print(f"❌ ไม่เจอไฟล์ {TARGET} ในโฟลเดอร์นี้")
        sys.exit(1)

    original = content
    changes = []
    warnings = []

    backup_path = f"{TARGET}.v4backup.{datetime.now().strftime('%Y%m%d%H%M%S')}"
    shutil.copyfile(TARGET, backup_path)
    print(f"📦 Backup ไฟล์เดิมไว้ที่ {backup_path}")

    def do(old, new, label, count=1):
        nonlocal content
        if old in content:
            content = content.replace(old, new, count)
            changes.append(f"✅ {label}")
        else:
            warnings.append(f"⚠️  ไม่เจอ: {label}")

    # ---------- 1) redesign <style> block ของ agents-panel ----------
    old_style_block = """<style>
  .ag-stat-card{ background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:8px 10px; display:flex; flex-direction:column; gap:2px; min-width:0; }
  .ag-stat-num{ font-size:18px; font-weight:800; line-height:1; color:var(--text); }
  .ag-stat-label{ color:var(--text-faint); font-size:10px; }
  .ag-alert{ border-radius:8px; padding:8px 12px; margin-bottom:6px; font-size:12.5px; }
  .ag-alert.error{ background:rgba(231,76,60,0.12); color:#e74c3c; }
  .ag-alert.warn{ background:rgba(245,166,35,0.12); color:var(--amber); }
  .ag-decision.leak{ background:rgba(231,76,60,0.12); border-color:rgba(231,76,60,0.4); color:#e74c3c; }
  .ag-decision.converting{ background:rgba(46,204,113,0.12); border-color:rgba(46,204,113,0.4); color:#2ecc71; }
  .ag-decision.notraffic, .ag-decision.insufficient{ background:var(--panel); }
</style>"""

    new_style_block = """<style>
  .ag-stat-card{ background:var(--panel-2); border:1px solid var(--line); border-radius:10px; padding:10px 12px; display:flex; flex-direction:column; gap:3px; min-width:0; }
  .ag-stat-num{ font-size:20px; font-weight:600; line-height:1.1; color:var(--text); }
  .ag-stat-label{ color:var(--text-faint); font-size:10.5px; }
  .ag-alert{ border-radius:10px; padding:9px 12px; margin-bottom:6px; font-size:12.5px; border:1px solid transparent; }
  .ag-alert.error{ background:rgba(226,96,79,0.08); border-color:rgba(226,96,79,0.3); color:var(--red); }
  .ag-alert.warn{ background:rgba(232,163,61,0.08); border-color:rgba(232,163,61,0.3); color:var(--amber); }
  .ag-decision{ border-radius:10px; padding:14px 16px; margin-bottom:20px; border:1px solid var(--line); background:var(--panel); }
  .ag-decision.leak{ background:rgba(226,96,79,0.08); border-color:rgba(226,96,79,0.3); color:var(--text); }
  .ag-decision.converting{ background:rgba(79,209,197,0.08); border-color:rgba(79,209,197,0.3); color:var(--text); }
  .ag-decision.notraffic, .ag-decision.insufficient{ background:var(--panel); border-color:var(--line); }
  .btn-run{ background:transparent; border:1px solid var(--line); color:var(--text-faint); font-weight:500; font-size:11px; padding:5px 12px; border-radius:8px; cursor:pointer; transition:border-color .15s ease, color .15s ease; }
  .btn-run:hover{ border-color:var(--amber); color:var(--amber); }
  .btn-run-all{ background:var(--amber); color:#1a1206; border:none; font-weight:600; font-size:12.5px; padding:8px 14px; border-radius:8px; cursor:pointer; }
  .btn-run-all:hover{ filter:brightness(1.06); }
  .btn-run-all:disabled{ opacity:0.5; cursor:not-allowed; }
</style>"""

    do(old_style_block, new_style_block, "redesign CSS การ์ด/alert/decision/ปุ่มใหม่ทั้งหมด")

    # ---------- 2) header: title + ปุ่มรันทั้งหมด/รีเฟรช ----------
    do(
        '<h2 style="margin:0; color:var(--text);">🤖 Multi-Agent Foundation</h2>',
        '<h2 style="margin:0; color:var(--text); font-weight:600;">Multi-Agent Foundation</h2>',
        "เอา emoji 🤖 ออกจากหัวข้อ",
    )

    old_header_btns = """    <div style="display:flex; gap:8px;">
      <button class="btn-primary" id="ag-runall-btn" onclick="runAllAgents()" style="width:auto; padding:8px 14px; font-size:12.5px; font-weight:700;">▶ รันทั้งหมด</button>
      <button class="btn-ghost" id="ag-refresh-btn" onclick="loadAgentsPanel()" style="width:auto; padding:8px 14px; font-size:12.5px;" style="width:auto;padding:9px 11px;font-size:14px;">↻</button>
    </div>"""
    new_header_btns = """    <div style="display:flex; gap:8px;">
      <button class="btn-run-all" id="ag-runall-btn" onclick="runAllAgents()">รันทั้งหมด</button>
      <button class="btn-run" id="ag-refresh-btn" onclick="loadAgentsPanel()" style="padding:6px 10px;">รีเฟรช</button>
    </div>"""
    do(old_header_btns, new_header_btns, "redesign ปุ่มรันทั้งหมด/รีเฟรช (แก้บั๊ก style ซ้ำด้วย)")

    # ---------- 3) เอา emoji ออกจากหัวข้อ section ----------
    do('<div class="sh-phase-title">🧠 CONTROL DECISION</div>',
       '<div class="sh-phase-title">CONTROL DECISION</div>',
       "เอา emoji 🧠 ออกจาก CONTROL DECISION")
    do('<span>🧪 EXPERIMENT AGENT — การทดลองที่กำลังรัน</span>',
       '<span>EXPERIMENT AGENT — การทดลองที่กำลังรัน</span>',
       "เอา emoji 🧪 ออกจาก EXPERIMENT AGENT")
    do('<span>🚀 GROWTH AGENT — ขยายผลสูตรที่พิสูจน์แล้ว</span>',
       '<span>GROWTH AGENT — ขยายผลสูตรที่พิสูจน์แล้ว</span>',
       "เอา emoji 🚀 ออกจาก GROWTH AGENT")

    # ---------- 4) ปุ่ม "▶ รันใหม่" x5 (revenue/traffic/conversion/experiment/growth) ----------
    run_again_pattern = re.compile(
        r'<button class="btn-ghost" onclick="runAgent\(\'([a-z]+)\', this\)" '
        r'style="width:auto; padding:4px 10px; font-size:11px;">▶ รันใหม่</button>'
    )
    n_matches = len(run_again_pattern.findall(content))
    if n_matches:
        content = run_again_pattern.sub(
            lambda mm: f'<button class="btn-run" onclick="runAgent(\'{mm.group(1)}\', this)">รันใหม่</button>',
            content,
        )
        changes.append(f"✅ redesign ปุ่ม 'รันใหม่' ทั้ง {n_matches} จุด")
    else:
        warnings.append("⚠️  ไม่เจอปุ่ม '▶ รันใหม่' รูปแบบเดิม")

    # ---------- 5) กล่อง CONTROL DECISION: เอา emoji สถานะ/ลูกศรออก ----------
    do(
        '        <div style="font-weight:700; margin-bottom:4px;">${icon} ${d.status}</div>',
        '        <div style="font-weight:600; margin-bottom:4px; letter-spacing:0.3px;">${d.status}</div>',
        "เอา emoji สถานะ (🔴🟢⚪) ออกจากกล่อง decision (ใช้สีพื้นหลัง/ขอบสื่อแทน)",
    )
    do(
        "        ${d.recommendedNextAction ? `<div style=\"opacity:0.85;\">➡ ${d.recommendedNextAction}</div>` : ''}",
        "        ${d.recommendedNextAction ? `<div style=\"opacity:0.85;\">แนะนำ: ${d.recommendedNextAction}</div>` : ''}",
        "เอา emoji ลูกศร ➡ ออก เปลี่ยนเป็นคำว่า 'แนะนำ:'",
    )

    # ---------- 6) JS strings: เอา emoji/ตัวอักษรเพี้ยนออก ----------
    do("btn.textContent = '⏳ กำลังโหลด...';",
       "btn.textContent = 'กำลังโหลด...';",
       "เอา emoji ⏳ ออกจากข้อความ 'กำลังโหลด'")
    do("btn.textContent = '↻ รีเฟรช';",
       "btn.textContent = 'รีเฟรช';",
       "เอา emoji ↻ ออกจากข้อความ 'รีเฟรช'")
    do("btn.textContent = '⏳ กำลังรันทั้งหมด...';",
       "btn.textContent = 'กำลังรันทั้งหมด...';",
       "เอา emoji ⏳ ออกจากข้อความ 'กำลังรันทั้งหมด'")
    do("btnEl.textContent = '⏳ กำลังรัน...';",
       "btnEl.textContent = 'กำลังรัน...';",
       "เอา emoji ⏳ ออกจากข้อความ 'กำลังรัน'")
    do(
        '<div class="ag-alert ${a.level}">⚠️ ${a.message}</div>',
        '<div class="ag-alert ${a.level}">${a.message}</div>',
        "เอา emoji ⚠️ ออกจาก alert message",
    )
    do(
        ': `<div style="color:var(--text-faint); font-size:12.5px;">✅ ไม่มีปัญหาที่ต้องดูตอนนี้</div>`;',
        ': `<div style="color:var(--text-faint); font-size:12.5px;">ไม่มีปัญหาที่ต้องดูตอนนี้</div>`;',
        "เอา emoji ✅ ออก",
    )
    do(
        'listEl.innerHTML = `<div style="color:#e74c3c; padding:20px 0;">\ufffd❌ โหลด Multi-Agent status ไม่สำเร็จ: ${e.message}</div>`;',
        'listEl.innerHTML = `<div style="color:var(--red); padding:20px 0;">โหลด Multi-Agent status ไม่สำเร็จ: ${e.message}</div>`;',
        "แก้ตัวอักษรเพี้ยน + เอา emoji ❌ ออก + ใช้สีธีม var(--red)",
    )

    # ---------- 7) เพิ่ม drag-reorder กลับให้ .tab-nav (ผูกตรง ไม่เดา container) ----------
    tab_nav_marker = re.compile(r'(<div class="tab-nav">.*?</div>\n)', re.DOTALL)
    m = tab_nav_marker.search(content)
    if m and "GX-TABNAV-DRAG-V4" not in content:
        drag_script = """
<!-- GX-TABNAV-DRAG-V4: ลากสลับตำแหน่งแท็บ ผูกตรงกับ .tab-nav/.tab-btn (ไม่เดา container) -->
<script>
(function () {
  var STORAGE_KEY = "gx-tabnav-order-v4";
  var nav = document.querySelector(".tab-nav");
  if (!nav) return;

  function applySavedOrder() {
    try {
      var saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!Array.isArray(saved) || !saved.length) return;
      saved.forEach(function (tab) {
        var el = nav.querySelector('.tab-btn[data-tab="' + tab + '"]');
        if (el) nav.appendChild(el);
      });
    } catch (e) {
      console.warn("[gx-tabnav-drag-v4] อ่าน localStorage ไม่ได้:", e);
    }
  }

  function saveOrder() {
    try {
      var order = Array.prototype.slice
        .call(nav.querySelectorAll(".tab-btn"))
        .map(function (el) { return el.getAttribute("data-tab"); });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
    } catch (e) {
      console.warn("[gx-tabnav-drag-v4] บันทึก localStorage ไม่ได้:", e);
    }
  }

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
    var hovered = target ? target.closest(".tab-btn") : null;
    if (hovered && hovered !== dragEl && hovered.parentElement === nav) {
      var rect = hovered.getBoundingClientRect();
      var before = e.clientX < rect.left + rect.width / 2;
      nav.insertBefore(dragEl, before ? hovered : hovered.nextSibling);
    }
  }

  function onPointerUp() {
    if (dragEl) dragEl.classList.remove("gx-dragging");
    dragEl = null;
    document.removeEventListener("pointermove", onPointerMove);
    saveOrder();
  }

  function bind() {
    Array.prototype.slice.call(nav.querySelectorAll(".tab-btn")).forEach(function (el) {
      el.style.touchAction = "none";
      el.addEventListener("pointerdown", onPointerDown);
    });
  }

  applySavedOrder();
  bind();
})();
</script>
<style>
  .tab-btn{ cursor:grab; }
  .tab-btn:active{ cursor:grabbing; }
  .tab-btn.gx-dragging{ opacity:0.35; }
</style>
"""
        insert_pos = m.end(1)
        content = content[:insert_pos] + drag_script + content[insert_pos:]
        changes.append("✅ เพิ่ม drag-reorder กลับให้ tab-nav (ผูกตรงกับ .tab-nav/.tab-btn จริง)")
    elif "GX-TABNAV-DRAG-V4" in content:
        warnings.append("ℹ️  มี drag-reorder script (v4) อยู่แล้ว ไม่เพิ่มซ้ำ")
    else:
        warnings.append('⚠️  ไม่เจอ <div class="tab-nav">...</div> — ข้าม drag-reorder')

    # ---------- สรุปผล ----------
    for w in warnings:
        print(w)

    if content == original:
        print("ไม่มีอะไรเปลี่ยนแปลง — ไม่เขียนทับไฟล์")
        return

    with open(TARGET, "w", encoding="utf-8") as f:
        f.write(content)

    print("\n".join(changes))
    print(f"\n🎉 เสร็จแล้ว — {TARGET} ถูกอัปเดตเป็นดีไซน์มินิมอล + ลากสลับแท็บได้อีกครั้ง")
    print("ขั้นต่อไป: git add admin.html && git commit -m 'feat: minimal dashboard redesign + tab drag reorder (v4)' && git push")


if __name__ == "__main__":
    main()
