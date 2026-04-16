# Mô Tả Logic Cá Nhân Hóa Nhắc Học Email

Ngày cập nhật: 2026-04-16

Tài liệu này mô tả logic vận hành theo góc nhìn sản phẩm, không đi vào chi tiết mã nguồn.

## 1. Mục tiêu của cơ chế nhắc học

- Tăng khả năng người học quay lại đúng lúc.
- Giảm nhiễu, tránh gửi email khi không cần thiết.
- Cá nhân hóa theo nhịp học thật của từng người.

## 2. Dữ liệu hệ thống dùng để ra quyết định

Hệ thống dựa trên 4 nhóm tín hiệu chính:

- Cấu hình người dùng: bật hoặc tắt email, giờ nhắc, ngày nhắc trong tuần.
- Trạng thái học tập hiện tại: đã check-in hôm nay chưa, streak, tiến độ mục tiêu tuần.
- Dấu hiệu hành vi gần đây: vừa học gần đây hay đang giảm nhịp học.
- Lịch sử nhắc học: đã gửi trong ngày chưa, đã gửi bao nhiêu lần trong tuần.

## 2.1. Thông số mặc định đang chạy

Các thông số hiện tại của hệ thống (mặc định):

- Múi giờ mặc định: Asia/Ho_Chi_Minh.
- Giờ nhắc học mặc định: 20:00 (giờ địa phương của người học).
- Ngày nhắc mặc định: tất cả các ngày trong tuần (Thứ 2 đến Chủ Nhật).
- Tần suất tối đa theo ngày: tối đa 1 email mỗi ngày cho mỗi người học.
- Cửa sổ suppression hoạt động gần: 120 phút.
: Nếu người học vừa có hoạt động học trong 120 phút gần nhất thì hệ thống bỏ qua email.
- Tần suất tối đa theo tuần theo phân khúc:
: Active: 3 email/tuần.
: At-risk: 5 email/tuần.
: Returning: 5 email/tuần.
: Deep-focus: 2 email/tuần.
- Retry gửi email khi lỗi tạm thời: tối đa 2 lần.
- Lịch chạy scheduler: chạy mỗi giờ vào phút 00.

Lưu ý:

- Người dùng có thể đổi giờ nhắc và chọn ngày nhắc cụ thể trong phần Tiến độ học tập.
- Nút gửi email thủ công hiện vẫn đi theo policy ở trên, không gửi bất chấp điều kiện.

## 3. Luồng quyết định gửi email

Hệ thống xử lý theo thứ tự từ trên xuống dưới. Chỉ cần vướng 1 điều kiện là sẽ không gửi.

1. Kiểm tra người dùng có bật kênh email không.
2. Kiểm tra hôm nay có nằm trong các ngày được phép nhắc hay không.
3. Kiểm tra người dùng đã check-in trong ngày chưa.
4. Kiểm tra hôm nay đã gửi email nhắc học chưa.
5. Kiểm tra đã đến giờ nhắc học hiệu lực chưa.
: Giờ hiệu lực có thể điều chỉnh nhẹ theo hành vi học gần đây, nhưng không sớm hơn giờ người dùng đã chọn.
6. Kiểm tra suppression theo hoạt động gần.
: Nếu người dùng vừa học gần đây, hệ thống sẽ bỏ qua email để tránh làm phiền.
7. Kiểm tra giới hạn tuần theo phân khúc người dùng.
: Nếu đã chạm trần số email/tuần của phân khúc, hệ thống dừng gửi.
8. Nếu qua hết các bước trên thì mới gửi email.

## 3.1. Ví dụ vận hành thực tế

Ví dụ 1: Người học để lịch Thứ 2, 4, 6 lúc 20:00

- Hôm nay là Thứ 3, dù đã quá 20:00 thì hệ thống vẫn không gửi.
- Lý do: hôm nay không nằm trong ngày nhắc đã chọn.

Ví dụ 2: Đúng ngày nhắc và đúng giờ, nhưng vừa học xong 30 phút trước

- Hệ thống không gửi email.
- Lý do: rơi vào suppression 120 phút để tránh gây nhiễu.

Ví dụ 3: Người học thuộc nhóm Active, tuần này đã nhận 3 email

