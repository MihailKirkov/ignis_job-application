import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:3000';
const OUT = process.env.OUT || 'D:/Work/Dev/job-application/.shots';
mkdirSync(OUT, { recursive: true });

const shots = [
  { name: 'needs-action', url: '/demo?view=needs-action', w: 1440, h: 900 },
  { name: 'tracker-board', url: '/demo?view=tracker', w: 1440, h: 900 },
  { name: 'tracker-console', url: '/demo?view=tracker&board=console', w: 1440, h: 900 },
  { name: 'discovery', url: '/demo?view=discovery', w: 1440, h: 900 },
  { name: 'needs-action-mobile', url: '/demo?view=needs-action', w: 390, h: 844 },
  { name: 'tracker-board-mobile', url: '/demo?view=tracker', w: 390, h: 844 },
];

const browser = await chromium.launch();
for (const s of shots) {
  const page = await browser.newPage({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: 1 });
  await page.goto(BASE + s.url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${s.name}.png`, fullPage: true });
  await page.close();
  console.log('shot', s.name);
}
await browser.close();
console.log('done');
