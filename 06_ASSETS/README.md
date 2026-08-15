[README.md](https://github.com/user-attachments/files/31093928/README.md)
# 06_ASSETS

## Purpose
Home for every non-code, non-documentation media file the project owns:
logos, brand images, icons, screenshots, design mockups, exported graphics,
audio, video, and any binary asset referenced by the product or by docs.

## What belongs here
- Brand assets (logo variants, favicons, color/typography specs)
- UI/UX mockups and exported design files
- Screenshots used in documentation or marketing
- Marketing/social media graphics
- Any exported image, icon, or media file NOT required at runtime by the app itself

## What does NOT belong here
- Assets required at build/runtime by the live app (those stay in the app's
  own `public/` or `assets/` folder inside the codebase — link to them from
  here instead of duplicating)
- Working design files still in progress (keep those in your design tool;
  only export finals here)

## Structure
```
06_ASSETS/
  brand/          → logo, colors, fonts, brand guidelines
  screenshots/     → dated screenshots for docs/reports
  mockups/         → UI/UX design exports
  marketing/       → social, ads, promotional graphics
```

## Naming convention
`YYYY-MM-DD_short-description.ext` for anything time-bound (screenshots, exports).
No `v1`, `v2`, `final`, `final_final` — overwrite or archive the old one instead
(see `16_ARCHIVES`).

## Status
🟡 Newly created — needs first assets migrated in.
