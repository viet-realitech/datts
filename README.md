# Datts — luyện giọng riêng bằng AI

Web app chạy trên iPad để thu giọng của chính bạn (qua DJI Mic Mini), luyện từng bước, rồi thử nhiều
mẫu giọng clone cho tới khi ra giọng đọc tốt cho thuyết minh và podcast.

Toàn bộ bản thu nằm trên thiết bị (IndexedDB). Không có máy chủ riêng của app; trình duyệt gọi thẳng
engine clone giọng mà bạn cấu hình.

## Bốn màn hình

| Tab | Việc làm |
| --- | --- |
| **Thu âm** | Giáo trình 5 bước: câu văn → ngữ cảnh → nhấn nhá → full bài → bài của tôi (dán kịch bản riêng). Mỗi bản thu được chấm kỹ thuật (vỡ tiếng, mức giọng, nền ồn, cắt sát, tốc độ đọc) và, nếu có khoá ElevenLabs, được nhận dạng lại để soát chữ đọc sai. |
| **Thử mẫu** | Tạo nhiều "giọng" từ các nhóm bản thu khác nhau, sinh mẫu theo lưới giọng × model × kiểu đọc trên cùng một đoạn văn, nghe mù, chấm sao, xem bảng xếp hạng. |
| **Studio** | Lấy công thức thắng cuộc, tinh chỉnh 4 thông số, đọc cả bài dài và tải WAV. |
| **Dữ liệu** | Khoá API, tiến độ, xuất bộ dữ liệu zip kiểu LJSpeech (`wavs/` + `metadata.csv`) để fine-tune model riêng. |

## Chạy

```bash
npm install
npm run dev        # máy tính: http://localhost:5173
npm run dev:ipad   # HTTPS tự ký trên mạng LAN, mở địa chỉ "Network" bằng Safari trên iPad
```

Safari chỉ cho dùng micro trên HTTPS. Với `dev:ipad`, Safari sẽ cảnh báo chứng chỉ tự ký — chọn
"Hiện chi tiết → truy cập trang web". Để dùng lâu dài, `npm run build` rồi đưa thư mục `dist/` lên bất
kỳ dịch vụ host tĩnh có HTTPS nào, sau đó "Thêm vào Màn hình chính" trên iPad.

## Thu với DJI Mic Mini

Cắm bộ thu vào cổng USB-C của iPad, bấm **Bật micro**, chọn đúng thiết bị trong ô Micro. App tắt
khử vọng, khử ồn và tự chỉnh gain của trình duyệt để lấy tín hiệu thô, lưu WAV 16-bit mono ở tần số
của thiết bị (thường 48 kHz), tự cắt im lặng hai đầu và chừa 0,3 giây đệm.

## Engine

- **ElevenLabs** (mặc định): clone nhanh từ 1–3 phút bản thu, đọc thử, và soát lời đọc bằng Scribe.
  Danh sách model lấy từ tài khoản; model có tiếng Việt được chọn sẵn.
- **Máy chủ riêng** (tuỳ chọn) cho model mã nguồn mở tự chạy (F5-TTS, viXTTS, GPT-SoVITS…). App gọi:

  ```
  POST {địa chỉ}/synthesize        multipart/form-data
    text       văn bản cần đọc
    ref_text   lời của các bản thu mẫu, nối bằng dấu cách
    ref_audio  một hoặc nhiều file WAV mẫu
    speed      số thực, 1 là bình thường
    model      "default"
  → 200, thân là âm thanh (audio/wav hoặc audio/mpeg)
  ```

  Máy chủ cần bật CORS và chạy HTTPS. Repo chưa kèm máy chủ mẫu.

Khoá API lưu trong localStorage của thiết bị. Chỉ clone giọng của chính bạn hoặc người đã đồng ý.

## Kiểm thử

```bash
npm test                        # chấm bản thu, WAV, so khớp văn bản
npm run build && npm run e2e    # chạy trọn luồng trong Chromium, micro giả + ElevenLabs giả lập
```

## Sửa giáo trình

Nội dung các bài nằm ở `src/lib/curriculum.ts`. Dùng `*dấu sao*` quanh chữ cần nhấn. Giữ nguyên `id`
của bài khi sửa câu để không mất liên kết với bản thu cũ.
