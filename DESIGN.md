# Idea Forge — Duolingo nhẹ, Apple clarity

## Định hướng

Giao diện thân thiện giúp người dùng biến ý tưởng thành hành động qua Capture → Distill → Connect → Spark → Ship. Hướng được chọn: lấy cảm giác vui tươi, nút có chiều sâu và màu xanh từ bản tham khảo Duolingo; áp dụng bố cục rõ ràng, thao tác quen thuộc, phản hồi trực tiếp và tiết lộ thông tin dần theo tinh thần Apple.

## Nguồn và độ tin cậy

- [Bản phân tích Duolingo gốc](docs/design/duolingo-reference.md): chỉ #00b086 là token được đo trong nguồn. Font, spacing, radius và shadow là ước lượng.
- Các token trong triển khai là quyết định của Idea Forge, không phải bản sao pixel-perfect hay thông số chính thức của Duolingo/Apple.
- Nguồn chính sau phản hồi người dùng: [Duolingo core tabs redesign](https://blog.duolingo.com/core-tabs-redesign/). Bản phân tích landing chỉ là nguồn phụ.
- Dùng font hệ thống cho cả nội dung và heading, ưu tiên khả năng đọc tiếng Việt. Heading 700, body 400; không tải font ngoài. Không dùng mascot hoặc tài sản thương hiệu Duolingo.

## Lựa chọn

1. **Duolingo nhẹ + Apple (được chọn):** nội dung là trọng tâm, xanh làm điểm nhấn, bo góc có thứ bậc, một hành động chính rõ ràng. Phù hợp công cụ tri thức dùng hàng ngày.
2. Duolingo đậm: nhiều màu và hành trình dạng game; giảm mật độ thông tin và đòi hỏi hệ thống phần thưởng lớn hơn.

## Quy tắc giao diện

- Nền trắng ngà #fafbf8 và surface trắng mặc định; dark mode xanh xám #131f24, vẫn giữ lựa chọn đã lưu. Xanh sáng #58cc02 và chữ #204200 cho CTA; link dùng #387900. Đây là token Idea Forge chọn theo hướng tham khảo in-app, không phải đo từ bài viết.
- Mobile chỉ có một thanh điều hướng chính gồm 5 tab cố định, icon SVG đặc được vẽ riêng và nhãn; active state có nền. Bỏ topbar/hamburger. Nút ghi lại và cài đặt nằm cạnh tiêu đề trang; desktop giữ sidebar. Inbox/Review và Library/Timeline có điều hướng phụ.
- Cards 16px, controls 12px, buttons 14px; nhịp 8px. Chỉ nút primary có cạnh dưới tạo cảm giác nhấn.
- Heading đậm, nội dung dễ đọc; không giảm chữ ở mobile input xuống dưới 16px. Điều khiển thông thường tối thiểu 44px.
- Sidebar biểu tượng + nhãn; active state có viền và nền. Mobile không có sidebar/menu; chuyển tab trực tiếp, giữ focus-visible cho toàn bộ điều khiển.
- Form thu thập ưu tiên nội dung; nguồn/tag/ngày nằm trong vùng thông tin bổ sung có thể mở. Tự mở khi có nguồn bookmarklet.
- Hỗ trợ keyboard, focus-visible, reduced motion, nhãn progress và thông báo screen reader.

## Gamification nhẹ

- Dashboard có một gợi ý tiếp theo từ số liệu thật: xử lý Inbox đầy → ôn đến hạn → chắt lọc Inbox → hành động tiếp theo → thu thập.
- Năm bước luôn truy cập tự do. Các chỉ số giữ nguyên kỳ thống kê và nhãn, không giả thành tiến độ hoàn thành tuyến tính.
- Ôn tập hiển thị số đã hoàn thành trong phiên và thanh tiến độ; chỉ tăng sau API thành công. Khi có bài mới đến trong phiên, tổng số cập nhật theo dữ liệu thực.
- Hoàn thành ôn tập có lời động viên và đường dẫn tiếp tục. Lưu ý tưởng có phản hồi thành công hiện có.
- Không thêm XP, streak, leaderboard hay phạt mất chuỗi. Không đổi schema, lịch ôn hoặc API.

## Kiểm chứng

Typecheck/build và test hiện có; xem desktop/mobile, sáng/tối, rỗng/có dữ liệu, form bookmarklet, bàn phím và ôn tập. Kiểm chứng tự động không thay thế duyệt cảm quan của người dùng.
