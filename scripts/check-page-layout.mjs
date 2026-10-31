// Local, read-only UI verification. Admin rendering uses source/API fixtures;
// it never bypasses deployed authentication or writes application data.
import { createRequire } from 'node:module';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const base = process.env.LAYOUT_BASE_URL || 'http://127.0.0.1:8788';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Local validation only');
const output = resolve(process.env.LAYOUT_OUTPUT || '/tmp/clime-layout-results');
const widths = process.env.LAYOUT_WIDTHS ? process.env.LAYOUT_WIDTHS.split(',').map(Number) : [320, 360, 390, 430, 759, 760, 761, 768, 1024, 1440];
if (!widths.length || widths.some(w => !Number.isInteger(w) || w < 160 || w > 5000)) throw new Error('Invalid validation widths');
const paths = process.env.LAYOUT_PATHS ? process.env.LAYOUT_PATHS.split(',') : ['/', '/about/', '/structure/', '/guide/', '/disclosures/',
  '/disclosures/service/', '/disclosures/safety/', '/disclosures/privacy/',
  '/service-facts/', '/links/', '/reviews/', '/404.html', '/terms'];
const admin = ['index', 'login', 'content', 'applications', 'duplicates', 'review', 'reviews'];
const scope = process.env.LAYOUT_SCOPE || 'all';
if (!['all', 'public', 'admin'].includes(scope)) throw new Error('Invalid validation scope');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
const results = [];

function measure() {
  const elements = [...document.querySelectorAll('body *')];
  const visible = e => { const r=e.getBoundingClientRect(); return r.width && r.height && !e.closest('[inert], [aria-hidden="true"]') && getComputedStyle(e).visibility !== 'hidden'; };
  const describe = e => ({ tag: e.tagName, id: e.id, className: String(e.className).slice(0, 100), text: e.textContent.trim().slice(0, 70) });
  const outliers = elements.filter(e => visible(e) && getComputedStyle(e).position !== 'fixed')
    .filter(e => { const r=e.getBoundingClientRect(); return r.left < -1 || r.right > innerWidth + 1; }).map(describe);
  const clipped = [...document.querySelectorAll('h1,h2,h3,p,button,label,small')]
    .filter(e => visible(e) && e.clientWidth && ['hidden','clip'].includes(getComputedStyle(e).overflowX) && e.scrollWidth > e.clientWidth + 2).map(describe);
  const ids = [...document.querySelectorAll('[id]')].map(e=>e.id);
  return { viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth, outliers, clipped,
    duplicateIds: [...new Set(ids.filter((id,i)=>ids.indexOf(id)!==i))],
    emptyLinks: [...document.querySelectorAll('a[href=""]')].map(describe) };
}

async function check(path, width, fixture = false) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  if (fixture) {
    await page.route('**/admin/**', async route => {
      const pathname = new URL(route.request().url()).pathname;
      const file = resolve(root, 'public', '.' + pathname);
      if (!file.startsWith(resolve(root, 'public/admin') + '/')) return route.abort();
      try {
        const body = await readFile(file);
        const type = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript' }[extname(file)] || 'application/octet-stream';
        await route.fulfill({ body, contentType: type });
      } catch { await route.continue(); }
    });
    await page.route('**/api/admin/**', route => route.fulfill({ json: {
      items: [], groups: [], total: 0, cursor: null,
      stats: { pending: 0, approvedLast7Days: 0, rejectedLast7Days: 0, duplicateGroups: 0 },
      asOf: '2026-11-01T00:00:00Z',
      counts: { pending: 0, approved: 0, rejected: 0 }
    } }));
  }
  try {
    const response = await page.goto(base + path, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const metrics = await page.evaluate(measure);
    const record = { path, width, fixture, status: response.status(), errors, ...metrics };
    if (fixture && width <= 780 && await page.locator('.admin-menu-toggle').count()) {
      await page.locator('.admin-menu-toggle').click();
      record.openMenu = await page.evaluate(measure);
      await page.locator('[data-admin-menu-close]').click();
    }
    results.push(record);
    if ([320, 390, 1440].includes(width)) {
      await page.screenshot({ path: resolve(output, (path === '/' ? 'home' : path.replaceAll('/', '_')) + '-' + width + '.png'), fullPage: true });
    }
    return record;
  } finally { await context.close(); }
}

try {
  for (const path of scope === 'admin' ? [] : paths) {
    for (const width of widths) await check(path, width);
    console.log('Checked', path);
  }
  for (const name of scope === 'public' ? [] : admin) {
    for (const width of widths) await check(`/admin/${name}.html`, width, true);
    console.log('Checked admin fixture', name);
  }
} finally {
  await browser.close();
  await writeFile(resolve(output, 'results.json'), JSON.stringify(results, null, 2) + '\n');
}
const badLayout = r => r.scrollWidth > r.viewport || r.outliers.length || r.clipped.length || r.emptyLinks.length || r.duplicateIds.length;
const failures = results.filter(r => badLayout(r) || (r.openMenu && badLayout(r.openMenu)) || r.errors.length || r.status !== (r.path === '/terms' ? 410 : 200));
console.log(JSON.stringify({ checked: results.length, failures: failures.length, output }, null, 2));
if (failures.length) {
  await writeFile(resolve(output, 'failures.json'), JSON.stringify(failures, null, 2) + '\n');
  process.exitCode = 1;
}
