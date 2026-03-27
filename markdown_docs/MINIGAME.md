# Minigame Shooting Update (2026-03-28)

## Muc tieu
- Thay minigame thu 3 (scenario/nhap vai bi loi) bang minigame "Ban ga".
- Dam bao game choi duoc, tinh diem dung logic, va UI/UX dung yeu cau.

## Backend da cap nhat
- Thay `scenario_branching` -> `shooting_quiz` trong luong generate minigame.
- Cap nhat schema request minigame de nhan `shooting_quiz`.
- Them generator JSON theo schema shooting quiz:
  - 10 cau hoi (10 round)
  - moi cau 4 dap an A/B/C/D
  - chi 1 dap an dung
- Them validate output:
  - dung 10 cau
  - moi cau dung 4 dap an
  - moi cau dung 1 dap an dung
- Cap nhat cham diem game service cho `shooting_quiz`:
  - +10 diem cho dap an dung
  - sai khong tru diem
  - tra feedback, skills, improvement tips

## Frontend da cap nhat
- Trang minigame:
  - bo lua chon game nhap vai
  - thay bang lua chon "Ban ga on tap"
- Them player moi: `ShootingQuizPlayer`.
- Gameplay:
  - Start / In-game / End screen day du
  - ga xuat hien tu tren va di chuyen trong arena
  - pause/continue
  - timer moi round
  - timeout:
    - neu chua phai cau cuoi: tam dung, doi user bam tiep tuc cau sau
    - neu la cau cuoi: ket thuc game va hien ket qua
- Shooting mechanics:
  - su dung vector huong chuan hoa (dx, dy, vx, vy)
  - dan bay theo frame update
  - bo line target cu
  - them aim arrow xoay theo chuot
- Hinh nguoi choi:
  - dung anh `frontend/public/nanananaa.png`
- UI:
  - dap an doi sang card hinh chu nhat
  - bo icon con ga trong card
  - mo rong khung choi cho rong hon

## Canh tam diem ban (cho phep tu chinh)
Trong `frontend/components/minigame/ShootingQuizPlayer.tsx`:
- `PLAYER_ANCHOR_X_OFFSET`
- `PLAYER_ANCHOR_Y_OFFSET`

Huong dan nhanh:
- Lech trai/phai: chinh `PLAYER_ANCHOR_X_OFFSET`
- Lech tren/duoi: chinh `PLAYER_ANCHOR_Y_OFFSET`

## Kiem tra
- Frontend `npm run build` da pass sau cac thay doi.
- Khong con compile error chan chay app.
