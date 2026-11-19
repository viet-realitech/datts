// Thử tab Podcast: Claude giả lập viết kịch bản → máy chủ mã nguồn mở THẬT đọc từng đoạn → ghép thành tập.
// SERVER=http://localhost:8000 node e2e/podcast.mjs
import { createRequire } from 'node:module';
import { preview } from 'vite';
import assert from 'node:assert/strict';

const { chromium } = createRequire(import.meta.url)('playwright');
const SERVER = process.env.SERVER ?? 'http://localhost:8000';
const shots = process.env.SHOTS;
const server = await preview({ preview: { port: 4182, strictPort: true } });
const browser = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
const page = await (await browser.newContext({ viewport: { width: 1180, height: 900 }, deviceScaleFactor: shots ? 2 : 1, permissions: ['microphone'] })).newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));

const script = { title: 'Dậy sớm có khó không', segments: [
  { style: 'chao', text: 'Xin chào các bạn, mình rất vui được gặp lại các bạn.', new_paragraph: false },
  { style: 'hoi', text: 'Bạn đã bao giờ đặt năm cái báo thức mà vẫn không dậy nổi chưa?', new_paragraph: true },
  { style: 'ket', text: 'Hẹn gặp lại các bạn vào tuần sau.', new_paragraph: true },
] };
let claudeBody;
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
await page.route('https://api.anthropic.com/**', async route => {
  const req = route.request();
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
  claudeBody = req.postDataJSON();
  const h = await req.allHeaders();
  assert.ok(h['x-api-key'] === 'sk-ant-test' || h.authorization === 'Bearer sk-ant-test', 'thiếu khoá API trong yêu cầu');
  return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({
    id: 'msg_test', type: 'message', role: 'assistant', model: 'claude-opus-5-5', stop_reason: 'end_turn', stop_sequence: null,
    content: [{ type: 'text', text: JSON.stringify(script) }], usage: { input_tokens: 10, output_tokens: 10 },
  }) });
});
const synth = [];
page.on('request', r => { if (r.url().endsWith('/synthesize')) synth.push(r.postData() ?? ''); });

await page.goto('http://localhost:4182/');
await page.getByRole('tab', { name: 'Dữ liệu' }).click();
await page.getByLabel('Địa chỉ máy chủ riêng').fill(SERVER);
await page.getByLabel('Khoá API Claude').fill('sk-ant-test');

// Thu một câu hỏi mẫu (ctx-1-2) để có mẫu cho ngữ điệu "hỏi", và tạo một giọng clone từ câu đầu.
await page.getByRole('tab', { name: 'Thu âm' }).click();
await page.locator('.lesson', { hasText: 'Kiểu câu' }).click();
const rec = page.getByTestId('rec');
await rec.click();
await page.getByText('Đang dùng:').waitFor();
for (let i = 0; i < 2; i++) {
  await rec.click(); await page.waitForTimeout(4000); await rec.click();
  await page.locator('.take').first().waitFor();
  if (i === 0) await page.getByRole('button', { name: 'Câu sau' }).click();
}
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
await page.locator('.picker input[type=checkbox]').first().check();
await page.getByRole('button', { name: /Mỗi bản thu một giọng \(1\)/ }).click();
await page.getByRole('heading', { name: '2 · Tạo mẫu thử' }).waitFor();

await page.getByRole('tab', { name: 'Podcast' }).click();
await page.getByLabel('Chủ đề hoặc tư liệu').fill('Vì sao dậy sớm khó, và ba cách mình đã thử.');
await page.getByRole('button', { name: 'Viết kịch bản' }).click();
await page.getByLabel('Lời đoạn 3').waitFor();
assert.equal(claudeBody.model, 'claude-opus-5-5');
assert.equal(claudeBody.fallbacks, 'default');
assert.equal(claudeBody.output_config.format.type, 'json_schema');
assert.match(claudeBody.messages[0].content, /khoảng 3 phút/);
assert.equal(await page.getByLabel('Ngữ điệu đoạn 2').inputValue(), 'hoi');
await page.getByText(/Chưa có bản thu mẫu cho ngữ điệu: Chào, tươi, Chốt, kết/).waitFor();
if (shots) await page.screenshot({ path: `${shots}/11-podcast.png`, fullPage: true });

await page.getByRole('button', { name: 'Dựng tập' }).click();
await page.getByRole('button', { name: 'Tải WAV' }).waitFor({ timeout: 300_000 });
assert.equal(await page.locator('.error').count(), 0);
assert.equal(synth.length, 3);
// Đoạn "hỏi" phải dùng bản thu câu hỏi của người dùng làm mẫu; hai đoạn còn lại dùng mẫu của giọng.
assert.match(synth[1], /filename="ctx-1-2\.wav"/);
assert.match(synth[0], /filename="ctx-1-1\.wav"/);
const d = await page.locator('.result audio').evaluate(a => new Promise(r => { if (a.duration) r(a.duration); else a.onloadedmetadata = () => r(a.duration); }));
console.log('Tập dựng xong dài', d.toFixed(1), 'giây');
assert.ok(d > 8);

// Sửa một đoạn rồi dựng lại: chỉ đoạn đó được đọc lại.
await page.getByLabel('Lời đoạn 3').fill('Cảm ơn và hẹn gặp lại các bạn.');
await page.getByRole('button', { name: 'Dựng lại' }).click();
await page.getByRole('button', { name: 'Dựng lại' }).waitFor({ timeout: 300_000 });
await page.getByRole('button', { name: 'Tải WAV' }).waitFor({ timeout: 300_000 });
assert.equal(synth.length, 4);

// Dán kịch bản có sẵn, không cần AI.
await page.getByRole('button', { name: 'Dán kịch bản có sẵn' }).click();
await page.getByLabel('Kịch bản', { exact: true }).fill('Xin chào. Bạn khoẻ không?\n\nHẹn gặp lại.');
await page.getByText('3 đoạn', { exact: true }).waitFor();
await page.getByRole('button', { name: 'Dùng kịch bản này' }).click();
assert.equal(await page.getByLabel('Ngữ điệu đoạn 2').inputValue(), 'hoi');

await page.setViewportSize({ width: 390, height: 780 });
assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'tràn ngang ở 390px');
await browser.close();
await server.close();
assert.deepEqual(errors, []);
console.log('OK — viết kịch bản, đọc theo ngữ điệu từng đoạn, ghép thành tập');
