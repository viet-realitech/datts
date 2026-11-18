// Chạy thử toàn bộ luồng trong Chromium với micro giả và ElevenLabs giả lập.
// Dùng: npm run build && npm run e2e   (ảnh chụp lưu vào thư mục truyền qua SHOTS, nếu có)
import { createRequire } from 'node:module';
import { preview } from 'vite';
import assert from 'node:assert/strict';

// Playwright có thể được cài toàn cục (NODE_PATH) thay vì trong dự án.
const { chromium } = createRequire(import.meta.url)('playwright');
const shots = process.env.SHOTS;
const server = await preview({ preview: { port: 4179, strictPort: true } });
const browser = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: shots ? 2 : 1, permissions: ['microphone'] });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

// WAV 1 giây làm "giọng đọc" trả về.
const wav = (() => {
  const sr = 44100, n = sr, b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(8000 * Math.sin(i / 20)), 44 + i * 2);
  return b;
})();
const calls = { add: 0, tts: [], stt: 0 };
await page.route('https://api.elevenlabs.io/**', async route => {
  const req = route.request(), url = new URL(req.url());
  const json = body => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  if (url.pathname === '/v1/models') return json([
    { model_id: 'eleven_v3', name: 'Eleven v3', can_do_text_to_speech: true, languages: [{ language_id: 'vi' }] },
    { model_id: 'eleven_multilingual_v2', name: 'Multilingual v2', can_do_text_to_speech: true, languages: [{ language_id: 'en' }] },
  ]);
  if (url.pathname === '/v1/voices/add') { calls.add++; return json({ voice_id: 'voice_test', requires_verification: false }); }
  if (url.pathname === '/v1/speech-to-text') { calls.stt++; return json({ text: 'Ba bà bán bánh bao bên bến Bình Ba.' }); }
  if (url.pathname.startsWith('/v1/text-to-speech/')) { calls.tts.push(req.postDataJSON()); return route.fulfill({ status: 200, contentType: 'audio/mpeg', body: wav }); }
  return route.fulfill({ status: 404, body: '{}' });
});
const shot = async name => { if (shots) await page.screenshot({ path: `${shots}/${name}.png` }); };

await page.goto('http://localhost:4179/');
await page.getByRole('tab', { name: 'Dữ liệu' }).click();
await page.getByLabel('Khoá API ElevenLabs').fill('sk_test');

// 1. Thu âm
await page.getByRole('tab', { name: 'Thu âm' }).click();
const rec = page.getByTestId('rec');
await rec.click();
await page.getByText('Đang dùng:').waitFor();
await rec.click();
await page.waitForTimeout(2500);
await shot('1-dang-thu');
await rec.click();
await page.locator('.take').first().waitFor();
await page.getByText(/Khớp lời 100%/).waitFor();
assert.equal(calls.stt, 1);
await shot('2-ban-thu');
assert.match(await page.locator('.lesson.on .count').innerText(), /1\/12/);

// Bài tự soạn
await page.getByRole('button', { name: /Thêm bài của tôi/ }).click();
await page.getByLabel('Tên bài').fill('Tập thử');
await page.getByLabel('Nội dung').fill('Câu thứ nhất của *tôi*. Câu thứ hai đây!');
await page.getByText('2 mục thu').waitFor();
await page.getByRole('button', { name: 'Lưu bài' }).click();
await page.locator('.lesson.on', { hasText: 'Tập thử' }).waitFor();

// 2. Thử mẫu
await page.getByRole('tab', { name: 'Thử mẫu' }).click();
await page.locator('.picker input[type=checkbox]').first().check();
await page.getByLabel('Tên giọng').fill('Giọng thử');
await page.getByRole('button', { name: 'Tạo giọng', exact: true }).click();
await page.getByRole('heading', { name: '2 · Tạo mẫu thử' }).waitFor();
assert.equal(calls.add, 1);
await page.getByRole('button', { name: 'Tạo 2 mẫu' }).click();
await page.locator('.trial').nth(1).waitFor();
assert.equal(calls.tts.length, 2);
assert.equal(calls.tts[0].model_id, 'eleven_v3');
assert.equal(calls.tts[0].language_code, 'vi');
assert.deepEqual(calls.tts.map(c => c.voice_settings.stability), [0.6, 0.4]);
await page.locator('.trial').first().getByRole('radio', { name: '4 sao' }).click();
await page.locator('.board .bar').first().waitFor();
await shot('3-thu-mau');

// 3. Studio
await page.locator('.trial').first().getByRole('button', { name: /Dùng công thức này/ }).click();
await page.getByRole('heading', { name: 'Công thức đang dùng' }).waitFor();
await page.locator('textarea').fill('Đoạn một của bài.\n\nĐoạn hai của bài.');
await page.getByRole('button', { name: 'Tạo bản đọc' }).click();
await page.getByRole('button', { name: 'Tải WAV' }).waitFor();
assert.equal(calls.tts.length, 4);
assert.equal(calls.tts[2].next_text, 'Đoạn hai của bài.');
assert.equal(calls.tts[3].previous_text, 'Đoạn một của bài.');
await shot('4-studio');

// 4. Xuất bộ dữ liệu + dữ liệu còn sau khi tải lại
await page.getByRole('tab', { name: 'Dữ liệu' }).click();
const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Xuất bản chính \(1\)/ }).click()]);
assert.match(dl.suggestedFilename(), /^datts-dataset-.*\.zip$/);
await shot('5-du-lieu');
await page.reload();
await page.locator('.take.kept').waitFor();

// Bố cục điện thoại/iPad dọc không tràn ngang
await page.setViewportSize({ width: 390, height: 780 });
assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'tràn ngang ở 390px');
await shot('6-hep');

await browser.close();
await server.close();
assert.deepEqual(errors, []);
console.log('OK — luồng thu → clone → thử mẫu → studio → xuất chạy trọn vẹn');
