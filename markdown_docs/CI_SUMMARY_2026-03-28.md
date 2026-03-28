# Tóm tắt CI (2026-03-28)

Tài liệu này tóm tắt đầy đủ phần thiết lập CI đã được triển khai cho repo `AI-FOR-EDUCATION`, bao gồm phạm vi thay đổi, kiến trúc workflow, test stack, coverage, cơ chế báo lỗi và các việc còn lại nên làm tiếp.

## 1. Mục tiêu đã thực hiện

- Mở rộng CI từ chỉ `frontend/` sang chạy cho cả `frontend/` và `backend/`.
- Chuẩn hóa workflow với tên rõ nghĩa hơn: `Project CI`.
- Bổ sung coverage report trong CI cho cả hai khối.
- Thiết lập coverage threshold để chặn regression coverage.
- Bổ sung backend test stack tối thiểu để CI không phải cài toàn bộ dependency AI nặng.
- Viết thêm test backend cho các module quan trọng nhằm đưa coverage lên mức có thể kiểm soát.
- Bổ sung Docker smoke test trong CI để kiểm tra build và khởi động stack bằng `docker compose`.
- Tự động tạo hoặc cập nhật GitHub Issue khi `push` làm CI thất bại.

## 2. Các file chính đã thay đổi

### Workflow CI

- Xóa workflow cũ: `.github/workflows/frontend-tests.yml`
- Tạo workflow mới: `.github/workflows/project-ci.yml`

### Docker / Compose

- `docker-compose.yml`
- `.env.docker.example`
- `frontend/scripts/warmup-routes.mjs`

### Backend test/coverage

- `backend/requirements-test.txt`
- `backend/pytest.ini`
- `backend/tests/conftest.py`
- `backend/tests/unit/test_text_cleaner.py`
- `backend/tests/unit/test_text_chunker.py`
- `backend/tests/unit/test_config_and_utils.py`
- `backend/tests/unit/test_file_service.py`
- `backend/tests/unit/test_material_guardrail_service.py`
- `backend/tests/unit/test_files_routes.py`
- `backend/tests/unit/test_file_service_async.py`
- `backend/tests/unit/test_api_router.py`
- `backend/tests/unit/test_logging_and_main.py`

### Frontend test/coverage

- `frontend/vitest.config.ts`

### Ignore artifact test/coverage

- `.gitignore`

## 3. Kiến trúc workflow mới

Workflow hiện tại nằm ở `/.github/workflows/project-ci.yml` với tên hiển thị là `CI Dự Án`.

### 3.1 Kích hoạt

Workflow chạy khi có:

- `push`
- `pull_request`

Và chỉ chạy khi thay đổi chạm vào:

- `frontend/**`
- `backend/**`
- `.github/workflows/project-ci.yml`

Mục tiêu của cấu hình này là tránh chạy CI toàn bộ khi thay đổi không liên quan tới hai ứng dụng chính hoặc chính file workflow.

### 3.2 Quyền hạn của workflow

Workflow dùng quyền:

- `contents: read`
- `issues: write`

`issues: write` là cần thiết để job báo lỗi có thể tạo hoặc cập nhật GitHub Issue khi CI fail trên nhánh được push.

## 4. Các job trong `Project CI`

Workflow hiện có 4 job độc lập:

### 4.1 Job `frontend`

Chạy trên `ubuntu-latest`, với `working-directory: frontend`.

Các bước:

1. `actions/checkout@v4`
2. `actions/setup-node@v4`
3. `npm ci`
4. `npm run lint`
5. `npm run test:coverage`
6. Upload artifact coverage

Chi tiết thêm:

- Node version: `20`
- Có bật cache npm dựa trên `frontend/package-lock.json`
- Artifact upload tên: `frontend-coverage-report`
- Thư mục artifact: `frontend/coverage`

Mục tiêu của job này là đảm bảo frontend không chỉ pass unit/integration test mà còn giữ coverage ở mức tối thiểu đã định nghĩa.

### 4.2 Job `backend`

Chạy trên `ubuntu-latest`, với `working-directory: backend`.

Các bước:

1. `actions/checkout@v4`
2. `actions/setup-python@v5`
3. `pip install -r requirements-test.txt`
4. `pytest`
5. Upload artifact coverage

Chi tiết thêm:

- Python version: `3.11`
- Có bật cache pip dựa trên `backend/requirements-test.txt`
- Artifact upload tên: `backend-coverage-report`
- Upload:
  - `backend/coverage.xml`
  - `backend/htmlcov`

Mục tiêu của job này là chạy bộ test backend nhẹ nhưng đủ để kiểm tra logic cốt lõi, không kéo theo toàn bộ dependency runtime nặng.

### 4.3 Job `docker-compose-smoke`

Job này dùng để kiểm tra nhanh luồng Docker trong CI.

Các bước:

