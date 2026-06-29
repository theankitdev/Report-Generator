# SQAAF Report PDF Service

A tiny Node + Puppeteer microservice that turns the SQAAF report HTML into an A4 PDF.

Your Laravel app keeps doing **all** the work it does today (building the report
HTML with every injector, Gemini prose, images, etc.). The only change is the
final step: instead of shelling out to a system browser, it **POSTs the finished
HTML here** and gets the PDF back.

Because Puppeteer ships its own version-matched Chromium, the
`FT_Get_Transform` / crashpad failures from hand-installing Edge on Amazon
Linux 2023 simply cannot occur.

```
Laravel  ──POST /render { html }──▶  this service ──Puppeteer──▶  PDF  ──▶  Laravel
```

## What's inside
```
report-service/
  server.js        # Express + Puppeteer; POST /render → PDF, GET /health
  package.json
  Dockerfile       # Node + Chromium libs (for Render / any Docker host)
  render.yaml      # Render Blueprint
  assets/          # support.js, image-slot.js, *.png  ← the template's relative assets
```

> **Keep `assets/` in sync.** The report HTML references `./support.js` and a few
> `*.png` files by relative path. They were copied here from
> `public/report-templates/sqaaf/`. If you change those source files, re-copy them.

## Endpoints
- `GET /health` → `{ "ok": true }`
- `POST /render` (header `X-Api-Key: <secret>`), body `{ "html": "<full report html>" }` → `application/pdf`

## Run locally
```bash
cd report-service
npm install            # downloads Puppeteer's Chromium
REPORT_SERVICE_KEY=dev-secret npm start
# → listening on :3000
```

## Deploy on Render
1. Push this folder to a Git repo (or the repo root, pointing the Blueprint at it).
2. Render dashboard → **New + → Blueprint** → select the repo. It reads `render.yaml`.
3. Render builds the Docker image, installs Chromium, and starts the service.
4. Copy the generated **`REPORT_SERVICE_KEY`** value and the service URL
   (e.g. `https://sqaaf-report-pdf.onrender.com`).
5. Use a plan with **≥512 MB RAM** (Chromium needs it). The free tier also
   sleeps when idle — fine for occasional reports, just expect a cold-start delay.

## Wire up Laravel
Add to the Laravel app's `.env`:
```
REPORT_SERVICE_URL="https://sqaaf-report-pdf.onrender.com"
REPORT_SERVICE_KEY="<the value Render generated>"
```
Then replace `renderPdf()` in `app/Services/SqaafQuarterlyReport.php` with the
HTTP version (see `laravel-renderPdf.snippet.php` in this folder), and:
```bash
php artisan config:clear
```
No browser, FreeType, or crashpad anything on the Laravel server anymore.

## Notes
- `RENDER_SETTLE_MS` (default 600) — extra wait after page load so the
  client-side template finishes rendering before printing. Raise it if any
  chart/section looks unrendered.
- The service reuses one Chromium instance and relaunches it if it dies.
