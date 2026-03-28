# Tóm tắt và review CI (2026-03-28)

Tài liệu này được cập nhật lại dựa trên cấu hình thực tế trong `/.github/workflows/project-ci.yml`, `docker-compose.ci.yml`, `frontend/package.json`, `frontend/vitest.config.ts`, `backend/pytest.ini` và `backend/requirements-test.txt`.

Mục tiêu của tài liệu là phản ánh đúng CI đang chạy gì, chưa chạy gì, và các rủi ro đáng chú ý.

## 1. Phạm vi kích hoạt

Workflow CI hiện tại là `CI Dự Án`, nằm tại `/.github/workflows/project-ci.yml`.

CI được kích hoạt bởi:

- `push`
- `pull_request`

Và chỉ chạy khi thay đổi chạm vào một trong các nhóm file sau:

- `frontend/**`
- `backend/**`
- `docker-compose.yml`
- `docker-compose.ci.yml`
- `.env.docker.example`
- `.github/workflows/project-ci.yml`
- `.github/workflows/project-cd.yml`

Nhận xét:

- Cấu hình `paths` đang giúp tránh chạy CI cho thay đổi không liên quan.
- Việc để `project-cd.yml` trong danh sách `paths` là hợp lý vì CD phụ thuộc chặt vào cấu trúc artifact và cách đóng gói từ CI/CD.

## 2. Quyền của workflow

Workflow đang dùng:

- `contents: read`
- `issues: write`

Ý nghĩa:

- `contents: read` đủ cho checkout mã nguồn.
- `issues: write` được dùng cho job tự tạo hoặc cập nhật GitHub Issue khi CI fail trên sự kiện `push`.

## 3. Kiến trúc job hiện tại

CI hiện có 5 job:

1. `frontend`
2. `backend`
3. `docker-compose-smoke`
4. `ci-summary`
5. `report-failure`

Ba job đầu là phần kiểm tra chính. Hai job cuối là phần tổng hợp và thông báo lỗi.

## 4. Job `frontend`

### 4.1 Những gì job này thực sự chạy

Job chạy trên `ubuntu-latest`, với `working-directory: frontend`.

Các bước chính:

1. `actions/checkout`
2. `actions/setup-node` với Node `20`
3. `npm ci`
4. `npm run lint`
5. `npx vitest run --coverage --reporter=default --reporter=json --outputFile=test-results.json`
6. Trích xuất coverage và test metrics
7. Thu thập log, base64 hóa log để đưa vào summary
8. Upload artifact `frontend-coverage-report`

### 4.2 Điều cần lưu ý

- CI không gọi script `npm run test:coverage`, mà gọi trực tiếp `npx vitest run --coverage ...`.
- CI có thêm JSON reporter để tạo `test-results.json`, phục vụ tổng hợp số test pass/fail/total/skipped.
- Artifact coverage được upload từ `frontend/coverage`.

### 4.3 Coverage frontend

Coverage threshold thực tế đang nằm ở `frontend/vitest.config.ts`:

- `statements: 70`
- `branches: 65`
- `functions: 60`
- `lines: 70`

Các định dạng report đang bật:

- `text`
- `html`
- `json-summary`
- `lcov`
- `json`

Nhận xét:

- Tài liệu cũ mô tả đúng phần threshold, nhưng thiếu chi tiết rằng CI cần thêm `test-results.json` để dựng dashboard.
- Việc parse `coverage/coverage-summary.json` bằng `jq` là hợp lý, miễn runner Ubuntu tiếp tục có `jq` sẵn.

## 5. Job `backend`

### 5.1 Những gì job này thực sự chạy

Job chạy trên `ubuntu-latest`, với `working-directory: backend`.

Các bước chính:

1. `actions/checkout`
2. `actions/setup-python` với Python `3.11`
3. `pip install -r requirements-test.txt`
4. `pytest --junitxml=junit.xml`
5. Trích xuất coverage từ `coverage.xml`
6. Trích xuất test metrics từ `junit.xml`
7. Thu thập log và encode base64
8. Upload artifact `backend-coverage-report`

### 5.2 Coverage backend

Coverage backend đang được cấu hình trong `backend/pytest.ini`:

- target: `app`
- report: `term-missing`
- report XML: `coverage.xml`
- report HTML: `htmlcov`
- threshold: `--cov-fail-under=29`

### 5.3 Điểm tài liệu cũ mô tả sai

Tài liệu trước đó nói `requirements-test.txt` là một bộ dependency test tối giản được tách riêng khỏi runtime. Điều này không còn đúng với repo hiện tại.

`backend/requirements-test.txt` thực tế đang là:

- `-r requirements.txt`
- `pytest`
- `pytest-asyncio`
- `pytest-cov`

Điều đó có nghĩa là:

- CI backend vẫn cài toàn bộ dependency runtime trước khi cài dependency test.
- Lợi ích "CI nhẹ hơn nhiều vì không kéo dependency runtime" hiện không tồn tại trong cấu hình hiện tại.