1. `actions/checkout@v4`
2. Copy `.env.docker.example` thành `.env`
3. `docker compose up -d --build`
4. Chờ backend health ở `http://127.0.0.1:8000/health`
5. Kiểm tra frontend phản hồi ở `http://127.0.0.1:3000`
6. Nếu lỗi thì in `docker compose ps` và `docker compose logs`
7. Luôn `docker compose down -v` để dọn môi trường

Mục tiêu của job này là bắt sớm các lỗi build hoặc startup như:

- Dockerfile build lỗi
- `docker compose` không khởi động được stack
- backend không lên được health endpoint
- frontend không phản hồi sau khi start

Để job này chạy ổn định, `docker-compose.yml` đã được bổ sung service `mongo` nội bộ và backend mặc định dùng `MONGO_URI=mongodb://mongo:27017` nếu không bị override từ môi trường ngoài.

Ngoài ra script `frontend/scripts/warmup-routes.mjs` cũng đã được sửa lỗi cú pháp optional chaining để tránh làm hỏng luồng khởi động frontend trong Docker.

### 4.4 Job `report-failure`

Job này dùng để tự động ghi nhận lỗi CI sau khi `push` thất bại.

Điều kiện chạy:

- Luôn đợi `frontend`, `backend` và `docker-compose-smoke` hoàn tất
- Chỉ chạy khi event là `push`
- Chỉ chạy nếu một trong các job `frontend`, `backend` hoặc `docker-compose-smoke` có kết quả `failure`

Logic chính:

- Tạo title theo mẫu: `[CI] Project CI failed on <branch>`
- Thu thập job bị lỗi từ `needs.frontend.result`, `needs.backend.result` và `needs.docker-compose-smoke.result`
- Tạo body có các thông tin:
  - branch
  - commit SHA
  - workflow name
  - danh sách job fail
  - link run trên GitHub Actions
- Nếu repo đã có issue đang mở cùng title thì tạo comment mới vào issue đó
- Nếu chưa có thì tạo issue mới

Cách làm này giúp tránh spam quá nhiều issue trùng tiêu đề trên cùng một nhánh, nhưng vẫn giữ lịch sử lỗi qua comment.

## 5. Lý do bổ sung backend test stack riêng

Repo hiện không có `pyproject.toml`, và backend đang dùng `backend/requirements.txt` cho runtime. Tuy nhiên file runtime có thể kéo theo các dependency AI, xử lý dữ liệu hoặc tích hợp ngoài khá nặng, không cần thiết cho bài toán CI unit test cơ bản.

Vì vậy đã tách riêng một file:

- `backend/requirements-test.txt`

Mục tiêu của file này:

- Cài vừa đủ dependency để import app và chạy test
- Giảm thời gian setup CI
- Giảm nguy cơ lỗi cài đặt từ các package nặng hoặc không cần cho unit test
- Giữ luồng pipeline backend đơn giản, dễ bảo trì

Hiện file này gồm các gói chính:

- `fastapi`
- `httpx`
- `motor`
- `openai`
- `orjson`
- `pydantic`
- `pydantic-settings`
- `pymongo`
- `pytest`
- `pytest-asyncio`
- `pytest-cov`
- `python-dotenv`
- `google-genai`
- `tiktoken`

## 6. Cấu hình pytest và coverage cho backend

File cấu hình: `backend/pytest.ini`

Thiết lập hiện tại:

- `testpaths = tests`
- `python_files = test_*.py`
- `asyncio_mode = auto`
- coverage target: `app`
- report dạng terminal missing, XML, HTML
- threshold: `--cov-fail-under=29`

Điều này có nghĩa là nếu coverage tổng của backend tụt xuống dưới `29%`, job backend sẽ fail ngay trong CI.

## 7. Cấu hình coverage cho frontend

File cấu hình: `frontend/vitest.config.ts`

Đã bổ sung threshold coverage tại block `test.coverage.thresholds`:

- `statements: 70`
- `branches: 65`
- `functions: 60`
- `lines: 70`

Ngoài ra coverage report hiện xuất ra các định dạng:

- `text`
- `html`
- `json-summary`
- `lcov`

Thư mục report:

- `frontend/coverage`

Việc đặt threshold trong Vitest giúp frontend bị chặn ngay khi có regression coverage, thay vì chỉ xem report thủ công.

## 8. Test backend đã được bổ sung

Đã thêm test cho các nhóm logic quan trọng sau:

### 8.1 AI ingestion / chunking

- `backend/app/ai/ingestion/text_cleaner.py`
- `backend/app/ai/chunking/text_chunker.py`

### 8.2 Core config / utility

- `backend/app/core/config.py`
- `backend/app/utils/object_id.py`
- `backend/app/repositories/base.py`

### 8.3 Service layer

- `backend/app/services/file_service.py`
- `backend/app/services/material_guardrail_service.py`

### 8.4 API routing

- `backend/app/api/routes/files.py`
- `backend/app/api/router.py`

### 8.5 App bootstrap / logging

- `backend/app/core/logging.py`
- `backend/app/main.py`

