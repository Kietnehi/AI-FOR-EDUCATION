# Cập Nhật Minigame Bắn Gà (2026-03-28)

## Mục tiêu
- Thay minigame thứ 3 (nhập vai đang lỗi) bằng minigame "Bắn gà".
- Đảm bảo game chạy ổn định, chấm điểm đúng và trải nghiệm người dùng tốt.

## Backend đã cập nhật
- Đổi loại game `scenario_branching` thành `shooting_quiz` trong luồng tạo minigame.
- Cập nhật schema request để nhận `shooting_quiz`.
- Thêm generator JSON theo đúng schema shooting quiz:
  - 10 câu hỏi (10 round)
  - Mỗi câu có 4 đáp án A/B/C/D
  - Chỉ 1 đáp án đúng
- Thêm validate đầu ra:
  - Đủ đúng 10 câu
  - Mỗi câu đúng 4 đáp án
  - Mỗi câu đúng 1 đáp án đúng
- Cập nhật chấm điểm cho `shooting_quiz`:
  - Đúng: +10 điểm
  - Sai: không trừ điểm
  - Có feedback, skills và improvement tips

## Frontend đã cập nhật
- Trang minigame:
  - Bỏ game nhập vai
  - Thêm lựa chọn "Bắn gà ôn tập"
- Thêm player mới: `ShootingQuizPlayer`.
- Luồng chơi:
  - Start / In-game / End đầy đủ
  - Đáp án di chuyển trong arena
  - Có tạm dừng / tiếp tục
  - Có timer mỗi round
  - Hết giờ:
    - Nếu chưa phải câu cuối: tạm dừng, chờ người dùng bấm tiếp tục câu sau
    - Nếu là câu cuối: kết thúc game và hiện kết quả
- Cơ chế bắn:
  - Dùng vector chuẩn hóa (dx, dy, vx, vy)
  - Đạn bay theo cập nhật từng frame
  - Bỏ line target cũ
  - Thêm aim arrow xoay theo chuột
- Hình người chơi:
  - Dùng ảnh `frontend/public/nanananaa.png`
- UI:
  - Đáp án dạng thẻ chữ nhật
  - Bỏ icon con gà trong thẻ
  - Mở rộng khung chơi để thoáng hơn

## Căn chỉnh tâm điểm bắn (có thể tự chỉnh)
Trong `frontend/components/minigame/ShootingQuizPlayer.tsx`:
- `PLAYER_ANCHOR_X_OFFSET`
- `PLAYER_ANCHOR_Y_OFFSET`

Gợi ý chỉnh nhanh:
- Lệch trái/phải: chỉnh `PLAYER_ANCHOR_X_OFFSET`
- Lệch trên/dưới: chỉnh `PLAYER_ANCHOR_Y_OFFSET`

## Kiểm tra
- Frontend `npm run build` đã chạy thành công sau các thay đổi.
- Không còn lỗi compile chặn ứng dụng chạy.
