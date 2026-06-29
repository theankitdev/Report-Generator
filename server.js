import express from 'express';
import puppeteer from 'puppeteer';
import { writeFile, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/*
 * SQAAF report PDF microservice.
 *
 * Your Laravel app already builds the FINAL report HTML (all data injected).
 * It POSTs that HTML here; this service renders it with Puppeteer's bundled
 * Chromium and returns the PDF bytes. Because Puppeteer ships its own
 * version-matched Chromium, the FreeType / crashpad failures you hit when
 * installing Edge by hand on Amazon Linux 2023 can't happen here.
 *
 * The report template loads ./support.js and a few .png images by RELATIVE
 * path, so the received HTML is written into the assets/ directory (which must
 * contain those files — see README) and opened via file:// so the relative
 * URLs resolve, exactly like the old local render did.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = path.join(__dirname, 'assets');

const PORT = Number(process.env.PORT) || 3000;
const API_KEY = process.env.REPORT_SERVICE_KEY || '';
const NAV_TIMEOUT = Number(process.env.RENDER_TIMEOUT_MS) || 60000;
// Extra settle time after network idle so the client-side template
// (support.js / DCLogic) finishes building the DOM before we print.
const SETTLE_MS = Number(process.env.RENDER_SETTLE_MS) || 600;

const app = express();
app.use(express.json({ limit: '32mb' })); // the built report HTML can be large

/* ---- single shared browser, relaunched if it dies ---- */
let browserPromise = null;
async function getBrowser() {
  if (browserPromise) {
    const b = await browserPromise;
    if (b.connected) return b;
  }
  browserPromise = puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage', // containers have a tiny /dev/shm
      '--disable-gpu',
      '--hide-scrollbars',
    ],
  });
  return browserPromise;
}

app.get('/health', (_req, res) => res.json({ ok: true }));

app.post('/render', async (req, res) => {
  // Shared-secret auth so only your app can call this endpoint.
  if (API_KEY && req.get('X-Api-Key') !== API_KEY) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const html = req.body && req.body.html;
  if (typeof html !== 'string' || html.trim() === '') {
    return res.status(400).json({ error: 'html is required' });
  }

  const token = randomUUID();
  const tmpFile = path.join(ASSETS_DIR, `.render-${token}.html`);
  let page = null;

  try {
    await writeFile(tmpFile, html, 'utf8');

    const browser = await getBrowser();
    page = await browser.newPage();

    await page.goto(pathToFileURL(tmpFile).href, {
      waitUntil: 'networkidle0',
      timeout: NAV_TIMEOUT,
    });

    if (SETTLE_MS > 0) {
      await new Promise((r) => setTimeout(r, SETTLE_MS));
    }

    const pdf = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true, // honour the template's @page { size: A4 }
      format: 'A4', // fallback if the page has no @page size
    });

    res.set('Content-Type', 'application/pdf');
    res.send(Buffer.from(pdf));
  } catch (err) {
    console.error('render failed:', err);
    res.status(500).json({ error: 'render failed', detail: String(err && err.message ? err.message : err) });
  } finally {
    if (page) {
      await page.close().catch(() => {});
    }
    await unlink(tmpFile).catch(() => {});
  }
});

app.listen(PORT, () => {
  console.log(`SQAAF report PDF service listening on :${PORT}`);
});
