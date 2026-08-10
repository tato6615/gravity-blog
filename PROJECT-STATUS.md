
### 2026-08-05 (15:40) – ✅ Phase 4 (Content) ปิดจ็อบสมบูรณ์ 100% – ยืนยันทำงานจริงแล้ว

**สรุปผล:** Phase 4 (affiliate_link ครบทุกบทความ) ทำงานจริงครบถ้วน ยืนยันด้วยการ query ตรงไปยัง Grist API (ไม่ใช่ grep ไฟล์ในเครื่อง เพราะเนื้อหาบทความไม่ได้ build เป็น static file แต่ดึง live จาก Grist ทุกครั้งที่มีคนเข้าเว็บ ผ่าน functions/_lib/grist.js)

**วิธี verify:**
- รันสคริปต์ Node.js เชื่อมต่อ Grist API ตรง (ใช้ GRIST_DOC_ID / GRIST_API_KEY จาก .dev.vars)
- ดึงตาราง PRODUCTS ทั้งหมด กรองเฉพาะบทความที่ pipeline_status เป็น 'enriched' หรือ 'published' (=live ตามที่ grist.js นิยามไว้)
- เช็คว่าทุกแถวที่ live มีค่าคอลัมน์ affiliate_link ไม่ว่างเปล่า
- ผลลัพธ์: ✅ ผ่าน – ทุกบทความ live มี affiliate_link ครบ

