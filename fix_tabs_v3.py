#!/usr/bin/env python3
"""
fix_tabs_v3.py — เปลี่ยน tab-nav ให้เป็นไอคอนมินิมอลสีส้ม (amber), ไอคอนล้วน ไม่มี label
ทำ 3 อย่าง:
  1. แทนที่ CSS .tab-nav/.tab-btn (รวม :hover/.active) เป็นดีไซน์ pill มินิมอล
  2. แทนที่ปุ่มทั้ง 7 จาก emoji เป็น inline SVG line-icon (คง data-tab/onclick เดิมไว้)
  3. ลบโค้ด GX-TABBAR-PATCH-V1 และ V2 ทิ้งทั้งหมด (heuristic เดา container แบบเปราะบาง)

ใช้ regex ยึด anchor ข้อความจริง ไม่ใช้เลขบรรทัด และไม่เดาเนื้อหาที่ไม่เคยเห็น
"""
import re
import sys
import shutil
from datetime import datetime

TARGET = "admin.html"

NEW_CSS = """.tab-nav{ display:flex; gap:4px; max-width:100%; margin:0; padding:6px 8px; background:var(--panel); border-bottom:1px solid var(--line); overflow-x:auto; scrollbar-width:none; position:sticky; top:0; z-index:10; }
.tab-nav::-webkit-scrollbar{ display:none; }
.tab-btn{ flex:1 1 0; min-width:0; display:flex; align-items:center; justify-content:center; background:transparent; border:none; border-radius:999px; padding:9px 0; color:var(--text-faint); cursor:pointer; transition:background .15s ease, color .15s ease; }
.tab-btn svg{ width:20px; height:20px; stroke:currentColor; fill:none; stroke-width:1.6; stroke-linecap:round; stroke-linejoin:round; display:block; }
.tab-btn:hover{ color:var(--text); background:rgba(232,163,61,0.08); }
.tab-btn.active{ color:var(--amber); background:rgba(232,163,61,0.14); }"""

ICONS = {
    "attention": '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="0.6" fill="currentColor" stroke="none"/></svg>',
    "analytics": '<svg viewBox="0 0 24 24"><path d="M4 20V10"/><path d="M12 20V4"/><path d="M20 20v-7"/></svg>',
    "engine": '<svg viewBox="0 0 24 24"><path d="M12 2c3 3 4.5 6.5 4.5 9.5A4.5 4.5 0 0 1 12 16a4.5 4.5 0 0 1-4.5-4.5C7.5 8.5 9 5 12 2Z"/><path d="M9.5 15.5 7 21l3-1.2"/><path d="M14.5 15.5 17 21l-3-1.2"/></svg>',
    "system-health": '<svg viewBox="0 0 24 24"><path d="M3 12h4l2 7 4-14 2 7h6"/></svg>',
    "community": '<svg viewBox="0 0 24 24"><circle cx="8.5" cy="8" r="3"/><circle cx="16" cy="9" r="2.4"/><path d="M2.5 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M14.5 14.3c2.4.3 4 2.3 4 5.7"/></svg>',
    "market": '<svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.8-4.8"/></svg>',
    "agents": '<svg viewBox="0 0 24 24"><rect x="5" y="8" width="14" height="11" rx="2.5"/><path d="M12 8V4"/><circle cx="12" cy="3" r="1"/><circle cx="9" cy="13" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="13" r="1.3" fill="currentColor" stroke="none"/><path d="M9 17h6"/></svg>',
}

LABELS = {
    "attention": "Attention",
    "analytics": "Analytics",
    "engine": "Product Engine",
    "system-health": "System Health",
    "community": "Community Hub",
    "market": "Market Discovery",
    "agents": "Multi-Agent",
}


def build_button(data_tab, active):
    cls = "tab-btn active" if active else "tab-btn"
    label = LABELS[data_tab]
    icon = ICONS[data_tab]
    return (
        f'  <button class="{cls}" data-tab="{data_tab}" '
        f'onclick="switchTab(\'{data_tab}\')" title="{label}" aria-label="{label}">{icon}</button>'
    )


