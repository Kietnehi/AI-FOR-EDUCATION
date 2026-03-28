# Review đầy đủ CI của dự án (2026-03-28)

Tài liệu này là bản review đầy đủ luồng Continuous Integration (CI) hiện tại của repo `AI-FOR-EDUCATION`. Mục tiêu là để chỉ cần đọc một tài liệu này, người mới vào repo vẫn hiểu được CI đang chạy gì, tại sao chạy như vậy, đầu ra là gì, và giới hạn hiện tại nằm ở đâu.

Nội dung dưới đây phản ánh cấu hình thực tế trong:

- `/.github/workflows/project-ci.yml`
- `/docker-compose.ci.yml`
- `frontend/vitest.config.ts`
- `backend/pytest.ini`
- `backend/requirements-test.txt`

## 1. CI hiện tại dùng để làm gì

CI của dự án đóng vai trò là lớp chặn chất lượng trước khi code được coi là đủ an toàn để đi tiếp sang CD.

Nó đang kiểm tra 3 lớp chính:

1. **Frontend quality gate**
   - cài dependency
   - lint
   - chạy test với coverage

2. **Backend quality gate**
   - cài dependency test
   - chạy `pytest`
   - kiểm tra coverage

3. **Whole-stack smoke gate bằng Docker Compose**
   - build toàn stack theo cấu hình CI riêng
   - bật container
   - chờ backend sống
   - chờ frontend phản hồi

Nói ngắn gọn: CI hiện tại không chỉ test unit, mà còn kiểm tra xem cả hệ thống có build và khởi động được ở mức tối thiểu hay không.

## 2. Workflow CI nằm ở đâu

- Tên workflow: `CI Dự Án`
- File workflow: `/.github/workflows/project-ci.yml`

Workflow này là entry point duy nhất của CI chính trong repo ở thời điểm hiện tại.

## 3. Khi nào CI được kích hoạt

CI được kích hoạt bởi hai sự kiện:

- `push`
- `pull_request`

Tuy nhiên workflow không chạy cho mọi thay đổi. Nó chỉ chạy khi thay đổi chạm vào các nhóm file sau:

- `frontend/**`
- `backend/**`
- `docker-compose.yml`
- `docker-compose.ci.yml`
- `.env.docker.example`
- `.github/workflows/project-ci.yml`
- `.github/workflows/project-cd.yml`

### Ý nghĩa của cấu hình `paths`

Đây là một điểm quan trọng của workflow hiện tại.

- Nếu bạn chỉ sửa tài liệu không liên quan hoặc file ngoài phạm vi trên, CI sẽ không bị kích hoạt.
- Nếu bạn sửa `project-cd.yml`, CI vẫn chạy lại.

Việc đưa `/.github/workflows/project-cd.yml` vào `paths` là hợp lý vì:

- CD phụ thuộc vào artifact và cách đóng gói từ CI
- thay đổi CD có thể làm hỏng chuỗi CI/CD chung
- chạy lại CI giúp phát hiện sớm lỗi workflow liên quan đến đóng gói và Docker

## 4. Quyền mà workflow CI đang dùng

Workflow CI hiện khai báo:

- `contents: read`
- `issues: write`

### Ý nghĩa

- `contents: read` đủ cho `actions/checkout` đọc mã nguồn repo.
- `issues: write` được dùng để mở hoặc cập nhật GitHub Issue khi CI thất bại trên `push`.

CI hiện không cần quyền package hay deploy vì phần đó thuộc CD.

## 5. Kiến trúc tổng thể của workflow CI

Workflow có 5 job:

1. `frontend`
2. `backend`
3. `docker-compose-smoke`
4. `ci-summary`
5. `report-failure`

Trong đó:

- `frontend`, `backend`, `docker-compose-smoke` là các job kiểm tra chính
- `ci-summary` là job tổng hợp kết quả
- `report-failure` là job thông báo lỗi tự động bằng GitHub Issue

### Cách các job liên kết với nhau

- Ba job chính có thể chạy song song.
- `ci-summary` phụ thuộc vào cả ba job chính.
- `report-failure` cũng phụ thuộc vào cả ba job chính và chỉ kích hoạt khi có thất bại.