**บทเรียนสำคัญที่เจอระหว่างทาง:**
1. ห้าม grep หา "affiliate_link" ในไฟล์ static (en/product/*.html) เพราะไฟล์เหล่านั้นเป็นแค่ template เปล่า ไม่ใช่บทความจริง
2. ข้อมูลบทความจริงไม่ได้อยู่ใน D1 (D1 gravity_affiliate มีแค่ตาราง clicks/conversions/email_subscribers สำหรับ tracking เท่านั้น) แต่อยู่ใน Grist ตาราง PRODUCTS/CONTENT/AI_ANALYSIS ต่างหาก ดึงผ่าน functions/_lib/grist.js
3. ชื่อคอลัมน์จริงใน Grist คือ affiliate_link — โค้ดแปลงชื่อเป็น buyUrl ตอน normalize ข้อมูลฝั่ง JS เท่านั้น (ดู normalizeProduct() ใน grist.js)
4. GitHub Actions "Sync GA4 Views to Grist" ยืนยันแล้วว่ารันอัตโนมัติตาม schedule จริง (run #13 สถานะเขียว)

**⚠️ ปัญหาใหม่ที่เจอระหว่างการเช็ค (ยังไม่ได้แก้ – แยกเป็นงานใหม่):**
- sitemap.xml ตอบ 404 ขณะที่ homepage (/) ตอบ 200 ปกติ ควรเปิดเป็น task แยกไปตรวจสอบและแก้ต่อไป

**สถานะ Phase 4 ตอนนี้:** ✅ ปิดจ็อบสมบูรณ์ 100% ยืนยันด้วยการทดสอบจริงผ่าน Grist API โดยตรง ไม่ใช่แค่ไฟล์มีอยู่

### อัพเดตตารางสถานะรวม (แทนที่บรรทัดเดิมของ Phase 4)
- Phase 4 (Content): ✅ ครบ + ✅ ยืนยันทำงานจริง 100% (affiliate_link ครบทุกบทความ live, verify ผ่าน Grist API ตรง — ดูรายละเอียดด้านบน)

### 2026-08-05 (15:49) – ✅ แก้ปัญหา sitemap.xml 404 สำเร็จ

**ปัญหา:** sitemap.xml ตอบ 404 ทั้งที่มีไฟล์ functions/sitemap.xml.js อยู่จริง
**สาเหตุ:** ไฟล์ sitemap.xml.js มีอยู่แต่เนื้อหาว่างเปล่า (0 บรรทัด) — ไม่มี export function onRequestGet เลย Cloudflare Pages Functions เลยไม่รู้จัก route นี้ จึงตอบ 404 เหมือนไม่มีไฟล์
**วิธีแก้:** เขียนโค้ด sitemap.xml.js ใหม่ ดึงบทความ live ทั้งหมดจาก Grist ผ่าน getLiveArticles() (ทั้ง th/en) generate เป็น XML sitemap มาตรฐาน
**ผลทดสอบ:** curl https://gravity-blog.pages.dev/sitemap.xml → ตอบ 200 ยืนยันแล้ว พร้อม XML ครบถ้วน มี URL บทความหลายสิบอันครอบคลุมทุกหมวดหมู่ ปิดท้ายด้วย </urlset> ถูกต้อง

**⚠️ แก้ไขข้อมูลเก่าที่คลาดเคลื่อน:** บรรทัด "Phase 4 – Content | ✅ ครบ (2 articles)" ที่บันทึกไว้ก่อนหน้าล้าสมัยแล้ว จำนวนบทความ live จริงตอนนี้มีมากกว่า 2 บทความมาก (เห็นจาก sitemap.xml ที่เพิ่ง generate) การ verify Phase 4 (affiliate_link ครบ) ก่อนหน้านี้ยังถูกต้อง เพราะสคริปต์ดึงข้อมูลทุกบทความ live จาก Grist แบบ dynamic ไม่ได้ hardcode จำนวน จึงไม่ต้องเช็คซ้ำ

**สถานะตอนนี้:** sitemap.xml ✅ ใช้งานได้จริง 200 ยืนยันด้วยการทดสอบจริงแล้ว

### 2026-08-05 (15:56) – ✅ Phase 6 (Automation) ปิดจ็อบสมบูรณ์ 100% – ยืนยันทำงานจริงแล้ว

**สรุปผล:** ยืนยันครบทั้ง 3 GitHub Actions workflows ทำงานอัตโนมัติตาม schedule จริง ไม่ใช่แค่คำยืนยันปากเปล่าเหมือนที่บันทึกไว้ก่อนหน้า

**วิธี verify:** ใช้ `gh run list --workflow="ชื่อ workflow" --limit N` และ `gh run view --log <id>` ดึง log จริงจาก GitHub Actions มาอ่านตรงๆ (เร็วกว่าเปิดเว็บ Actions tab ทีละหน้า)

**ผลแต่ละ workflow:**
1. **Sync GA4 Views to Grist** (cron ทุกชั่วโมง) — ✅ มี run สำเร็จ (เขียว) ตาม schedule
2. **Check Product Links** (cron ทุกชั่วโมง) — ✅ ทำงานถูกต้อง เนื้อหาจริงคือเช็คว่า CONTENT table ใน Grist อ้างอิง product ID ตรงกับ PRODUCTS table ไหม (ป้องกันบทความโยงผิดสินค้า) ไม่ใช่การเช็ค affiliate_link โดยตรง — ผลล่าสุด: PRODUCTS 83 แถว, CONTENT 166 แถว, ตรงกัน 165, แก้อัตโนมัติได้ 0, ลิงก์พังจริง 0, borderline (ไม่บล็อก) 1 รายการ (dji-mini-4k-drone-review แนะนำให้ผูกกับ product ที่ชื่อใกล้เคียงกว่า แต่ไม่บังคับแก้)
3. **Sync Analytics to Grist** (cron ทุก 30 นาที) — ✅ มี run สำเร็จ (เขียว) ต่อเนื่อง 3 รันล่าสุดตาม schedule

**สถานะ Phase 6 ตอนนี้:** ✅ ปิดจ็อบสมบูรณ์ 100% ยืนยันด้วย log จริงจาก GitHub Actions ทั้ง 3 workflow ไม่ใช่แค่ไฟล์ .yml มีอยู่

### อัพเดตตารางสถานะรวม (แทนที่บรรทัดเดิมของ Phase 6)
- Phase 6 (Automation): ✅ ครบ + ✅ ยืนยันทำงานจริง 100% (ทั้ง 3 workflow มี run สำเร็จตาม schedule จริง — ดูรายละเอียดด้านบน)

### 2026-08-10 (11:44) — ✅ System Health dashboard: แก้ครบ 14/14 จุด + ปรับ UI ให้กระชับ

**สรุปผล:** ทำงานทั้งหมดในเซสชันนี้เสร็จสมบูรณ์ 4 เรื่อง ไม่มีจุดค้าง

**1. ตั้งค่า GA4 Key Event สำหรับ affiliate click (รายละเอียดเต็มดูไฟล์ "อัพเดท-10-ส.ค." แยกต่างหาก)**
- แก้ `functions/go/[id].js` ยิง event `affiliate_click` เข้า GA4 คู่ขนานกับ D1 ผ่าน Measurement Protocol
- ตั้ง `GA4_MEASUREMENT_ID` + `GA4_API_SECRET` ใน Cloudflare secrets, ทดสอบคลิกจริงยืนยันแล้ว
- ขั้นต่อไป (รอ 24-48 ชม.): ไป mark `affiliate_click` เป็น Key Event ใน GA4 Admin

**2. ปรับ UI หน้า System Health ให้อยู่จอเดียว**
- ปัญหาเดิม: การ์ดใหญ่ 2 คอลัมน์ (`.sh-card` สูง ~96px) ทำให้ 14 จุดเช็คต้องเลื่อนจอยาวมาก แถมแถวคี่การ์ดตัวสุดท้ายเหลือที่ว่างข้าง ๆ
- แก้ `admin.html`: เปลี่ยน `.sh-card-grid` จาก grid 2 คอลัมน์ → flex column แถวบางแบบ list (สูง ~34px/แถว), การ์ดสรุป 4 ใบด้านบนก็ย่อขนาดลง, ซ่อน detail ไว้จนกว่าจะแตะ (`.sh-card.expanded .sh-card-detail`)
- ผลลัพธ์: ความสูงรวมลดลงมาก ใกล้เคียงจอเดียวมากขึ้น ไม่เสียข้อมูลใดๆ (แค่ซ่อนจนกว่าจะแตะดู)

**3. แก้ GitHub Actions 403 (3 workflow: check-product-links.yml, sync-analytics.yml, sync-ga4-views.yml)**
- สาเหตุ: `system-health.js` เรียก GitHub API แบบไม่มี `GITHUB_TOKEN` เลย โดน rate limit ของ unauthenticated request
- แก้: สร้าง GitHub Fine-grained PAT (สิทธิ์ `Actions: Read-only`, เฉพาะ repo `gravity-blog`) → ตั้งเป็น Cloudflare secret `GITHUB_TOKEN` ผ่าน Dashboard → re-deploy
- **⚠️ บทเรียนด้านความปลอดภัย:** ระหว่างทดสอบ token หลุดเป็น plain text ในแชท 2 รอบ (ทั้งจากการพิมพ์ตรง ๆ และจาก `read -s` ที่ terminal มือถือดันโชว์ค่าจริงในเทอร์มินัลแทนที่จะซ่อน) ต้อง revoke แล้วสร้างใหม่ทุกครั้งที่หลุด — **บทเรียนสำหรับครั้งหน้า:** ห้ามพิมพ์/วาง token ใด ๆ ลง terminal ที่แสดงผลบนจอหรือในแชท ให้ paste ตรงเข้า Cloudflare Dashboard เท่านั้น ถ้าต้องทดสอบ token ให้เขียนลงไฟล์ผ่าน VS Code Editor pane (ไม่ใช่ terminal) + เพิ่มใน `.gitignore` + ใช้ `$(cat file)` ในคำสั่ง curl แทนการพิมพ์ตรง ๆ แล้วลบไฟล์ทิ้งทันทีหลังทดสอบ
- ยืนยันผลสำเร็จผ่าน curl: `status: "ok"` ทั้ง 3 workflow

**4. เปลี่ยน product-webhook/shotstack-callback check จาก "ไม่ทราบ" เป็นยืนยันจริง**
- เดิม: เช็คด้วย GET เฉย ๆ (route เป็น POST-only) เลยได้แค่ `unknown` ไม่ยืนยัน logic จริง
- อ่านโค้ดเต็มพบว่าทั้งสอง route มี early-return ที่ปลอดภัย: `product-webhook.js` skip ก่อนเรียก Shotstack ถ้าไม่มี `product_name`/`image_url`, `shotstack-callback.js` return ก่อนแตะ Grist ถ้า `status !== "done"`
- แก้ `system-health.js`: ยิง POST จริงด้วย payload ที่ตั้งใจให้ "ไม่ครบ"/"ยังไม่เสร็จ" (`{records:[{id:"health-check",fields:{}}]}` และ `{id:"health-check",status:"queued",url:null}`) เช็คว่าตอบกลับตรงกับ early-return ที่คาดไว้
- ยืนยันผลสำเร็จ: ทั้งคู่ `status: "ok"` — ทดสอบ route จริงได้โดยไม่ trigger การสร้างวิดีโอหรือเขียน Grist จริงเลย

**สถานะ System Health ล่าสุด:** 14/14 จุดเป็น "ปกติ" ทั้งหมด ไม่มีจุดไหนเป็น warn/error/unknown ค้างอยู่

**งานที่ยังค้างจากเซสชันก่อน ๆ (ไม่ใช่ปัญหาด่วน แต่ยังไม่ได้ทำ):**
- [ ] `_worker.bundle` มี modified ค้างอยู่ ยังไม่ commit (เช็ค `git status`)
- [ ] `PROJECT-STATUS.md` ไฟล์นี้ยัง untracked ใน git — ยังไม่ได้เอาเข้า repo จริงตามที่วางแผนไว้ 2026-08-05
- [ ] Affiliate Conversion Webhook (adapter pattern รองรับหลาย network) ยังไม่ได้เริ่มเขียน
- [ ] Mailchimp secrets ยังไม่ได้ตั้งจริงใน Cloudflare
- [ ] Revoke + สร้าง `GRIST_API_KEY` ใหม่ (เคยหลุดในแชทก่อนหน้า)
- [ ] Workflow อัตโนมัติสำหรับ `sync-ga4-views-to-grist.js` ยังไม่มี (รันมือ)
