// Thử chuỗi train THẬT: app gửi bản thu → datts_server.py train → đọc bằng model đã train.
// Máy chủ cần chạy với DATTS_MIN_CLIPS=3 (micro giả chỉ thu được vài câu). SERVER=http://localhost:8000 node e2e/train.mjs
import { createRequire } from 'node:module';
import { preview } from 'vite';
import assert from 'node:assert/strict';

const { chromium } = createRequire(import.meta.url)('playwright');
const SERVER = process.env.SERVER ?? 'http://localhost:8000';
const shots = process.env.SHOTS;
const server = await preview({ preview: { port: 4181, strictPort: true } });
const browser = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
const page = await (await browser.newContext({ viewport: { width: 1180, height: 900 }, deviceScaleFactor: shots ? 2 : 1, permissions: ['microphone'] })).newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));

await page.goto('http://localhost:4181/');
await page.getByRole('tab', { name: 'Dữ liệu' }).click();
await page.getByLabel('Địa chỉ máy chủ riêng').fill(SERVER);

// Thu 3 câu trong bài "Luyện model", mỗi câu ~4 giây.
await page.getByRole('tab', { name: 'Thu âm' }).click();
await page.locator('.lesson', { hasText: 'Dẫn podcast' }).click();
const rec = page.getByTestId('rec');
await rec.click();
await page.getByText('Đang dùng:').waitFor();
for (let i = 0; i < 3; i++) {
  await rec.click();
  await page.waitForTimeout(4200);
  await rec.click();
  await page.locator('.take').first().waitFor();
  if (i < 2) await page.getByRole('button', { name: 'Câu sau' }).click();
}
if (shots) await page.screenshot({ path: `${shots}/9-luyen-model.png` });
// Tiếng bíp của micro giả bị chấm điểm thấp; nâng điểm để các bản thu đủ điều kiện train.
await page.evaluate(() => new Promise((res, rej) => {
  const open = indexedDB.open('datts');
  open.onsuccess = () => {
    const tx = open.result.transaction('takes', 'readwrite'), st = tx.objectStore('takes');
    st.getAll().onsuccess = e => { for (const t of e.target.result) st.put({ ...t, kept: true, metrics: { ...t.metrics, score: 100 } }); };
    tx.oncomplete = res; tx.onerror = rej;
  };
}));
await page.reload();

await page.getByRole('tab', { name: 'Thử mẫu' }).click();
await page.getByText('3 câu dùng được').waitFor();
await page.getByRole('button', { name: /Gửi 3 câu và train/ }).click();
await page.getByText('Đã train xong').waitFor({ timeout: 600_000 });
await page.locator('.voices li', { hasText: 'Model riêng' }).waitFor();
if (shots) await page.screenshot({ path: `${shots}/10-train-xong.png` });

await page.getByRole('button', { name: 'Tạo 1 mẫu' }).click();
await page.locator('.trial').first().waitFor({ timeout: 300_000 });
assert.equal(await page.locator('.error').count(), 0);
const d = await page.locator('.trial audio').first().evaluate(a => new Promise(r => { if (a.duration) r(a.duration); else a.onloadedmetadata = () => r(a.duration); }));
console.log('Mẫu đọc bằng model đã train dài', d.toFixed(1), 'giây');
assert.ok(d > 3);

await browser.close();
await server.close();
assert.deepEqual(errors, []);
console.log('OK — app gửi dữ liệu, máy chủ train thật, rồi đọc bằng model vừa train');
