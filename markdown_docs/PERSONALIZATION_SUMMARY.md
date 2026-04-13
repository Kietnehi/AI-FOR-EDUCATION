# Tóm tắt đầy đủ tính năng cá nhân hóa

## 1. Mục tiêu
Tài liệu này tổng hợp phần cá nhân hóa đã triển khai cho toàn hệ thống học tập, không chỉ giới hạn ở minigame. Trọng tâm là:
- Cá nhân hóa theo tài khoản người dùng sau khi đăng nhập.
- Gợi ý nội dung học tiếp theo dựa trên hành vi thực tế.
- Đồng bộ tùy chọn học tập giữa nhiều phiên và nhiều thiết bị.
- Đảm bảo thu thập dữ liệu có kiểm soát (sanitization, retention, TTL).

## 2. Phạm vi đã triển khai
### Backend
- API quản lý sở thích học tập theo tài khoản.
- API tổng hợp cá nhân hóa cho Dashboard.
- Ghi nhận sự kiện tương tác từ nhiều bề mặt học tập.
- Cơ chế xếp hạng recommendation dựa trên nhiều tín hiệu.

### Frontend
- Hiển thị các khối cá nhân hóa trên trang Dashboard.
- Cho phép chỉnh sửa tùy chọn cá nhân trong trang Settings.
- Đồng bộ mascot preference trong App Shell.

## 3. Kiến trúc tổng quan
Luồng chính:
1. Người dùng tương tác với các tính năng (materials, chat, generation, web-search, converter, games).
2. Backend ghi nhận analytics events theo user.
3. Dịch vụ cá nhân hóa tổng hợp dữ liệu hành vi + preferences.
4. Frontend gọi API dashboard personalization để render các khối gợi ý.

Các thành phần chính:
- Service: xử lý logic cá nhân hóa, tính điểm và gom tín hiệu.
- Repository: thao tác dữ liệu preferences và analytics events.
- Route: cung cấp endpoint cho frontend.
- Frontend API client + type contracts: chuẩn hóa giao tiếp và dữ liệu hiển thị.

## 4. API cá nhân hóa
Các endpoint chính:
- GET /personalization/preferences
  - Lấy tùy chọn cá nhân hiện tại của user.
- PUT /personalization/preferences
  - Cập nhật tùy chọn học tập theo tài khoản.
- GET /personalization/dashboard
  - Lấy dữ liệu tổng hợp để render Dashboard cá nhân hóa.

Nhóm dữ liệu cốt lõi:
- User preferences: preferred_language, learning_pace, study_goal, mascot_enabled.
- Dashboard personalization: continue learning, suggested next actions, study rhythm, feature affinity, recommendation score.

## 5. Cá nhân hóa thể hiện trên frontend
### Dashboard
Các khối chính:
- Continue Learning: đề xuất học tiếp theo theo lịch sử gần đây và mức độ phù hợp.
- Suggested Next Actions: gợi ý hành động cụ thể để tiếp tục tiến trình học.
- Study Rhythm: phản ánh nhịp học như số ngày không hoạt động và tính năng dùng nhiều.
- Feature Affinity: thể hiện mức độ gắn bó với từng nhóm tính năng.

### Settings
Người dùng có thể chỉnh:
- Ngôn ngữ ưu tiên.
- Tốc độ học.
- Mục tiêu học tập.
- Bật/tắt mascot.

Đặc điểm quan trọng:
- Ưu tiên lưu theo tài khoản qua API.
- Có fallback localStorage để tránh gián đoạn trải nghiệm khi API chưa sẵn sàng.

### App Shell
- Đồng bộ mascot preference giữa giao diện hiện tại và dữ liệu tài khoản.
- Giúp trải nghiệm nhất quán xuyên suốt toàn app.

## 6. Cơ chế recommendation (tóm tắt)
Điểm recommendation được tổng hợp từ nhiều tín hiệu:
- Recency: hoạt động gần đây được ưu tiên.
- Engagement: mức độ tương tác với từng nội dung/tính năng.
- Performance trend: xu hướng kết quả học tập.
- Goal matching: độ phù hợp với study goal người dùng đặt.
- Learning pace alignment: mức phù hợp với nhịp học mong muốn.

Kết quả:
- Gợi ý có ngữ cảnh hơn so với cách đề xuất đơn giản chỉ dựa vào một sự kiện gần nhất.

## 7. Dữ liệu, riêng tư và vòng đời
### Thu thập dữ liệu
Sự kiện được ghi nhận từ nhiều route nghiệp vụ để phản ánh hành vi học thực tế.

### Kiểm soát dữ liệu
- Metadata được sanitize trước khi lưu.
- Giới hạn dữ liệu nhạy cảm hoặc không cần thiết.

### Retention và TTL
- Analytics events có thời hạn lưu trữ.
- Dùng chỉ mục TTL để tự động dọn dữ liệu hết hạn.

## 8. Kiểm thử và xác thực
Đã thực hiện:
- Bổ sung test backend cho service cá nhân hóa.
- Bổ sung test backend cho bài toán tổng hợp dashboard.
- Cập nhật test frontend cho API integration và app-shell integration.
- Kiểm tra compile cho các file backend liên quan.

Lưu ý môi trường:
- Chạy toàn bộ backend pytest cần môi trường có sẵn pytest và dependencies kiểm thử.

## 9. Giá trị mang lại
- Nâng mức cá nhân hóa từ minigame lên toàn nền tảng.
- Tăng khả năng giữ chân người học qua gợi ý học tiếp có ý nghĩa.
- Tạo nền tảng để mở rộng recommendation theo cohort hoặc chiến lược sản phẩm sau này.

## 10. Hướng mở rộng đề xuất
1. Thêm feature flag để rollout cá nhân hóa theo nhóm người dùng.
2. Bổ sung dashboard theo dõi KPI retention theo cohort.
3. Tăng độ sâu test end-to-end cho toàn bộ hành trình cá nhân hóa.