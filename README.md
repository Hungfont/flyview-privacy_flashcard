# FlyVocab — Học từ vựng tiếng Anh (B1–C2, IELTS)

Flashcard học 12.749 từ trong `vocabulary.txt` theo chủ đề, cấp độ và kế hoạch 30 ngày.
Lịch ôn dùng thuật toán FSRS. Tiến độ được lưu trong SQLite tại `data/flashcard.db`.

## Chạy

```bash
npm install
npm run dev     # API (cổng 3001) + giao diện tại http://localhost:5173
npm start       # build và chạy bản production tại http://localhost:3001
```

Yêu cầu Node.js ≥ 22.13 (dùng `node:sqlite` có sẵn). Lần chạy đầu sẽ nhập `vocabulary.txt` vào database.
Mỗi lần khởi động, server đồng bộ nội dung từ vựng theo `id` mà không đụng tới tiến độ học.

## Cấu trúc

- `server/index.ts`: API Express, SQLite, lập lịch FSRS
- `src/pages/`: Hôm nay, Học mới, Ôn tập, Từ điển, Thống kê, Phương pháp, Cài đặt
- `vocabulary.txt`: dữ liệu từ vựng (`id | word | ipa | pos | meaning_vi | example | level | topic | tags | day | priority | definition | zh | pinyin`). Sửa file rồi khởi động lại server là cập nhật, tiến độ học được giữ nguyên.
# flyview-privacy_flashcard
