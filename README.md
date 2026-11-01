# Idea Forge

Ứng dụng quản lý tri thức cá nhân: lưu ý tưởng, chắt lọc điều đã học, kết nối ghi chú và biến chúng thành hành động.

Idea Forge có giao diện tiếng Việt/Anh, theme sáng/tối và chạy trên Cloudflare Workers với D1. Bạn có thể clone hoặc fork repository để chạy local và tự deploy trên tài khoản Cloudflare của mình.

## Tính năng

Luồng làm việc gồm 5 bước:

| Bước    | Công việc                                                       | Phương pháp                       |
| ------- | --------------------------------------------------------------- | --------------------------------- |
| Capture | Lưu ý tưởng, trích dẫn, bài học và đường dẫn vào Inbox          | Commonplace Book, bookmarklet     |
| Distill | Viết tóm tắt, bổ sung ngữ cảnh và ôn tập ghi chú                | Feynman, spaced repetition SM-2   |
| Connect | Tìm kiếm, gắn tag, tạo liên kết hai chiều và xem dòng thời gian | Zettelkasten                      |
| Spark   | Ghép hai ghi chú để phát triển ý tưởng mới                      | Combinatorial creativity, SCAMPER |
| Ship    | Biến ghi chú thành output và theo dõi tiến độ                   | PARA, CODE, WIP limit             |

Các chức năng hỗ trợ:

- Tìm kiếm tiếng Việt có hoặc không có dấu.
- Bookmarklet lưu nội dung đang chọn cùng URL và tiêu đề trang nguồn.
- Lịch ôn tập, gợi ý liên kết và tìm lại ghi chú cũ.
- Bảng output với các trạng thái dự định, đang làm và đã ship.
- Dashboard theo dõi Inbox, hành động tiếp theo và tỷ lệ output đã ship so với ghi chú thu thập.
- Xuất/nhập bản sao lưu JSON.

Đây là ứng dụng dùng cho cá nhân với một API token chung cho mỗi bản deploy. Project chưa có tài khoản người dùng hay phân quyền cho nhiều người.

## Stack

- **UI:** React, TypeScript, Vite, Tailwind CSS v4 và shadcn/ui.
- **API:** Cloudflare Workers.
- **Dữ liệu:** Cloudflare D1, SQLite và FTS5.
- **CI:** GitHub Actions.
- **CD:** Cloudflare Workers Builds.

Frontend dùng React state, form HTML và `fetch`. Cloudflare Vite plugin chạy frontend và API trong cùng dev server. Component shadcn/ui nằm trực tiếp trong source để có thể chỉnh sửa theo nhu cầu.

## Chạy local

Yêu cầu **Node.js 24** và npm. Phiên bản Node được khai báo trong `.node-version`.

```bash
git clone https://github.com/CokaVN11/idea-forger.git
cd idea-forger
npm ci
cp .dev.vars.example .dev.vars
npm run db:migrate:local
npm run dev
```

Mở địa chỉ Vite hiển thị trong terminal, mặc định là `http://localhost:5173`, rồi đăng nhập bằng token trong `.dev.vars`. File mẫu dùng `dev-token` cho môi trường local.

D1 local lưu dữ liệu trong `.wrangler/`. Chạy local không cần deploy hay truy cập database production.

## Tự deploy lên Cloudflare

### 1. Đăng nhập và tạo database

```bash
npx wrangler login
npx wrangler d1 create idea-forge-db
```

Nếu đã có database trong tài khoản của mình, có thể dùng lại database đó và lấy ID từ dashboard D1.

### 2. Cấu hình tài nguyên của bạn

`wrangler.jsonc` chỉ chứa cấu hình dùng chung và Database ID mẫu cho local. Không thêm Account ID, Database ID thật hay token vào file này.

Tạo file cấu hình riêng, đã được Git bỏ qua:

```bash
cp .env.example .env.local
```

Điền các giá trị sau vào `.env.local`:

```dotenv
CLOUDFLARE_ACCOUNT_ID=<account-id-cua-ban>
CLOUDFLARE_D1_DATABASE_ID=<database-id-cua-ban>
```

Có thể xem Account ID trên Cloudflare dashboard. Database ID là UUID do lệnh tạo D1 trả về. Build production đưa các ID này vào cấu hình Worker trong `dist/`, không đưa vào frontend hoặc source được commit.

Tên Worker `name` trong `wrangler.jsonc` phải khớp Worker của bạn trên Cloudflare. Giữ binding D1 là `DB` và binding assets là `ASSETS`. Các script migration dùng binding `DB`, nên không cần sửa script nếu đổi tên database.

