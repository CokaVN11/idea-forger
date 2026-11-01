# Idea Forge

Hệ thống hoá những gì bạn thu thập & học được, rồi biến chúng thành hành động.
_Systemize what you collect & learn, then turn it into action._

Stack: **React + TypeScript + Vite + Tailwind CSS v4 + shadcn/ui**, với **Cloudflare Workers + D1 (SQLite)** cho API và dữ liệu.

Frontend dùng React state, form HTML và `fetch`; giữ hash routing để tương thích liên kết note và bookmarklet cũ. Component shadcn nằm trong source, chỉ cài những component đang dùng. Cloudflare Vite plugin chạy UI và API cùng một lệnh, không cần backend dev server riêng.

## Pipeline 5 bước × CliftonStrengths

| Bước        | Framework                                                            | Talent       |
| ----------- | -------------------------------------------------------------------- | ------------ |
| 1 · Capture | Commonplace Book, Inbox, bookmarklet                                 | Input        |
| 2 · Distill | Progressive Summarization, Feynman, Spaced Repetition (SM-2)         | Learner      |
| 3 · Connect | Zettelkasten (liên kết 2 chiều + lý do), Timeline, gợi ý liên kết    | Context      |
| 4 · Spark   | Idea Collider: Combinatorial creativity + SCAMPER                    | Ideation     |
| 5 · Ship    | PARA, CODE (Express), WIP limit, Ship ratio, "Việc nhỏ nhất hôm nay" | Bù Activator |

**Cơ chế bù Activator:** Inbox có giới hạn (`INBOX_LIMIT`, mặc định 20), mỗi note có ô _Hành động tiếp theo_, cột "Đang làm" giới hạn WIP = 2, và dashboard hiển thị Ship ratio (số output / số note thu thập).

---

## Deploy (≈ 5 phút) · _Deploy (~5 min)_

Yêu cầu: Node 22.12+ và một tài khoản Cloudflare (free). _Requires Node 22.12+ and a free Cloudflare account._

```bash
npm install
npx wrangler login                          # mở trình duyệt để đăng nhập Cloudflare

# 1. Tạo database / Create the database
npx wrangler d1 create idea-forge-db
#    → copy "database_id" vào wrangler.jsonc

# 2. Tạo bảng / Create tables
npm run db:migrate:remote

# 3. Đặt mật khẩu API (chuỗi dài, ngẫu nhiên) / Set the API token
npx wrangler secret put API_TOKEN

# 4. Deploy
npm run deploy
#    → https://idea-forge.<subdomain>.workers.dev
```

Mở URL, nhập token là dùng được. _Open the URL, enter the token, done._

### Chạy local · _Run locally_

```bash
cp .dev.vars.example .dev.vars
npm run db:migrate:local
npm run dev                                  # http://localhost:5173 · token: dev-token
```

### Build và kiểm tra local

```bash
npm run typecheck          # Kiểm tra client, Worker và Vite config
npm run build              # Typecheck + build UI và Worker vào dist/
npm run preview            # Chạy bản build với Worker/D1 local
```

`npm run deploy` luôn build trước khi deploy. Vite tạo cấu hình deploy tại
`dist/idea_forge/wrangler.json`; Wrangler tự chọn cấu hình này qua `.wrangler/deploy/config.json`.
Không sửa các file được generate trong `dist/`.

Thêm component UI khi cần:

```bash
npx shadcn@latest add dialog
```

Alias `@/` trỏ tới `src/client/`. State thuộc từng page; phần dùng chung
(auth, ngôn ngữ, theme, thông báo, refresh sau mutation) nằm trong React context.
Không cần router, state store, thư viện query, form hay chart riêng cho phạm vi hiện tại.

### Bảo mật thêm (khuyên dùng) · _Extra security (recommended)_

Token đơn giản là đủ cho dùng cá nhân. Muốn chắc hơn thì bật **Cloudflare Access** (Zero Trust, free tối đa 50 user) cho domain của Worker để đăng nhập bằng email/Google trước khi tới app.

---

## Sử dụng · _Usage_

- **Phím tắt:** `c` thu thập · `/` tìm kiếm · `Ctrl/⌘ + Enter` lưu form · trong Review: `Space` hiện đáp án, `1–4` chấm điểm
- **Bookmarklet:** vào Cài đặt, kéo nút "+ Idea Forge" lên thanh bookmark. Bôi đen đoạn văn trên trang bất kỳ rồi bấm để capture kèm URL.
- **Tìm kiếm** không cần gõ dấu: "nguoi choi" vẫn ra "Người chơi" (FTS5 `remove_diacritics`).
- **Sao lưu:** Cài đặt → Xuất JSON. D1 còn có Time Travel, cho phép khôi phục về bất kỳ thời điểm nào trong 30 ngày:
  `npx wrangler d1 time-travel restore idea-forge-db --timestamp=<ISO>`

## Cấu hình · _Config_ (`wrangler.jsonc` → `vars`)

| Biến              | Mặc định | Ý nghĩa                                   |
| ----------------- | -------- | ----------------------------------------- |
| `INBOX_LIMIT`     | 20       | Ngưỡng cảnh báo Inbox đầy                 |
| `TZ_OFFSET_HOURS` | 7        | Múi giờ để tính "hôm nay" cho lịch ôn tập |

## Cấu trúc · _Structure_

```
index.html               Vite HTML entry
src/client/              React app, pages, styles, API hooks, i18n
src/client/components/ui/ shadcn/ui components (source-owned)
src/index.ts             Worker API (/api/*)
vite.config.ts           React + Tailwind + Cloudflare plugins
components.json          shadcn CLI config and aliases
migrations/0001_init.sql Schema D1: notes, tags, links, outputs, sparks, FTS5
```

### API (Bearer token)

`GET /api/stats` · `GET|POST /api/notes` · `GET|PATCH|DELETE /api/notes/:id` · `POST /api/notes/:id/links` · `GET /api/notes/:id/suggest` · `POST /api/notes/:id/review` · `DELETE /api/links/:id` · `GET /api/review` · `GET /api/spark?mode=random|distant&tag=` · `POST /api/sparks` · `GET|POST /api/outputs` · `PATCH|DELETE /api/outputs/:id` · `POST /api/outputs/:id/notes` · `GET /api/tags` · `GET /api/export` · `POST /api/import`

API này cũng cho phép script hoặc agent (Claude Code chẳng hạn) đẩy note vào tự động.

## Roadmap V2

Schema đã chừa chỗ cho các tính năng sau:

- **Workers AI**: tự gợi ý tóm tắt Feynman và tags khi distill
- **Vectorize**: gợi ý liên kết theo ngữ nghĩa (embedding), thay cho FTS + tag hiện tại
- Graph view, Maps of Content, nhập Kindle highlights / RSS