Các file test tương ứng hiện nằm trong `backend/tests/unit/`.

## 9. Kết quả coverage hiện tại

### 9.1 Frontend

Baseline coverage frontend sau các thay đổi trước đó:

- Statements: `76.19%`
- Branches: `70.76%`
- Functions: `66.66%`
- Lines: `76.54%`

Trạng thái:

- Đã vượt toàn bộ threshold hiện tại
- `npm run test:coverage` chạy pass
- `npm run test:ci` chạy pass

Điểm coverage yếu còn lại đáng chú ý:

- `frontend/lib/api.ts`

### 9.2 Backend

Coverage tổng backend hiện tại:

- Total: khoảng `29.80%`

Trạng thái:

- Đã vượt threshold `29%`
- `python -m pytest` chạy pass `32/32`

Một số module đạt coverage rất cao hoặc tối đa:

- `backend/app/main.py`: `100%`
- `backend/app/api/router.py`: `100%`
- `backend/app/services/file_service.py`: `100%`
- `backend/app/services/material_guardrail_service.py`: `100%`
- `backend/app/api/routes/files.py`: `100%`
- `backend/app/core/logging.py`: `100%`

## 10. Artifact coverage đã được chuẩn hóa

Để tránh commit nhầm artifact coverage vào repo, `.gitignore` đã được cập nhật thêm các mục:

- `coverage/`
- `htmlcov/`
- `coverage.xml`

Ngoài ra các đường dẫn cụ thể theo app cũng đang được ignore:

- `backend/coverage.xml`
- `backend/htmlcov/`
- `frontend/coverage/`

Điều này giúp vừa giữ repo sạch, vừa vẫn cho phép CI upload artifact coverage khi cần xem kết quả chi tiết.

## 11. Những gì đã được xác minh bằng chạy thực tế

Đã kiểm tra thành công:

- Backend: `python -m pytest`
- Frontend: `npm run test:coverage`
- Frontend: `npm run test:ci`

Kết quả tổng quát:

- Backend test pass
- Frontend test pass
- Frontend lint pass nhưng vẫn còn warning cũ
- Threshold coverage hiện tại không làm CI fail

Ghi chú:

- Cấu hình Docker CI đã được thêm vào workflow và `docker compose config` đã parse thành công.
- Chưa thể chạy xác minh Docker local trong môi trường hiện tại vì Docker daemon không khả dụng (`dockerDesktopLinuxEngine` không chạy).

## 12. Các cảnh báo còn tồn tại nhưng chưa xử lý trong đợt này

Frontend hiện vẫn có một số warning lint cũ, chưa phải lỗi chặn CI:

- `frontend/app/materials/[id]/chat/page.tsx`
- `frontend/components/3d/floating-mascot.tsx`
- `frontend/components/layout/sidebar.tsx`
- `frontend/components/minigame/ShootingQuizPlayer.tsx`

Các warning này không thuộc phần hạ tầng CI cốt lõi nên chưa được xử lý trong đợt làm việc này.

## 13. Các điểm còn yếu và đề xuất bước tiếp theo

### 13.1 Backend

Các khu vực nên tăng coverage tiếp:

- `backend/app/db/mongo.py`
- `backend/app/api/routes/materials.py`
- `backend/app/api/routes/generated_contents.py`
- có thể thêm `backend/app/api/routes/games.py`

Hướng đi tiếp theo hợp lý:

- bổ sung unit test/mocked route test cho các endpoint còn ít coverage
- nâng dần threshold backend từ `29` lên `35+` sau mỗi đợt tăng test

### 13.2 Frontend

Khu vực nên ưu tiên tăng coverage:

- `frontend/lib/api.ts`

Hướng đi tiếp theo hợp lý:

- thêm test cho các helper gọi API, error mapping, branch xử lý response lỗi
- sau khi coverage tăng ổn định có thể nâng thêm threshold frontend

### 13.3 CI observability

Nếu muốn tiến thêm một bước, có thể cân nhắc:

- đẩy coverage lên dịch vụ ngoài như Codecov hoặc Coveralls
- thêm badge CI/coverage vào `README.md`
- thêm step comment kết quả coverage vào PR
- mở rộng Docker smoke test thành e2e test cho vài route chính

## 14. Kết luận

Phần CI hiện tại đã chuyển từ mô hình chỉ kiểm tra frontend sang một pipeline kiểm tra toàn dự án. Workflow mới đã bao phủ được lint, test, coverage, Docker smoke test và cơ chế thông báo lỗi sau `push`. Đồng thời backend đã có nền tảng kiểm thử đủ dùng để CI chạy ổn định mà không phải mang toàn bộ runtime dependency nặng vào pipeline.

Nói ngắn gọn, phần hạ tầng CI cốt lõi đã được dựng xong và đang hoạt động theo hướng đúng; việc còn lại chủ yếu là tiếp tục tăng coverage ở các module backend/frontend còn yếu và nâng threshold theo từng bước để siết chất lượng dần.
