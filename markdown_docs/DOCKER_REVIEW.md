# Docker Review (Cập nhật 2026-03-30)

## Phạm vi review

Tài liệu này được đối chiếu trực tiếp với trạng thái code hiện tại của project tại ngày 2026-03-30, dựa trên các file sau:

- `docker-compose.yml`
- `docker-compose.ci.yml`
- `backend/Dockerfile`
- `frontend/Dockerfile`
- `frontend/Dockerfile.dev`
- `frontend/scripts/warmup-routes.mjs`
- `frontend/next.config.mjs`
- `backend/app/core/config.py`
- `backend/app/main.py`
- `backend/app/tasks.py`
- `.env.docker.example`
- `.env.example`
- `backend/.env.example`

## Tổng quan

File review cũ ngày 2026-03-27 không còn phản ánh đúng hệ thống Docker hiện tại.

Ở thời điểm hiện tại, stack Docker của project đã mở rộng đáng kể và nghiêng rõ về hướng `dev-first`, bao gồm:

- `redis`
- `redis-commander` / RedisInsight
- `minio`
- `mongo` chạy theo profile tùy chọn `local-db`
- `backend`
- `frontend`
- `celery-worker`
- `celery-flower`

Ngoài ra, một số nhận định trong tài liệu cũ hiện không còn đúng nữa:

- `frontend/Dockerfile.dev` hiện đã chạy lại với `--turbo`
- `frontend/scripts/warmup-routes.mjs` đã được sửa lỗi cú pháp
- `frontend/next.config.mjs` đã cấu hình `output: "standalone"` để khớp với Dockerfile production
- `backend/app/main.py` hiện có logic khởi tạo bucket storage khi startup
- `backend/app/tasks.py` cho thấy Celery worker đã là một phần chính thức của runtime stack

Kết luận ngắn: tài liệu cũ nên được xem là bản review lịch sử; bản này mới là phiên bản khớp với code hiện tại.

## Kiến trúc Docker thực tế

### `docker-compose.yml`

Đây là file compose phục vụ phát triển cục bộ, không phải cấu hình production-safe.

Các đặc điểm chính:

- Backend dùng bind mount `./backend:/app`
- Backend chạy `uvicorn` với `--reload`
- Frontend dùng bind mount `./frontend:/app`
- Frontend chạy bằng `frontend/Dockerfile.dev`
- Frontend bật polling watcher để hỗ trợ hot reload ổn định hơn trên Windows/NTFS
- Frontend có cơ chế warm-up route khi khởi động
- MongoDB local là tùy chọn qua profile `local-db`
- Redis, MinIO, Celery worker và Flower được bật trong compose chính
- `backend` và `celery-worker` cùng dùng `backend/Dockerfile`
- Volume `backend_storage` được mount vào `/app/storage` cho cả backend và worker

Nói cách khác, `docker-compose.yml` hiện là file dành cho môi trường phát triển đầy đủ tính năng.

### `docker-compose.ci.yml`

Đây là file compose tối giản để phục vụ smoke test trong CI.

Các service hiện có:

- `mongo`
- `backend`
- `frontend`

Các thành phần hiện không có trong CI compose:

- `redis`
- `minio`
- `celery-worker`
- `celery-flower`
- `redis-commander`

Điều này cho thấy CI hiện tại chỉ kiểm tra được một phần của hệ thống Docker, chưa phản ánh trọn vẹn topology runtime đang dùng ở local development.

### `backend/Dockerfile`

Dockerfile backend hiện là image single-stage, thiên về tính đơn giản hơn là tối ưu kích thước.

Đặc điểm chính:

- Base image: `python:3.11-slim`
- Cài thêm `build-essential`, `ffmpeg`, `libgl1`, `libglib2.0-0`
- Cài dependencies từ `requirements.txt`
- Tạo user không phải root là `appuser`
- Expose cổng `8000`
- Healthcheck gọi `http://127.0.0.1:8000/health`

Dockerfile này chạy được và khớp với backend hiện tại, nhưng chưa tối ưu cho production image nhỏ gọn.

### `frontend/Dockerfile`

Dockerfile frontend production hiện được tổ chức hợp lý theo nhiều stage:

- `deps`
- `builder`
- `runner`

Điểm tích cực:

- Có build args cho `NEXT_PUBLIC_API_BASE_URL` và `NEXT_PUBLIC_API_HOST`
- Tận dụng `output: "standalone"` của Next.js
- Runtime image gọn hơn image dev

Đây là phần đang khớp tốt với code hiện tại.

### `frontend/Dockerfile.dev`

Dockerfile dev của frontend hiện phục vụ đúng mục tiêu local development:

- `npm ci`
- chạy `npm run dev -- --turbo -H 0.0.0.0 -p 3000`
- nếu `WARMUP_ROUTES_ON_START=1` thì chạy thêm `node scripts/warmup-routes.mjs`

So với tài liệu review cũ, đây là điểm đã thay đổi rõ ràng: `--turbo` hiện đã được bật lại.