Nhận xét:

- Đây không phải lỗi workflow, nhưng là sai lệch tài liệu quan trọng.
- Nếu mục tiêu vẫn là tối ưu CI backend, repo cần tách lại dependency test thật sự thay vì mô tả như đã có.

## 6. Job `docker-compose-smoke`

### 6.1 Những gì job này thực sự chạy

Job chạy trên `ubuntu-latest` với:

- `DOCKER_BUILDKIT=0`
- `COMPOSE_DOCKER_CLI_BUILD=0`

Các bước chính:

1. Checkout mã nguồn
2. Copy `.env.docker.example` thành `.env`
3. `docker compose -f docker-compose.ci.yml up -d --build`
4. Poll `http://127.0.0.1:8000/health` tối đa 30 lần, mỗi lần cách 3 giây
5. Poll `http://127.0.0.1:3000` tối đa 20 lần, mỗi lần cách 3 giây
6. Thu thập `docker compose ps` và `docker compose logs`
7. Luôn `docker compose -f docker-compose.ci.yml down -v`

### 6.2 Điều cần lưu ý

- Smoke test dùng `docker-compose.ci.yml`, không dùng `docker-compose.yml`.
- Đây là điểm tài liệu cũ mô tả chưa đủ rõ.
- `docker-compose.ci.yml` đang là biến thể gần production hơn:
  - frontend dùng `frontend/Dockerfile`
  - backend dùng `backend/Dockerfile`
  - không mount source code từ host
  - frontend chạy `NODE_ENV=production`
  - backend chạy `APP_ENV=ci`

### 6.3 Giá trị của smoke test

Job này đang giúp bắt sớm các lỗi:

- Dockerfile build fail
- dependency trong image bị thiếu
- backend không lên được `/health`
- frontend không phản hồi sau khi start
- dependency thứ tự startup sai giữa `mongo`, `backend`, `frontend`

### 6.4 Rủi ro hiện tại

- Smoke test mới chỉ xác nhận frontend có phản hồi HTTP, chưa xác nhận giao diện render đúng hoặc gọi API chính thành công.
- Job chưa có kiểm tra e2e cho route nghiệp vụ.

## 7. Job `ci-summary`

Job này luôn chạy sau:

- `frontend`
- `backend`
- `docker-compose-smoke`

Nó dùng `actions/github-script` để dựng dashboard trong GitHub Actions Summary.

Thông tin được tổng hợp:

- trạng thái từng job
- coverage frontend
- coverage backend
- số test pass/fail/skipped
- terminal logs của frontend/backend/docker sau khi giải mã base64

Nhận xét:

- Đây là phần observability tốt, vì người xem run không cần mở từng job con mới thấy bức tranh tổng thể.
- Tài liệu cũ gần như chưa mô tả đúng mức chi tiết của phần summary này.

## 8. Job `report-failure`

Job này chỉ chạy khi đồng thời thỏa các điều kiện:

- `always()`
- event là `push`
- ít nhất một trong ba job `frontend`, `backend`, `docker-compose-smoke` có kết quả `failure`

Hành vi:

- tạo mới hoặc cập nhật GitHub Issue
- title theo nhánh
- ghi trạng thái từng job
- đính kèm link tới run Actions

Nhận xét:

- Cơ chế này tránh spam issue mới cho cùng một nhánh.
- Pull request fail sẽ không tự tạo issue, vì workflow đã giới hạn vào event `push`.

## 9. Những gì CI hiện có và chưa có

### 9.1 Đang có

- lint frontend
- unit/integration test frontend qua Vitest
- coverage frontend có threshold
- pytest backend có threshold coverage
- docker compose smoke test cho toàn stack
- dashboard summary ngay trong GitHub Actions
- tự tạo/cập nhật issue khi CI fail trên `push`

### 9.2 Chưa có

- backend lint riêng như `ruff`, `flake8` hoặc `mypy`
- test matrix nhiều phiên bản Node/Python
- caching nâng cao cho Docker layers
- e2e test trình duyệt
- PR comment tự động cho coverage delta
- secret scanning, dependency scanning, SAST

## 10. Kết luận review CI

CI hiện tại có cấu trúc khá đầy đủ cho mức project application:

- có kiểm tra riêng cho frontend
- có kiểm tra riêng cho backend
- có smoke test ở cấp độ stack
- có summary và cơ chế issue khi fail

Tuy nhiên có hai điểm tài liệu cũ sai lệch quan trọng cần sửa:

1. `requirements-test.txt` không còn là bộ dependency test tối giản, vì đang include toàn bộ `requirements.txt`.
2. Smoke test thực tế chạy trên `docker-compose.ci.yml`, không phải mô tả chung chung là "Docker của repo".

Nếu cần siết chất lượng CI ở bước tiếp theo, ba việc ưu tiên hợp lý nhất là:

1. tách backend test dependencies thật sự tối giản
2. bổ sung backend lint/type-check
3. nâng smoke test lên e2e ngắn cho vài luồng chính