def main():
    try:
        with open(TARGET, "r", encoding="utf-8") as f:
            content = f.read()
    except FileNotFoundError:
        print(f"❌ ไม่เจอไฟล์ {TARGET} ในโฟลเดอร์นี้")
        sys.exit(1)

    original_content = content
    changes = []

    # --- backup ---
    backup_path = f"{TARGET}.v3backup.{datetime.now().strftime('%Y%m%d%H%M%S')}"
    shutil.copyfile(TARGET, backup_path)
    print(f"📦 Backup ไฟล์เดิมไว้ที่ {backup_path}")

    # 1) แทนที่ CSS .tab-nav ... .tab-btn.active{...}
    css_pattern = re.compile(
        r"\.tab-nav\{.*?\.tab-btn\.active\{[^}]*\}",
        re.DOTALL,
    )
    if css_pattern.search(content):
        content = css_pattern.sub(NEW_CSS, content, count=1)
        changes.append("✅ แทนที่ CSS .tab-nav/.tab-btn เป็นไอคอนมินิมอลสีส้มแล้ว")
    else:
        print("⚠️  ไม่เจอ CSS .tab-nav ... .tab-btn.active{} เดิม — ตรวจสอบไฟล์ด้วยตา")

    # 2) แทนที่ markup <div class="tab-nav">...</div>
    markup_pattern = re.compile(r'<div class="tab-nav">.*?</div>', re.DOTALL)
    m = markup_pattern.search(content)
    if m:
        old_block = m.group(0)
        buttons = []
        for data_tab in LABELS.keys():
            btn_re = re.compile(
                r'<button class="tab-btn( active)?" data-tab="' + re.escape(data_tab) + r'"[^>]*>.*?</button>',
                re.DOTALL,
            )
            bm = btn_re.search(old_block)
            active = bool(bm and bm.group(1))
            buttons.append(build_button(data_tab, active))
        new_block = '<div class="tab-nav">\n' + "\n".join(buttons) + "\n</div>"
        content = content[: m.start()] + new_block + content[m.end():]
        changes.append("✅ แทนที่ปุ่มทั้ง 7 จาก emoji เป็นไอคอน SVG เส้นมินิมอลแล้ว (ไม่มี label)")
    else:
        print('⚠️  ไม่เจอ <div class="tab-nav">...</div> เดิม — ตรวจสอบไฟล์ด้วยตา')

    # 3) ลบ GX-TABBAR-PATCH-V1 ถึงจุดจบก่อน </body>
    patch_pattern = re.compile(
        r"\n*<!--\s*GX-TABBAR-PATCH-V1\s*-->.*</script>\s*\n(?=</body>)",
        re.DOTALL,
    )
    if patch_pattern.search(content):
        content = patch_pattern.sub("", content, count=1)
        changes.append("✅ ลบ GX-TABBAR-PATCH-V1/V2 (heuristic + drag) ทิ้งแล้ว")
    else:
        print("ℹ️  ไม่เจอ GX-TABBAR-PATCH-V1 — อาจถูกลบไปแล้วก่อนหน้านี้")

    # เก็บกวาดบรรทัดว่างซ้อนเกิน
    content = re.sub(r"\n{3,}", "\n\n", content)

    if content == original_content:
        print("ไม่มีอะไรเปลี่ยนแปลง — ไม่เขียนทับไฟล์")
        return

    with open(TARGET, "w", encoding="utf-8") as f:
        f.write(content)

    print("\n".join(changes))
    print(f"\n🎉 เสร็จแล้ว — {TARGET} ถูกอัปเดตเป็น tab bar ไอคอนมินิมอลสีส้ม")
    print("ขั้นต่อไป: git add admin.html && git commit -m 'feat: minimal amber icon-only tab bar (v3)' && git push")


if __name__ == "__main__":
    main()