### `frontend/scripts/warmup-routes.mjs`

Script warm-up hiện tại hợp lệ về cú pháp và đã sửa lỗi optional chaining từng được nêu trong review trước.

Script này hiện:

- chờ frontend sẵn sàng
- warm-up tuần tự các route tĩnh
- gọi backend để lấy một `material id` đầu tiên
- warm-up thêm route động nếu có dữ liệu

Đây là một cải tiến thực dụng cho trải nghiệm dev, đặc biệt khi dùng Next.js trong Docker.

## Những điểm hiện đã khớp với code

Các nhận định sau trong review cũ không còn đúng và đã được cập nhật:

### 1. Lỗi cú pháp trong warm-up script đã được sửa

Review cũ từng nêu lỗi ở optional chaining trong `frontend/scripts/warmup-routes.mjs`. Hiện tại lỗi đó không còn nữa; script có thể parse bình thường.

### 2. Frontend dev không còn ở trạng thái “đã tắt turbo”

Review cũ nói rằng chế độ `--turbo` đã bị tắt để ưu tiên ổn định. Điều này không còn đúng với code hiện tại vì `frontend/Dockerfile.dev` đang chạy lại với `--turbo`.

### 3. Stack Docker hiện tại đã bao gồm các service nền quan trọng

Review cũ chưa phản ánh đầy đủ:

- Redis
- MinIO
- Celery worker
- Flower
- RedisInsight

Trong khi đây hiện là các thành phần thực sự tồn tại trong `docker-compose.yml`.

### 4. Hệ thống hiện không còn là “Atlas-first” theo cách mô tả cũ

MongoDB local hiện là tùy chọn qua profile `local-db`, nhưng compose chính lại mặc định kéo theo Redis, MinIO và Celery.

Vì vậy, mô tả chính xác hơn là:

- Mongo local: optional
- stack phụ trợ cho async và object storage: mặc định có mặt trong compose chính

## Findings

### 1. Mức cao - `docker-compose.yml` và `docker-compose.ci.yml` chưa forward đầy đủ các biến môi trường mà code hiện tại đã hỗ trợ

`backend/app/core/config.py` đã hỗ trợ nhiều biến môi trường hơn so với những gì `docker-compose.yml` và `docker-compose.ci.yml` đang truyền vào container.

Những biến đáng chú ý hiện đang bị bỏ sót khỏi compose:

- `TAVILY_API_KEY`
- `WEB_SEARCH_REFINEMENT_MODEL`
- `WHISPER_LANGUAGE`
- `NOTEBOOKLM_GENERATE_WAIT_SECONDS`
- `NOTEBOOKLM_HEADLESS`
- `STORAGE_PRESIGNED_EXPIRATION_SECONDS`

Tác động:

- Người dùng có thể cấu hình các biến này trong `.env`, nhưng container không nhận được nếu compose không forward vào môi trường runtime.
- Tài liệu env và code có vẻ như đã hỗ trợ, nhưng hành vi thực tế trong Docker lại không khớp hoàn toàn.
- Các tính năng liên quan đến web search fallback, cấu hình speech, thời gian chờ NotebookLM, chế độ headless và presigned URL expiration có thể chạy khác kỳ vọng.

Đây là mismatch quan trọng nhất giữa code và Docker hiện tại.

### 2. Mức cao - `docker-compose.ci.yml` chưa bao phủ đủ topology runtime thực tế

Compose CI hiện chỉ khởi tạo:

- `mongo`
- `backend`
- `frontend`

Trong khi runtime stack ở local development đang bao gồm thêm:

- `redis`
- `minio`
- `celery-worker`
- `celery-flower`

Tác động:

- CI hiện chưa xác nhận được luồng Redis/Celery
- Các nhánh chức năng bất đồng bộ có thể không được smoke test đúng theo môi trường Docker thực tế
- Logic storage liên quan đến MinIO không được kiểm thử trong cùng topology với compose chính

Lưu ý thêm:

`backend/app/main.py` hiện gọi `storage_service.ensure_bucket_exists()` khi startup. Trong topology CI hiện tại, ứng dụng vẫn có thể lên nếu logic này chỉ warning khi không kết nối được storage, nhưng điều đó cũng đồng nghĩa CI đang có độ phủ thấp hơn kỳ vọng.

### 3. Mức trung bình - `docker-compose.yml` hiện rõ ràng là file dev-first, không nên được hiểu là cấu hình triển khai production

Hiện tại file compose chính có đầy đủ đặc trưng của môi trường dev:

- bind mount source code
- backend chạy `--reload`
- frontend chạy `next dev`
- dùng polling watcher
- route warm-up khi startup

Điều này là hợp lý cho phát triển cục bộ, nhưng không phù hợp nếu ai đó hiểu nhầm đây là cấu hình triển khai production.

Khuyến nghị tài liệu nên ghi rõ:

- `docker-compose.yml` là file dành cho local development
- nếu cần production compose thì nên tách cấu hình riêng

