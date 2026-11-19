# Datts — luyện giọng riêng bằng AI

Web app chạy trên iPad để thu giọng của chính bạn (qua DJI Mic Mini), luyện từng bước, train một model
riêng trên giọng đó, rồi tự dựng thuyết minh và podcast bằng giọng của bạn.

Toàn bộ bản thu nằm trên thiết bị (IndexedDB). Trình duyệt gọi thẳng engine clone giọng mà bạn cấu
hình: máy chủ mã nguồn mở tự chạy, hoặc ElevenLabs.

## Năm màn hình

| Tab | Việc làm |
| --- | --- |
| **Thu âm** | Giáo trình 6 bước: câu văn → ngữ cảnh → nhấn nhá → full bài → bài của tôi → luyện model (240 câu để train). Mỗi bản thu được chấm kỹ thuật (vỡ tiếng, mức giọng, nền ồn, cắt sát, tốc độ đọc). |
| **Thử mẫu** | Train model riêng trên giọng bạn, tạo giọng clone nhanh từ từng bản thu, sinh mẫu theo lưới giọng × kiểu đọc, nghe mù, chấm sao, xếp hạng. |
| **Studio** | Lấy công thức thắng cuộc, tinh chỉnh, đọc cả bài dài và tải WAV. |
| **Podcast** | Claude viết kịch bản từ chủ đề hoặc tư liệu, chia đoạn và gắn ngữ điệu; app đọc từng đoạn bằng giọng bạn rồi ghép thành một tập. |
| **Dữ liệu** | Cài đặt máy chủ và khoá API, tiến độ, xuất bộ dữ liệu zip kiểu LJSpeech. |

## Chạy

```bash
npm install
npm run dev        # máy tính: http://localhost:5173
npm run dev:ipad   # HTTPS tự ký trên mạng LAN, mở địa chỉ "Network" bằng Safari trên iPad
```

### Dùng trên iPad qua GitHub Pages

Bản build sẵn nằm trong `docs/`. Vào **Settings → Pages** của repo, chọn *Deploy from a branch*, chọn
nhánh chứa code và thư mục `/docs`, bấm Save. Sau khoảng một phút, mở
`https://<chủ-repo>.github.io/datts/` bằng Safari trên iPad rồi "Thêm vào Màn hình chính".
Sau mỗi lần sửa code, chạy `npm run build:pages` và commit lại `docs/`. Trang Pages là công khai với
ai có đường dẫn; bản thu và khoá API vẫn chỉ nằm trên iPad của bạn.

### Chạy từ máy tính trong mạng LAN

Safari chỉ cho dùng micro trên HTTPS. Với `dev:ipad`, Safari sẽ cảnh báo chứng chỉ tự ký — chọn
"Hiện chi tiết → truy cập trang web". Để dùng lâu dài, `npm run build` rồi đưa thư mục `dist/` lên bất
kỳ dịch vụ host tĩnh có HTTPS nào, sau đó "Thêm vào Màn hình chính" trên iPad.

## Thu với DJI Mic Mini

Cắm bộ thu vào cổng USB-C của iPad, bấm **Bật micro**, chọn đúng thiết bị trong ô Micro. App tắt
khử vọng, khử ồn và tự chỉnh gain của trình duyệt để lấy tín hiệu thô, lưu WAV 16-bit mono ở tần số
của thiết bị (thường 48 kHz), tự cắt im lặng hai đầu và chừa 0,3 giây đệm.

## Engine

### Mã nguồn mở — VieNeu-TTS v3 Turbo (mặc định, miễn phí)