Điều này giúp giảm thời gian chờ tổng thể, đồng thời vẫn có một lớp tổng hợp dễ đọc sau cùng.

## 6. Review chi tiết job `frontend`

### 6.1 Mục tiêu của job

Job `frontend` đảm bảo phần giao diện:

- cài được dependency
- không lỗi lint ở mức workflow đang kiểm tra
- test qua Vitest
- coverage không tụt dưới ngưỡng đã cấu hình

### 6.2 Môi trường chạy

- Runner: `ubuntu-latest`
- `working-directory`: `frontend`
- Node.js: `20`

Workflow bật cache npm qua `actions/setup-node` và `frontend/package-lock.json`.

### 6.3 Các bước thực tế đang chạy

1. `actions/checkout@v6`
2. `actions/setup-node@v6`
3. `npm ci`
4. `npm run lint`
5. `npx vitest run --coverage --reporter=default --reporter=json --outputFile=test-results.json`
6. trích xuất số liệu coverage và test metrics
7. thu thập log, base64 hóa log
8. upload artifact `frontend-coverage-report`

### 6.4 Điểm cần hiểu đúng

CI không gọi script kiểu `npm run test:coverage`, mà gọi trực tiếp `vitest` với nhiều reporter để lấy thêm dữ liệu máy đọc được.

Điều này có lợi vì workflow cần:

- `coverage/coverage-summary.json`
- `test-results.json`

để dựng dashboard trong `ci-summary`.

### 6.5 Coverage frontend hiện tại

Ngưỡng coverage đang nằm trong `frontend/vitest.config.ts`:

- `lines: 70`
- `statements: 70`
- `branches: 65`
- `functions: 60`

Các loại report đang tạo:

- `text`
- `html`
- `json-summary`
- `lcov`
- `json`

### 6.6 Đầu ra của job

Job xuất ra các output nội bộ để job khác dùng:

- coverage tổng
- coverage chi tiết theo loại
- test metrics
- log dạng base64

Artifact được upload:

- `frontend-coverage-report`

Artifact này thường chứa thư mục `frontend/coverage` để phục vụ xem lại coverage sau run.

### 6.7 Điểm mạnh

- Có lint riêng cho frontend.
- Có coverage threshold.
- Có metrics đủ để dựng summary đẹp.
- Có log gom sẵn để đọc nhanh trong dashboard.

### 6.8 Giới hạn hiện tại

- Chưa có e2e frontend trong browser thật.
- Chưa có visual regression.
- Chưa có nhiều tầng lint/type-check frontend ngoài cấu hình hiện tại của repo.

## 7. Review chi tiết job `backend`

### 7.1 Mục tiêu của job

Job `backend` kiểm tra xem phần server:

- cài được dependency test
- chạy được test qua `pytest`
- coverage không thấp hơn ngưỡng tối thiểu

### 7.2 Môi trường chạy

- Runner: `ubuntu-latest`
- `working-directory`: `backend`
- Python: `3.11`

Workflow bật cache pip dựa trên `backend/requirements-test.txt`.

### 7.3 Các bước thực tế đang chạy

1. `actions/checkout@v6`
2. `actions/setup-python@v6`
3. `pip install -r requirements-test.txt`
4. `pytest --junitxml=junit.xml`
5. trích xuất coverage từ `coverage.xml`
6. trích xuất test metrics từ `junit.xml`
7. thu thập log và base64 hóa
8. upload artifact `backend-coverage-report`

### 7.4 Coverage backend hiện tại

Theo `backend/pytest.ini`, backend đang có:

- đo coverage cho `app`
- xuất `coverage.xml`
- xuất `htmlcov`
- ngưỡng tối thiểu: `--cov-fail-under=29`

### 7.5 Điểm cần hiểu đúng

`backend/requirements-test.txt` hiện không phải bộ dependency test tối giản độc lập. Nó đang include luôn `requirements.txt`.

Điều này có nghĩa:

- backend CI vẫn cài toàn bộ runtime dependency trước
- sau đó mới cài các gói test như `pytest`, `pytest-cov`, `pytest-asyncio`