- Dù đúng ngày và đúng giờ, hệ thống vẫn không gửi email thứ 4 trong tuần.
- Lý do: đã chạm trần 3 email/tuần của nhóm Active.

Ví dụ 4: Người học đã check-in trong ngày

- Hệ thống không gửi email trong ngày đó.
- Lý do: không cần nhắc nữa vì mục tiêu duy trì streak trong ngày đã đạt.

Ví dụ 5: Người học bấm gửi thủ công từ giao diện

- Hệ thống vẫn kiểm tra đúng ngày, đúng giờ, suppression, giới hạn tuần.
- Nếu không đạt điều kiện, hệ thống trả về lý do không gửi để người học hiểu.

## 4. Cách phân khúc người học và tần suất nhắc

Hệ thống phân nhóm để đặt tần suất phù hợp thay vì dùng chung một ngưỡng:

- Active: đang học đều, tần suất nhắc thấp hơn.
- At-risk: có dấu hiệu giảm nhịp, nhắc nhiều hơn nhưng vẫn có trần tuần.
- Returning: vừa quay lại sau gián đoạn, dùng thông điệp kéo lại nhịp học.
- Deep-focus: thiên về nhắc nhẹ, hạn chế gây nhiễu.

Ý nghĩa của cách làm này:

- Người học ổn định không bị spam.
- Người có nguy cơ rời nhịp vẫn được hỗ trợ đúng mức.

## 5. Logic cá nhân hóa nội dung email

Nội dung email không dùng một mẫu cố định cho mọi người.

- Tiêu đề thay đổi theo bối cảnh học tập hiện tại.
- Nội dung luôn có hành động chính rõ ràng.
- Với nhóm cần kéo lại nhịp (at-risk, returning), có thêm hành động phụ.
- Gợi ý trong email bám theo tiến độ tuần và next action.
- Mẫu email được xoay vòng có kiểm soát để hạn chế lặp lại liên tiếp.

## 6. Cơ chế chống gửi trùng và chống nhiễu

Hệ thống áp dụng đồng thời nhiều lớp an toàn:

- Chống gửi trùng theo ngày cho từng người học.
- Giới hạn số email theo tuần theo từng phân khúc.
- Bỏ qua gửi nếu vừa có hoạt động học gần đây.
- Bỏ qua gửi nếu không nằm trong ngày nhắc đã chọn.

Khi bị bỏ qua, hệ thống có ghi lại lý do để theo dõi và tối ưu sau này.

## 7. Gửi thủ công từ giao diện hoạt động ra sao

Nút Gửi email nhắc học trong giao diện hiện đã đi theo cùng policy như gửi tự động.

Điều đó có nghĩa là:

- Không còn gửi "bất chấp điều kiện".
- Nếu chưa đến giờ, đã học rồi, không đúng ngày nhắc, hoặc chạm trần tuần thì hệ thống sẽ thông báo lý do không gửi.

## 8. Cách xử lý lỗi gửi email

- Lỗi tạm thời (mạng hoặc máy chủ mail chập chờn): thử lại theo số lần giới hạn.
- Lỗi cứng (không thể gửi): dừng retry và ghi nhận lỗi để theo dõi.

Mục tiêu là tăng độ ổn định nhưng không tạo vòng lặp gửi vô hạn.

## 9. Những gì người dùng có thể tự điều chỉnh

Trong phần Tiến độ học tập, người dùng có thể:

- Bật hoặc tắt nhắc học qua email.
- Chọn giờ nhắc.
- Chọn ngày nhắc trong tuần.

Nhờ đó, nhắc học đi sát thói quen cá nhân thay vì áp chung cho tất cả.

## 10. Hạn chế hiện tại và hướng nâng cấp

Hạn chế hiện tại:

- Chưa có theo dõi đầy đủ mở email hoặc click theo chuẩn nhà cung cấp email.
- Cơ chế điều chỉnh giờ theo hành vi mới ở mức heuristic, cần thêm dữ liệu thực tế để tối ưu sâu.

Hướng nâng cấp ưu tiên:

- Bổ sung đo lường funnel đầy đủ: gửi, nhận, mở, click, quay lại học.
- Mở rộng thử nghiệm A/B cho tiêu đề và kiểu CTA.
- Tối ưu thêm ngưỡng suppression và tần suất theo phản hồi thực tế.