### 3. Deploy và đặt API token

```bash
npm run deploy
npx wrangler secret put API_TOKEN
```

`npm run deploy` chạy build production, kiểm tra cấu hình deploy, áp dụng migration D1 remote rồi deploy Worker. Thiếu ID hợp lệ hoặc migration thất bại sẽ dừng deploy. Build thông thường bằng `npm run build` chỉ dùng cấu hình local và không thể deploy qua các script remote.

Khi Wrangler yêu cầu `API_TOKEN`, nhập một chuỗi dài, ngẫu nhiên do bạn chọn. Mở URL của Worker và dùng token này để đăng nhập. Không dùng token mẫu local cho production.

`API_TOKEN` là **secret runtime**. Có thể đặt secret này trong phần Variables and Secrets của Worker trên Cloudflare; không đặt nó trong source hoặc build variable. `.dev.vars` chỉ phục vụ local và đã được Git bỏ qua.

## CI/CD cho repository của bạn

### GitHub Actions

Workflow `.github/workflows/ci.yml` chạy khi:

- Có pull request vào `main`.
- Có push lên `main`.
- Được chạy thủ công qua `workflow_dispatch`.

Các bước kiểm tra gồm cài dependency bằng `npm ci`, kiểm tra chặn deploy sai cấu hình, typecheck/build, áp dụng migration D1 local và đóng gói deploy bằng `wrangler deploy --dry-run`, và build production với ID giả để kiểm tra cấu hình mà không truy cập tài nguyên thật. Workflow không cần secret Cloudflare và không ghi vào database production.

### Cloudflare Workers Builds

Kết nối repository của bạn với Worker, rồi đặt cấu hình trong **Settings → Builds**:

| Thiết lập                     | Giá trị                    |
| ----------------------------- | -------------------------- |
| Production branch             | `main`                     |
| Root directory                | `/`                        |
| Build command                 | `npm run build:production` |
| Deploy command                | `npm run deploy:ci`        |
| Build variable `NODE_VERSION` | `24`                       |

Trong **Build variables**, thêm `CLOUDFLARE_ACCOUNT_ID` và `CLOUDFLARE_D1_DATABASE_ID` bằng giá trị của bạn. Có thể dùng loại secret để ẩn giá trị khỏi giao diện và log build. Không thêm các giá trị thật vào workflow GitHub. CI của pull request chạy build local, không cần hai biến này.

Đặt secret runtime `API_TOKEN` trên Worker một lần. Sau đó, mỗi push lên production branch sẽ chạy build, áp dụng migration D1 remote và deploy.

Cloudflare Builds và GitHub Actions chạy độc lập. GitHub CI không tự chặn một push trực tiếp lên `main` khỏi deploy; nếu muốn bắt buộc CI đạt trước khi merge, hãy cấu hình branch protection hoặc ruleset cho repository.

Chỉ thêm migration mới theo thứ tự, không sửa migration đã chạy. Migration production cần tương thích với phiên bản Worker đang phục vụ trong thời gian deploy.

## Lệnh phát triển

| Lệnh                        | Chức năng                                                    |
| --------------------------- | ------------------------------------------------------------ |
| `npm run dev`               | Chạy frontend và API local                                   |
| `npm test`                  | Kiểm tra các trường hợp chấp nhận và từ chối cấu hình deploy |
| `npm run typecheck`         | Kiểm tra kiểu dữ liệu cho frontend, Worker và Vite config    |
| `npm run build`             | Typecheck và build vào `dist/`                               |
| `npm run build:production`  | Typecheck và build Worker với ID từ biến deploy riêng        |
| `npm run preview`           | Chạy bản build với Worker/D1 local; cần build trước          |
| `npm run db:migrate:local`  | Áp dụng migration lên D1 local                               |
| `npm run db:migrate:remote` | Áp dụng migration lên D1 remote đã cấu hình                  |
| `npm run deploy`            | Build, migrate remote và deploy                              |
| `npm run deploy:ci`         | Migrate remote và deploy bản đã build                        |

Các script remote đọc đường dẫn cấu hình do Vite tạo từ `.wrangler/deploy/config.json`, kiểm tra ID và truyền rõ `--config` cho cả migration lẫn deploy. Lệnh D1 chạy trực tiếp có thể đọc lại cấu hình mẫu ở thư mục gốc. Sau khi sửa cấu hình nguồn hoặc biến deploy, chạy lại `npm run build:production` trước khi deploy. Không chỉnh trực tiếp file trong `dist/`.

