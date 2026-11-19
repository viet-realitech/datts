// Thử chuỗi app → máy chủ mã nguồn mở THẬT (datts_server.py đang chạy sẵn).
// Dùng: npm run build && SERVER=http://localhost:8000 node e2e/oss.mjs
import { createRequire } from 'node:module';
import { preview } from 'vite';
import assert from 'node:assert/strict';

const { chromium } = createRequire(import.meta.url)('playwright');
const SERVER = process.env.SERVER ?? 'http://localhost:8000';
const shots = process.env.SHOTS;
const server = await preview({ preview: { port: 4180, strictPort: true } });
const browser = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
const page = await (await browser.newContext({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: shots ? 2 : 1, permissions: ['microphone'] })).newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));

await page.goto('http://localhost:4180/');
await page.getByRole('tab', { name: 'Dữ liệu' }).click();
await page.getByLabel('Địa chỉ máy chủ riêng').fill(SERVER);
await page.getByRole('button', { name: 'Kiểm tra kết nối' }).click();
await page.getByText(/Đã nối với VieNeu/).waitFor();
if (shots) await page.screenshot({ path: `${shots}/7-cai-dat-oss.png`, fullPage: true });

await page.getByRole('tab', { name: 'Thu âm' }).click();
const rec = page.getByTestId('rec');
await rec.click();
await page.getByText('Đang dùng:').waitFor();
await rec.click();
await page.waitForTimeout(3000);
await rec.click();
await page.locator('.take').first().waitFor();

await page.getByRole('tab', { name: 'Thử mẫu' }).click();
await page.locator('.picker input[type=checkbox]').first().check();
await page.getByRole('button', { name: /Mỗi bản thu một giọng \(1\)/ }).click();
await page.getByRole('heading', { name: '2 · Tạo mẫu thử' }).waitFor();
await page.getByRole('button', { name: 'Chậm rãi (0,9×)' }).click();
await page.getByRole('button', { name: 'Tạo 2 mẫu' }).click();
await page.locator('.trial').nth(1).waitFor({ timeout: 300_000 });
assert.equal(await page.locator('.error').count(), 0);
const durations = await page.locator('.trial audio').evaluateAll(els => Promise.all(els.map(a => new Promise(r => { if (a.duration) r(a.duration); else a.onloadedmetadata = () => r(a.duration); }))));
console.log('Độ dài mẫu (giây):', durations.map(d => d.toFixed(1)).join(', '));
assert.ok(durations.every(d => d > 3), 'mẫu trả về quá ngắn');
if (shots) await page.screenshot({ path: `${shots}/8-thu-mau-oss.png` });

await page.locator('.trial').first().getByRole('button', { name: /Dùng công thức này/ }).click();
await page.locator('textarea').fill('Đoạn một của bài thử.\n\nĐoạn hai của bài thử.');
await page.getByRole('button', { name: 'Tạo bản đọc' }).click();
await page.getByRole('button', { name: 'Tải WAV' }).waitFor({ timeout: 300_000 });

await browser.close();
await server.close();
assert.deepEqual(errors, []);
console.log('OK — app gọi máy chủ mã nguồn mở thật và nhận được giọng đọc');