`public/server/datts_server.py` là một máy chủ nhỏ bọc [VieNeu-TTS](https://github.com/pnnbao97/VieNeu-TTS)
(Apache-2.0, 48 kHz, chạy được trên CPU). Model clone giọng từ **một mẫu 4–8 giây** và bắt chước luôn ngữ
điệu của mẫu, nên trong tab Thử mẫu mỗi bản thu được dùng như một "giọng" riêng để so.

Chạy trên Google Colab (mở được ngay từ iPad) — dán vào một ô rồi bấm ▶:

```
from google.colab import drive; drive.mount('/content/drive')
!pip -q install vieneu peft fastapi uvicorn python-multipart
!wget -q -O datts_server.py https://viet-realitech.github.io/datts/server/datts_server.py
!python datts_server.py --tunnel --data-dir /content/drive/MyDrive/datts
```

Hoặc trên máy Mac/PC/Linux có Python ≥ 3.10: `pip install vieneu fastapi uvicorn python-multipart`
(thêm `torch transformers peft accelerate pyarrow safetensors` nếu muốn train) rồi
`python public/server/datts_server.py --tunnel` (macOS cần `brew install cloudflared` trước).

Máy chủ in ra một địa chỉ `https://….trycloudflare.com`; dán vào Datts → Dữ liệu → Địa chỉ máy chủ riêng
rồi bấm "Kiểm tra kết nối". Địa chỉ đổi mỗi lần chạy lại, và ai có địa chỉ đều gọi được máy chủ trong lúc
nó chạy.

API của máy chủ (để thay bằng model khác nếu muốn):

```
GET  {địa chỉ}/health        → {"ok": true, "engine": "..."}
POST {địa chỉ}/synthesize    multipart/form-data
  text         văn bản cần đọc
  ref_audio    một hoặc nhiều file WAV mẫu (ghép lại, tối đa 8 giây)
  speed        0.6–1.5, 1 là bình thường (đổi bằng ffmpeg, giữ cao độ)
  temperature  0.2–1.3, mặc định 0.8
  denoise      true/false, mặc định false
→ 200, audio/wav 48 kHz
```

### Train model riêng

Clone nhanh chỉ nghe vài giây mẫu. Để giọng bám sát hơn, tab Thử mẫu gửi các bản thu dài 3–15 giây lên
máy chủ và train một LoRA trên VieNeu-TTS v3 Turbo (theo `finetune/` của repo VieNeu-TTS, ghim ở một
commit đã thử). Nên có 100–300 câu, 10–30 phút. Train chạy được trên CPU; bật GPU T4 trong Colab thì nhanh
hơn. Thêm `--data-dir` (trên Colab: một thư mục Google Drive) để giữ bộ dữ liệu và model qua các lần chạy.
Máy chủ giữ một model đã train tại một thời điểm.

```
POST   {địa chỉ}/dataset/clip    multipart: name, text, file (WAV)
DELETE {địa chỉ}/dataset
POST   {địa chỉ}/train           form: epochs (mặc định 3), rank (mặc định 16)
GET    {địa chỉ}/train/status    → state, step, total, eval_loss, log
POST   {địa chỉ}/synthesize      thêm voice=finetuned để đọc bằng model đã train
```

### Podcast

Tab Podcast gọi Claude (`claude-opus-5-5`) thẳng từ trình duyệt bằng khoá API của bạn, lưu trên thiết bị.
Kịch bản trả về theo cấu trúc: mỗi đoạn một ngữ điệu (chào, kể, hỏi, ngạc nhiên, tâm tình, nghiêm túc,
kết). Khi đọc bằng giọng clone nhanh, mỗi đoạn lấy bản thu cùng ngữ điệu của chính bạn làm mẫu
(`src/lib/podcast.ts` liệt kê câu nào ứng với ngữ điệu nào), nên tập nghe có lên xuống. Không có khoá
Claude vẫn dán kịch bản sẵn rồi dựng tập được.

### ElevenLabs (trả phí)

Clone giọng cần gói Starter trở lên. Gói miễn phí vẫn dùng được để soát lời đọc bằng Scribe.

Chỉ clone giọng của chính bạn hoặc người đã đồng ý.

## Giao diện

Thiết kế theo hướng dẫn của bộ skill [Uizze](https://github.com/uizze/uizze): một hướng riêng cho sản
phẩm ("bàn thu băng từ" — màu phẳng, viền mực, phím lún, đèn mức theo thang dB), font đóng gói kèm có
đủ dấu tiếng Việt (Bricolage Grotesque, Be Vietnam Pro, JetBrains Mono).

## Kiểm thử

```bash
npm test                        # chấm bản thu, WAV, so khớp văn bản
npm run build && npm run e2e    # chạy trọn luồng trong Chromium, micro giả + ElevenLabs giả lập
SERVER=http://localhost:8000 node e2e/oss.mjs       # app gọi datts_server.py thật đang chạy
SERVER=http://localhost:8000 node e2e/train.mjs     # train thật (chạy máy chủ với DATTS_MIN_CLIPS=3)
SERVER=http://localhost:8000 node e2e/podcast.mjs   # tab Podcast, Claude giả lập + máy chủ thật
```

## Sửa giáo trình

Nội dung các bài nằm ở `src/lib/curriculum.ts`. Dùng `*dấu sao*` quanh chữ cần nhấn. Giữ nguyên `id`
của bài khi sửa câu để không mất liên kết với bản thu cũ.