### 4. Mức trung bình - Khối environment giữa `backend` và `celery-worker` đang bị lặp, tạo rủi ro drift cấu hình

Hai service này đang lặp lại một khối environment dài.

Tác động:

- Khi thêm setting mới, rất dễ cập nhật ở `backend` nhưng quên ở `celery-worker`, hoặc ngược lại
- Finding số 1 nhiều khả năng là hệ quả trực tiếp của kiểu cấu hình bị nhân đôi này

Đây là một khoản technical debt ở lớp cấu hình Docker.

### 5. Mức trung bình - `backend/.env.example` đang stale so với settings thực tế và tài liệu Docker ở root

`backend/.env.example` hiện không đồng bộ tốt với:

- `backend/app/core/config.py`
- `.env.docker.example`
- `docker-compose.yml`

Dấu hiệu:

- Nội dung khác với các root env examples
- Thiếu một số biến mới
- Có dấu hiệu lỗi encoding ở comment tiếng Việt
- Một số giá trị mẫu không còn thống nhất với cấu hình hiện hành

Tác động:

- Dễ gây nhầm lẫn nếu ai đó lấy file trong `backend/` làm nguồn cấu hình chính
- Làm giảm độ tin cậy của tài liệu cấu hình

### 6. Mức thấp - Image backend chưa tối ưu kích thước runtime

`backend/Dockerfile` hiện vẫn là single-stage image và giữ lại tool build trong runtime image.

Tác động:

- Image lớn hơn mức cần thiết
- Build và pull chậm hơn so với image production tối ưu

Đây chưa phải blocker cho local development, nhưng nên được cân nhắc nếu sau này tối ưu CI/CD hoặc triển khai production.

## Đánh giá tổng thể

### Những gì đang tốt

- Stack Docker đã phản ánh tốt hơn nhu cầu thực tế của ứng dụng
- Frontend production Dockerfile đang khớp với `output: "standalone"`
- Warm-up script hiện hoạt động đúng về mặt cú pháp và mục tiêu sử dụng
- Redis, MinIO và Celery đã được đưa vào compose chính thay vì chỉ tồn tại ở mức ý tưởng
- `mongo` được đưa về dạng optional qua profile `local-db`, linh hoạt hơn cho người dùng có Atlas hoặc DB từ xa

### Những gì đang lệch

- Docker compose chưa truyền hết các env mà code hiện tại đã hỗ trợ
- CI compose chưa đủ gần với runtime stack thực tế
- Tài liệu env đang bị phân mảnh giữa root và `backend/`
- Review cũ không còn theo kịp các thay đổi của codebase

## Khuyến nghị cập nhật tiếp theo

### Ưu tiên cao

1. Đồng bộ `docker-compose.yml` và `docker-compose.ci.yml` với `backend/app/core/config.py`

Ưu tiên thêm các biến còn thiếu vào `backend` và `celery-worker`, đặc biệt là:

- `TAVILY_API_KEY`
- `WEB_SEARCH_REFINEMENT_MODEL`
- `WHISPER_LANGUAGE`
- `NOTEBOOKLM_GENERATE_WAIT_SECONDS`
- `NOTEBOOKLM_HEADLESS`
- `STORAGE_PRESIGNED_EXPIRATION_SECONDS`

2. Xác định một file env canonical cho Docker

Khuyến nghị:

- dùng root `.env.docker.example` làm nguồn chính
- giảm vai trò hoặc loại bỏ `backend/.env.example` nếu không còn cần thiết

3. Nâng độ phủ Docker CI

Nếu muốn CI phản ánh gần hơn runtime thực tế, nên bổ sung ít nhất:

- `redis`
- `minio`

Hoặc tạo thêm một smoke profile dành cho async/runtime path.

### Ưu tiên trung bình

4. Giảm trùng lặp env giữa `backend` và `celery-worker`

Có thể cân nhắc:

- dùng anchor/extension của Compose
- hoặc tách `env_file`
- hoặc gom các biến dùng chung thành block tái sử dụng

5. Tách rõ cấu hình dev và production

Nếu mục tiêu dài hạn là vừa hỗ trợ dev tốt vừa dễ triển khai, nên cân nhắc:

- `docker-compose.yml` hoặc `docker-compose.dev.yml` cho local development
- `docker-compose.prod.yml` cho môi trường triển khai

## Kết luận

Phiên bản review cũ ngày 2026-03-27 không còn match với code hiện tại.

Phiên bản cập nhật này phản ánh đúng hơn thực trạng của project:

- Docker stack hiện rộng hơn và thiên về `dev-first`
- Một số issue cũ đã được xử lý xong
- Các mismatch còn lại chủ yếu nằm ở lớp cấu hình môi trường và độ phủ của CI compose

Nếu xét theo mức độ ưu tiên, hai vấn đề cần xử lý sớm nhất là:

1. Đồng bộ env giữa code và Docker compose
2. Nâng độ phủ của `docker-compose.ci.yml` để phản ánh đúng runtime stack thực tế hơn