Đây không phải bug, nhưng là một điểm chi phí thời gian đáng chú ý.

### 7.6 Đầu ra của job

Job xuất:

- coverage tổng
- test metrics
- log dạng base64

Artifact được upload:

- `backend-coverage-report`

Artifact này thường gồm:

- `backend/coverage.xml`
- `backend/htmlcov`

### 7.7 Điểm mạnh

- Có coverage threshold.
- Có test metrics parse từ JUnit XML.
- Có summary log rõ ràng.

### 7.8 Giới hạn hiện tại

- Chưa có backend lint riêng như `ruff`.
- Chưa có type-check backend như `mypy` hoặc tương đương.
- Coverage threshold backend hiện còn thấp nếu so với chuẩn production nghiêm ngặt.

## 8. Review chi tiết job `docker-compose-smoke`

### 8.1 Mục tiêu của job

Đây là job rất quan trọng vì nó kiểm tra toàn stack ở mức khởi động thật bằng Docker.

Nó không thay thế e2e, nhưng đủ để bắt nhiều lỗi mà unit test riêng lẻ không thấy được.

### 8.2 Môi trường và cờ chạy

Job chạy với:

- `DOCKER_BUILDKIT=0`
- `COMPOSE_DOCKER_CLI_BUILD=0`

Hai biến này được thêm để tránh các lỗi không ổn định đã từng gặp với build/export image trong GitHub Actions khi dùng Buildx cho smoke test.

### 8.3 File compose dùng cho CI

Job này không dùng `docker-compose.yml` trực tiếp để smoke test.

Nó dùng:

- `/docker-compose.ci.yml`

Lý do tách file này là để cấu hình CI ổn định hơn môi trường dev, tránh các vấn đề như:

- bind mount source code từ host
- chế độ dev/reload gây sai lệch hành vi
- healthcheck frontend fail sớm

### 8.4 Các bước thực tế đang chạy

1. checkout mã nguồn
2. copy `.env.docker.example` thành `.env`
3. `docker compose -f docker-compose.ci.yml up -d --build`
4. poll `http://127.0.0.1:8000/health` tối đa 30 lần, mỗi lần cách 3 giây
5. poll `http://127.0.0.1:3000` tối đa 20 lần, mỗi lần cách 3 giây
6. thu thập `docker compose ps`
7. thu thập `docker compose logs --no-color`
8. luôn `docker compose -f docker-compose.ci.yml down -v`

### 8.5 Những điểm đã được tối ưu trong quá trình sửa CI

CI Docker hiện tại tốt hơn bản đầu ở các điểm sau:

- bỏ phụ thuộc vào `docker compose up --wait`
- dùng retry riêng cho backend và frontend
- có `set -o pipefail` để không nuốt lỗi thực
- có thu thập `ps` và `logs` đầy đủ khi fail
- dùng file compose CI riêng để giảm sai khác với môi trường GitHub runner

### 8.6 Những gì job này thực sự xác nhận được

Nếu job pass, có thể hiểu rằng:

- Dockerfile backend build được
- Dockerfile frontend build được
- stack CI khởi động được bằng Compose
- backend trả được `/health`
- frontend phản hồi HTTP ở cổng `3000`

### 8.7 Những gì job này chưa xác nhận được

Job này chưa chứng minh rằng:

- giao diện frontend render đúng toàn bộ
- frontend gọi API chính thành công ở các luồng thật
- upload file, generate nội dung, chatbot, notebooklm, minigame đều hoạt động
- toàn bộ stack production behavior là hoàn toàn đúng

Nói cách khác, đây là **smoke test**, chưa phải **e2e test**.

### 8.8 Giá trị thực tế của job này

Đây là job giúp bắt sớm các lỗi hay nhất ở mức tích hợp:

- build lỗi vì dependency/image
- backend không boot được
- frontend không start được sau build production
- thứ tự phụ thuộc giữa `mongo`, `backend`, `frontend` có vấn đề

## 9. Job `ci-summary`

### 9.1 Vai trò

