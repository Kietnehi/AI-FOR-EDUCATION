# Checklist Nhắc Học (Dạng Multiple Choice)

Mục tiêu: tăng tỷ lệ quay lại học, giảm nhiễu thông báo, tối ưu trải nghiệm nhắc học theo hành vi người dùng.

Hướng dẫn dùng nhanh:
- Tick vào phương án bạn muốn chọn ở mỗi câu.
- Có thể chọn nhiều phương án nếu muốn chạy mô hình hybrid.
- Dòng Ghi chú dùng để chốt quyết định cuối cùng.

## 1) Luật Sản Phẩm

### Câu 1. Chế độ nhắc học mặc định
- [ ] A. Nhẹ: ưu tiên in-app, email rất hạn chế.
- [x] B. Cân bằng: in-app + email theo lịch chuẩn (ủa cái này có cho user chọn in-app hay email rồi mà nhỉ)
- [x] C. Phục hồi: tăng nhắc khi người học có dấu hiệu rơi nhịp.

### Câu 2. Khung giờ nhắc học
- [ ] A. Cố định theo giờ địa phương người dùng.
- [x] B. Cho người dùng tự chọn giờ + ngày trong tuần (trong phần tiến độ tôi thấy có user tự gửi email nhắc học cho chính mình thì chỗ này đang hơi vô lí, bạn kiểm tra lại nhé).
- [x] C. Tự điều chỉnh theo hành vi học gần nhất.

### Câu 3. Luật suppression (giảm nhiễu)
- [ ] A. Bỏ email nếu người dùng đã học trong 2 giờ gần nhất.
- [x] B. Bỏ email nếu người dùng đã check-in hôm nay.
- [ ] C. Bỏ email nếu đã mở app trong vòng 60 phút.

### Câu 4. Tần suất nhắc học
- [ ] A. Tối đa 1 email/ngày, 3 email/tuần.
- [ ] B. Tối đa 1 email/ngày, 5 email/tuần.
- [ x] C. Theo phân khúc người dùng (active thấp, at-risk cao hơn).

### Ghi chú quyết định
- [ ] Đã chốt luật sản phẩm
- [ x] Cần thử nghiệm thêm

## 2) Phân Khúc Người Dùng

### Câu 1. Cách phân nhóm
- [ x] A. Active: đang học đều.
- [ x] B. At-risk: giảm hoạt động so với tuần trước.
- [ x] C. Returning: mới quay lại sau thời gian gián đoạn.
- [ x] D. Deep-focus: muốn ít thông báo, ưu tiên nhắc theo tuần.

### Câu 2. Mức nhắc theo phân khúc
- [ x] A. Active: nhắc nhẹ, ưu tiên in-app.
- [ x] B. At-risk: nhắc rõ mục tiêu nhỏ, có CTA cụ thể.
- [ x] C. Returning: nhắc theo chuỗi onboarding lại 3-5 ngày.

### Ghi chú quyết định
- [x ] Đã chốt tiêu chí phân khúc
- [ ] Cần dữ liệu thật để chốt

## 3) Chất Lượng Nội Dung Email

### Câu 1. Cấu trúc email
- [ ] A. Mỗi email chỉ có 1 CTA chính.
- [ x] B. Có 2 CTA (chính + phụ) cho người dùng at-risk.
- [ x] C. CTA động theo trạng thái tiến độ tuần.

### Câu 2. Tiêu đề email
- [ ] A. Ngắn, rõ, trung tính.
- [ x] B. Cá nhân hóa theo streak/mục tiêu.
- [ ] C. Nhấn mạnh hành động ngay (ví dụ: Học 10 phút hôm nay).

### Câu 3. Chống lặp nội dung
- [ ] A. Không lặp cùng template quá 2 lần liên tiếp.
- [ ] B. Luân phiên theo 3 nhóm: duy trì, phục hồi, chúc mừng.
- [ x] C. Random có kiểm soát theo lịch sử gần nhất.

### Ghi chú quyết định
- [ x] Đã chốt format nội dung
- [ ] Cần review thêm giọng điệu

## 4) Scheduling và An Toàn Backend

### Câu 1. Kiến trúc scheduler
- [ x] A. Celery beat tách riêng service.
- [ ] B. Beat + worker chung 1 process (không khuyến nghị production).