Thêm component shadcn/ui khi cần:

```bash
npx shadcn@latest add dialog
```

Alias `@/` trỏ tới `src/client/`.

## Sử dụng

| Phím tắt         | Thao tác                                               |
| ---------------- | ------------------------------------------------------ |
| `c`              | Mở màn hình thu thập                                   |
| `/`              | Mở tìm kiếm                                            |
| `Ctrl/⌘ + Enter` | Lưu form đang nhập                                     |
| `Space`          | Hiện đáp án khi ôn tập, khi không nhập trong ô văn bản |
| `1–4`            | Chấm mức độ ghi nhớ sau khi hiện đáp án                |

Trong **Cài đặt**, kéo nút bookmarklet lên thanh bookmark của trình duyệt. Khi đọc một trang, bôi đen nội dung rồi bấm bookmarklet để mở màn hình thu thập kèm nguồn.

Cũng trong **Cài đặt**, dùng **Xuất JSON** để sao lưu hoặc **Nhập JSON** để khôi phục. Nhập JSON sẽ thay thế dữ liệu hiện tại sau khi xác nhận.

## Cấu hình ứng dụng

Các biến sau nằm trong `wrangler.jsonc` → `vars`:

| Biến              | Mặc định | Ý nghĩa                                  |
| ----------------- | -------- | ---------------------------------------- |
| `INBOX_LIMIT`     | `20`     | Ngưỡng hiển thị cảnh báo Inbox đầy       |
| `TZ_OFFSET_HOURS` | `7`      | Độ lệch UTC để tính ngày cho lịch ôn tập |

## Thông tin riêng và secret

- `.env.local` chứa ID phục vụ deploy; `.dev.vars` chứa secret runtime local. Cả hai đều bị Git bỏ qua.
- Trong production, đặt `API_TOKEN` bằng Cloudflare Secrets. Token dùng để tự động deploy, nếu có, phải nằm trong secret của CI/CD.
- Không đặt credential trong biến bắt đầu bằng `VITE_`: các biến này có thể được đưa vào frontend.
- Không commit hay chia sẻ thư mục `dist/` và `.wrangler/`; chúng có thể chứa cấu hình riêng, dữ liệu local và bản sao `.dev.vars` dùng cho preview.
- Account ID và Database ID không cấp quyền truy cập tài nguyên. Nếu credential thật bị lộ, cần thu hồi hoặc đổi credential; chỉ xóa khỏi file mới nhất không xóa được lịch sử Git.

## Cấu trúc source

```text
.github/workflows/ci.yml   Workflow kiểm tra trên GitHub
index.html                 HTML entry của Vite
src/client/app.tsx         Đăng nhập, điều hướng và layout ứng dụng
src/client/pages/          Các màn hình của pipeline
src/client/components/ui/  Component shadcn/ui
src/client/lib/            API client, React hooks, kiểu dữ liệu và bản dịch
src/client/styles.css      Theme và layout
src/index.ts               Worker API tại /api/*
migrations/                Migration D1
vite.config.ts             React, Tailwind và Cloudflare plugins
wrangler.jsonc             Cấu hình Worker, bindings và biến môi trường
```

## API

Các endpoint `/api/*` yêu cầu header:

```http
Authorization: Bearer <API_TOKEN>
```

| Nhóm      | Endpoint                                                                                |
| --------- | --------------------------------------------------------------------------------------- |
| Ghi chú   | `GET/POST /api/notes`, `GET/PATCH/DELETE /api/notes/:id`                                |
| Liên kết  | `POST /api/notes/:id/links`, `GET /api/notes/:id/suggest`, `DELETE /api/links/:id`      |
| Ôn tập    | `GET /api/review`, `POST /api/notes/:id/review`                                         |
| Ý tưởng   | `GET /api/spark`, `POST /api/sparks`                                                    |
| Output    | `GET/POST /api/outputs`, `PATCH/DELETE /api/outputs/:id`, `POST /api/outputs/:id/notes` |
| Tổng quan | `GET /api/stats`, `GET /api/tags`                                                       |
| Sao lưu   | `GET /api/export`, `POST /api/import`                                                   |

Script hoặc công cụ bên ngoài có thể dùng API này để tự động thêm ghi chú vào bản deploy của bạn.

## Hướng phát triển

Các tính năng sau chưa được triển khai:

- Gợi ý tóm tắt và tag bằng Workers AI.
- Tìm kiếm và gợi ý liên kết theo ngữ nghĩa bằng Vectorize.
- Graph view, Maps of Content và nhập Kindle highlights/RSS.