Job này là lớp quan sát tập trung của workflow.

Thay vì người xem phải mở từng job con để đọc log, `ci-summary` gom dữ liệu lại thành một dashboard trong GitHub Actions Summary.

### 9.2 Job này dùng dữ liệu gì

Nó đọc từ outputs của:

- `frontend`
- `backend`
- `docker-compose-smoke`

Dữ liệu được dùng gồm:

- trạng thái từng job
- coverage frontend
- coverage backend
- test metrics frontend/backend
- log đã mã hóa base64

### 9.3 Kết quả hiển thị

Summary hiện cho người đọc thấy nhanh:

- job nào pass/fail
- coverage từng phần
- số test passed/failed/skipped
- terminal output quan trọng của frontend, backend, docker

Đây là điểm cộng lớn về khả năng vận hành và debug.

## 10. Job `report-failure`

### 10.1 Khi nào job này chạy

Job chỉ chạy khi đồng thời thỏa các điều kiện:

- `always()`
- event là `push`
- ít nhất một trong ba job `frontend`, `backend`, `docker-compose-smoke` thất bại

### 10.2 Job này làm gì

Job dùng `actions/github-script` để:

- tạo mới GitHub Issue khi nhánh đó chưa có issue lỗi mở sẵn
- hoặc cập nhật issue cũ nếu cùng nhánh tiếp tục fail

### 10.3 Tại sao chỉ mở issue trên `push`

Đây là một lựa chọn hợp lý để giảm spam.

- PR có thể fail nhiều lần trong lúc sửa tạm thời
- `push` lên nhánh phản ánh sát hơn một trạng thái code đã được đẩy lên repo

## 11. Dữ liệu đầu ra quan trọng của CI

CI hiện tạo ra các đầu ra hữu ích sau:

### 11.1 Artifact

- `frontend-coverage-report`
- `backend-coverage-report`

### 11.2 Summary

- dashboard tổng hợp ở GitHub Actions Summary

### 11.3 Issue tự động khi fail

- issue CI failure theo nhánh trong trường hợp `push`

## 12. CI hiện tại mạnh ở đâu

CI hiện tại có các điểm mạnh rõ ràng:

1. **Có nhiều lớp kiểm tra**
   - frontend
   - backend
   - toàn stack bằng Docker

2. **Có tính quan sát tốt**
   - summary đẹp
   - metrics rõ
   - log dễ xem

3. **Có cơ chế phản hồi khi lỗi**
   - tự mở/cập nhật issue

4. **Có gate đủ tốt trước CD**
   - CD hiện phụ thuộc thực tế vào việc CI đi qua được

## 13. CI hiện tại chưa có gì

Đây là các khoảng trống hiện tại nếu nhìn CI theo chuẩn khắt khe hơn:

- backend lint riêng (`ruff`, `flake8`)
- backend type-check (`mypy`)
- e2e test trình duyệt
- test matrix nhiều version Node/Python
- Docker layer cache nâng cao
- dependency scanning / SAST / secret scanning
- PR comment coverage delta

Những phần này không làm CI hiện tại sai, chỉ cho thấy repo vẫn còn không gian để nâng chất lượng tiếp.

## 14. Kết luận tổng thể về CI

CI hiện tại của dự án là một pipeline khá tốt cho mức ứng dụng full-stack đang phát triển:

- có kiểm tra frontend riêng
- có kiểm tra backend riêng
- có smoke test tích hợp cả stack
- có summary để vận hành
- có alert bằng issue khi fail

Ba điểm quan trọng nhất cần nhớ khi review CI repo này là:

1. **CI không chỉ test code, mà còn test khả năng boot stack bằng Docker.**
2. **Smoke test đang chạy bằng `docker-compose.ci.yml`, không phải compose dev thường.**
3. **CI là lớp gate chính trước khi CD publish image lên GHCR.**

Nếu muốn nâng CI lên thêm một bậc nữa, thứ tự ưu tiên hợp lý nhất là:

1. thêm backend lint và type-check
2. thêm e2e ngắn cho vài luồng chính
3. tối ưu dependency/caching để rút ngắn thời gian chạy