### Câu 2. Chống gửi trùng
- [ ] A. Redis distributed lock theo user + local date.
- [ ] B. Chỉ dựa vào trường sent_today trong DB.
- [ ] C. Kết hợp lock + sent_today để an toàn tối đa.

### Câu 3. Retry và lỗi SMTP
- [ ] A. Lỗi tạm thời: retry với backoff.
- [ ] B. Lỗi cứng: không retry, ghi nhận fail reason.
- [ ] C. Đưa sang dead-letter queue nếu lỗi lặp lại.

### Ghi chú quyết định
- [ ] Đã chốt kiến trúc backend
- [ ] Cần benchmark thêm

## 5) Tracking và Metrics

### Câu 1. Bộ chỉ số bắt buộc
- [ ] A. Sent, skipped, failed.
- [ ] B. Delivered, opened, clicked.
- [ ] C. Reminder-to-checkin conversion trong 24 giờ.

### Câu 2. Báo cáo
- [ ] A. Theo timezone.
- [ ] B. Theo phân khúc.
- [ ] C. Theo chiến dịch/template.

### Câu 3. Cảnh báo vận hành
- [ ] A. Cảnh báo khi fail rate tăng đột biến.
- [ ] B. Cảnh báo khi volume gửi vượt ngưỡng.
- [ ] C. Cảnh báo khi lock contention cao.

### Ghi chú quyết định
- [ ] Đã chốt dashboard metrics
- [ ] Cần bổ sung trường dữ liệu

## 6) Kế Hoạch Thử Nghiệm

### Câu 1. A/B test thời điểm gửi
- [ ] A. Đúng giờ nhắc vs trễ +60 phút.
- [ ] B. Đúng giờ nhắc vs +30 phút.
- [ ] C. Theo hành vi cá nhân hóa.

### Câu 2. A/B test nội dung
- [ ] A. Action-focused (làm ngay).
- [ ] B. Progress-focused (tiến độ hiện tại).
- [ ] C. Hybrid theo phân khúc.

### Câu 3. A/B test tần suất
- [ ] A. 3 lần/tuần.
- [ ] B. 5 lần/tuần.
- [ ] C. 7 lần/tuần (chỉ cho nhóm at-risk).

### Ghi chú quyết định
- [ ] Đã chốt design thí nghiệm
- [ ] Cần thêm sample size

## 7) UX và Quyền Kiểm Soát Người Dùng

### Câu 1. Tùy chọn cho người dùng
- [ ] A. Cho chọn tần suất nhắc.
- [ ] B. Cho chọn khung giờ yên tĩnh.
- [ ] C. Cho pause nhắc học 7 ngày.

### Câu 2. Minh bạch thông báo
- [ ] A. Có lý do vì sao nhận email này.
- [ ] B. Có link đổi cài đặt nhanh.
- [ ] C. Có one-click unsubscribe cho kênh email.

### Ghi chú quyết định
- [ ] Đã chốt UX control
- [ ] Cần xin ý kiến thêm từ người dùng

## 8) QA và Rollout

### Câu 1. Test bắt buộc
- [ ] A. Test suppression + frequency cap.
- [ ] B. Test timezone boundary (UTC+/-, DST).
- [ ] C. Smoke test dữ liệu giả lập trước production.

### Câu 2. Chiến lược rollout
- [ ] A. 10% -> 30% -> 100%.
- [ ] B. Rollout theo phân khúc trước.
- [ ] C. Rollback ngay khi fail rate vượt ngưỡng.

### Ghi chú quyết định
- [ ] Đã chốt kế hoạch rollout
- [ ] Cần thêm checklist vận hành

## 9) Tiêu Chí Hoàn Thành (Definition of Done)

### Câu 1. Mục tiêu hiệu quả
- [ ] A. Reminder-to-checkin conversion tăng >= 10% so với baseline.
- [ ] B. Retention 7 ngày tăng >= 5%.
- [ ] C. Time-to-return giảm rõ rệt.

### Câu 2. Mục tiêu giảm nhiễu
- [ ] A. Spam complaint < 0.1%.
- [ ] B. Unsubscribe ổn định hoặc giảm.
- [ ] C. Không có duplicate send cùng user trong cùng local date.

### Chốt cuối
- [ ] Đạt điều kiện Go-live
- [ ] Chưa đạt, cần lặp thêm 1 vòng tối ưu
