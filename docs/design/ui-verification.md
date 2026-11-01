# Kiểm chứng UI — 2026-11-01

Phạm vi: đổi giao diện và gamification nhẹ theo phản hồi trực tiếp của người dùng; chưa có xác nhận duyệt cảm quan cho bản cuối.

| Before                                                             | After                                                               | Why                                          |
| ------------------------------------------------------------------ | ------------------------------------------------------------------- | -------------------------------------------- |
| Mobile có topbar/menu và bottom navigation                         | Một bottom navigation; ghi lại/cài đặt nằm cạnh tiêu đề             | Bỏ điều hướng lặp, giữ hành động thường dùng |
| Icon nét mảnh với màu rời rạc                                      | Năm icon SVG đặc vẽ riêng cùng kích thước, active state rõ          | Hình khối dễ nhận biết ở kích thước nhỏ      |
| Nền/header xanh lớn, typography tròn đậm                           | Nền trắng ngà, surface trắng, font hệ thống; xanh tập trung ở CTA   | Giảm độ nặng, cải thiện thứ bậc              |
| “Outputs”, “note”, “Ship ratio”, “next action” trong UI tiếng Việt | “Sản phẩm”, “ghi chú”, “tỷ lệ hoàn thành”, “việc tiếp theo”         | Nhãn ngắn, dễ hiểu, đồng bộ ngôn ngữ         |
| `transition-all`, focus ring màu nhạt, autofocus mobile            | Transition transform cụ thể, focus-visible tương phản, bỏ autofocus | Phản hồi gọn và hỗ trợ bàn phím              |

## Kết quả

- `npm run build`: typecheck và build thành công.
- `npm test`: 12/12 test cấu hình deploy hiện có thành công; đây không phải test UI.
- `git diff --check`: đạt.
- Browser: desktop/mobile, sáng/tối, VI/EN; không tràn ngang ở viewport mobile kiểm tra.
- Mobile trang chính: chỉ một navigation hiển thị; không còn `.topbar` trong DOM.
- Capture: thông tin phụ thu gọn mặc định; URL bookmarklet mở sẵn và điền đúng nguồn; input mobile 16px.
- Dữ liệu mẫu riêng trên localhost: dashboard gợi ý ôn khi còn 2 ghi chú đến hạn; lần chấm đầu trả 503, progress giữ 0/2; thử lại thành công lên 1/2; chấm bài thứ hai lên 2/2 và hiện màn hoàn thành.
- Dữ liệu mẫu chạy với static build và backend mô phỏng trong /tmp; không ghi dữ liệu test vào database của ứng dụng.

## Giới hạn

Chưa kiểm tra trên điện thoại vật lý. Hành vi API thực/đồng bộ nhiều thiết bị không thuộc thay đổi này. Khả năng đọc và độ đẹp của bản cuối vẫn cần người dùng duyệt trực tiếp.
