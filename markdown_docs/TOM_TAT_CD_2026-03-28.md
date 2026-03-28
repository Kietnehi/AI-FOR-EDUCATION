# Review đầy đủ CD của dự án (2026-03-28)

Tài liệu này là bản review đầy đủ luồng Continuous Delivery/Deployment (CD) hiện tại của repo `AI-FOR-EDUCATION`. Mục tiêu là để chỉ cần đọc tài liệu này, người đọc có thể hiểu CD đang được kích hoạt như thế nào, đang build gì, publish gì, artifact nào được tạo ra, và tại sao hiện tại vẫn chưa thể xem đây là deploy production hoàn chỉnh.

Nội dung dưới đây phản ánh cấu hình thực tế trong:

- `/.github/workflows/project-cd.yml`

## 1. CD hiện tại dùng để làm gì

CD của dự án hiện đang nằm ở trạng thái trung gian giữa hai mức:

1. **không còn là placeholder thuần túy**
2. **nhưng cũng chưa phải deploy production hoàn chỉnh**

Lý do là vì workflow hiện tại đã làm được các việc quan trọng sau:

- tạo metadata phát hành
- build artifact frontend
- package artifact backend
- đóng gói Docker bundle
- build và push image frontend/backend lên GHCR
- tạo báo cáo phát hành và bundle tổng hợp

Nhưng workflow vẫn **chưa** làm các việc sau:

- deploy image lên server thật
- chạy migration production
- health check sau deploy thật
- rollback tự động

Vì vậy mô tả đúng nhất cho CD hiện tại là:

**pipeline phát hành artifact + publish image, chưa phải pipeline deploy production hoàn chỉnh**

## 2. Workflow CD nằm ở đâu

- Tên workflow: `CD Dự Án`
- File workflow: `/.github/workflows/project-cd.yml`

Đây là workflow trung tâm cho toàn bộ phần phát hành hiện tại của repo.

## 3. Khi nào CD được kích hoạt

Workflow có 2 cơ chế kích hoạt.

### 3.1 Chạy thủ công

Thông qua `workflow_dispatch`.

Hiện có input:

- `target_environment`

Giá trị chọn được:

- `staging-placeholder`
- `production-placeholder`

Ý nghĩa của input này hiện tại chủ yếu là để ghi metadata và báo cáo, chưa điều khiển deploy thật.

### 3.2 Tự chạy sau CI

Thông qua `workflow_run` khi workflow `CI Dự Án` hoàn tất trên các nhánh:

- `main`
- `kiet`

Job `prepare-release` chỉ chạy nếu kết quả của CI là `success`.

### 3.3 Điều quan trọng cần hiểu về `workflow_run`

Đây là một điểm rất quan trọng khi vận hành repo này.

- CD được nối sau CI, nên hành vi auto-trigger phụ thuộc vào workflow definition ở nhánh mặc định.
- Trên thực tế, việc xác nhận `workflow_run` đáng tin cậy nhất vẫn nên làm trên `main`.

Điều này giải thích vì sao trong nhiều repo, sửa CD ở nhánh phụ có thể chưa cho cảm giác auto-run ổn định bằng khi workflow đã nằm trên default branch.

## 4. Biến môi trường mức workflow

Workflow hiện thiết lập ba biến mức global:

- `SOURCE_SHA`
- `SOURCE_BRANCH`
- `TARGET_ENVIRONMENT`

### 4.1 Ý nghĩa của từng biến

- `SOURCE_SHA`: commit nguồn của lần phát hành
- `SOURCE_BRANCH`: nhánh nguồn của commit đó
- `TARGET_ENVIRONMENT`: môi trường phát hành mang tính logic/báo cáo

Nếu workflow được kích hoạt bởi `workflow_run`, hai biến đầu lấy từ `github.event.workflow_run`.

Nếu workflow chạy tay bằng `workflow_dispatch`, chúng quay về `github.sha` và `github.ref_name`.

### 4.2 Điểm kỹ thuật đã được xử lý

Trước đây CD kiểu `workflow_run` rất dễ gặp lỗi “metadata nói một commit, nhưng checkout lại build commit khác”.

Workflow hiện tại đã xử lý điểm này bằng cách để các bước `actions/checkout` chính checkout theo:

- `ref: ${{ env.SOURCE_SHA }}`

Điều đó có nghĩa là artifact và image hiện được build từ đúng commit nguồn của run CD, thay vì vô tình lấy HEAD mặc định của branch đang mở workflow.

## 5. Quyền và secret mà CD đang dùng

Workflow CD hiện khai báo các quyền:

- `contents: read`
- `issues: write`
- `packages: write`

### 5.1 Ý nghĩa

- `contents: read`: phục vụ checkout mã nguồn
- `issues: write`: phục vụ job tạo/cập nhật issue khi CD lỗi
- `packages: write`: phục vụ publish image lên GitHub Container Registry

### 5.2 Secret đang dùng

Workflow hiện dùng secret:

- `GHCR_TOKEN`

Secret này được dùng để đăng nhập `ghcr.io` trong job publish image.

Nói ngắn gọn:

- CI không cần secret này
- CD cần secret này để push image ổn định lên GHCR

## 6. Kiến trúc tổng thể của workflow CD

CD hiện có 9 job theo thứ tự logic:

1. `prepare-release`
2. `build-frontend-artifact`
3. `package-backend-artifact`
4. `package-docker-bundle`
5. `publish-container-images`
6. `deploy-placeholder`
7. `release-bundle`
8. `cd-summary`
9. `report-failure`

### Cách các job liên kết với nhau

- `prepare-release` chạy trước để tạo metadata nền.
- Ba job đóng gói artifact và một job publish image chạy sau đó.
- `deploy-placeholder` chờ tất cả job phát hành chính hoàn tất.
- `release-bundle` gom toàn bộ artifact.
- `cd-summary` tổng hợp kết quả.
- `report-failure` chỉ xử lý khi có thất bại.

Nhìn theo bản chất, đây là workflow gồm 3 tầng:

1. **tầng chuẩn bị release**
2. **tầng build/package/publish**
3. **tầng tổng hợp và báo cáo**

## 7. Review chi tiết job `prepare-release`

### 7.1 Mục tiêu

Job này tạo ra bộ metadata chung cho toàn bộ lần phát hành.

### 7.2 Các bước chính

1. checkout theo `SOURCE_SHA`
2. tạo `release/release-metadata.json`
3. tạo `release/release-notes.md`
4. upload artifact `cd-release-metadata`

### 7.3 Dữ liệu được ghi vào metadata

- release name
- release version
- commit SHA
- commit SHA short
- branch
- workflow
- run id
- target environment
- thời gian tạo

### 7.4 Ý nghĩa thực tế

Đây là lớp chuẩn hóa thông tin phát hành. Nhờ đó các job sau có thể dùng chung một bộ định danh release thay vì tự suy luận lại.

Hiện `release_version` đang là dạng:

- `placeholder-<sha7>`

Nó đủ dùng cho nội bộ, nhưng chưa phải versioning release chính thức kiểu semver.

## 8. Review chi tiết job `build-frontend-artifact`

### 8.1 Mục tiêu

Build bản frontend production và đóng gói thành artifact phát hành.

### 8.2 Các bước chính

1. checkout theo `SOURCE_SHA`
2. setup Node.js 20
3. `npm ci`
4. `npm run build`
5. copy các file cần thiết vào thư mục `release/frontend`
6. upload artifact

### 8.3 Nội dung bundle frontend hiện tại

- `.next`
- `public`
- `package.json`
- `package-lock.json`
- `next.config.mjs`

### 8.4 Artifact đầu ra

- `frontend-release-bundle-<sha7>`

### 8.5 Điều cần hiểu đúng

Artifact này chứng minh frontend đã build thành công ở chế độ phát hành, nhưng **không đồng nghĩa với việc frontend đã được deploy**.

Đây là release bundle, không phải runtime deployment.

## 9. Review chi tiết job `package-backend-artifact`

### 9.1 Mục tiêu

Đóng gói backend thành bundle phát hành ở mức source/runtime assets cần thiết.

### 9.2 Các bước chính

1. checkout theo `SOURCE_SHA`
2. setup Python 3.11
3. `python -m compileall app`
4. copy source và file cấu hình vào `release/backend`
5. upload artifact

### 9.3 Nội dung bundle backend hiện tại

- `app`
- `requirements.txt`
- `requirements-test.txt`
- `Dockerfile`
- `pytest.ini`

### 9.4 Artifact đầu ra

- `backend-release-bundle-<sha7>`

### 9.5 Điều cần hiểu đúng

Job này chỉ kiểm tra syntax compile, không chạy test backend trong CD. Điều đó là hợp lý vì CD đang được gate phía trước bởi CI.

## 10. Review chi tiết job `package-docker-bundle`

### 10.1 Mục tiêu

Đóng gói phần cấu hình Docker liên quan đến phát hành.

### 10.2 Các bước chính

1. checkout theo `SOURCE_SHA`
2. setup Docker Buildx
3. copy `.env.docker.example` thành `.env`
4. chạy `docker compose config > release-docker-compose.resolved.yml`
5. copy file Docker liên quan vào bundle
6. upload artifact

### 10.3 Nội dung bundle Docker hiện tại

- `docker-compose.yml`
- `.env.docker.example`
- `docker-compose.resolved.yml`

### 10.4 Artifact đầu ra

- `docker-release-bundle-<sha7>`

### 10.5 Điều cần hiểu đúng

Job này **không push image**.

Nó chỉ giúp:

- kiểm tra cấu hình compose resolve được
- lưu lại bản compose đã resolve làm artifact

## 11. Review chi tiết job `publish-container-images`

Đây là phần quan trọng nhất trong bản CD hiện tại, vì đây là job biến CD từ mức “chỉ gom artifact” sang mức “phát hành container image thực tế”.

### 11.1 Mục tiêu

- build image backend
- build image frontend
- push hai image đó lên GHCR

### 11.2 Các bước chính

1. checkout theo `SOURCE_SHA`
2. setup Docker Buildx
3. đăng nhập `ghcr.io` bằng `GHCR_TOKEN`
4. chuẩn hóa namespace image về lowercase
5. tạo metadata tags cho backend
6. tạo metadata tags cho frontend
7. build và push image backend
8. build và push image frontend
9. tạo artifact báo cáo image đã publish

### 11.3 Image đích hiện tại

- `ghcr.io/kietnehi/ai-for-education-backend`
- `ghcr.io/kietnehi/ai-for-education-frontend`

### 11.4 Quy tắc tag hiện tại

Workflow đang tạo các loại tag sau:

- `latest` cho default branch
- `<sha7>`
- `<branch>`

Điều này có nghĩa là sau mỗi lần CD hợp lệ, bạn có nhiều cách tham chiếu image:

- bằng commit ngắn để pin version
- bằng tên branch để test theo nhánh
- bằng `latest` cho nhánh mặc định

### 11.5 Artifact đầu ra

- `ghcr-images-<sha7>`

Artifact này là một báo cáo markdown liệt kê các tag image đã được publish.

### 11.6 Ý nghĩa thực tế

Đây là điểm mấu chốt của CD hiện tại:

- repo đã có nơi publish image chuẩn
- bước deploy server về sau chỉ cần pull image từ GHCR
- CD hiện tại đã đủ để đóng vai trò “image publisher pipeline”

## 12. Review chi tiết job `deploy-placeholder`

### 12.1 Bản chất thật của job này

Tên job đã nói đúng bản chất: đây **không phải deploy thật**.

Nó là một bước placeholder để mô tả trạng thái phát hành hiện tại.

### 12.2 Job này đang chờ gì trước khi chạy

Nó cần hoàn tất các phần sau:

- metadata release
- frontend artifact
- backend artifact
- docker bundle
- GHCR images

### 12.3 Job này làm gì

1. tải `cd-release-metadata`
2. tạo `release/deploy/deployment-summary.md`
3. ghi summary vào GitHub Step Summary
4. upload artifact `deployment-summary-<sha7>`

### 12.4 Summary hiện nói gì

Summary hiện xác nhận rõ rằng:

- frontend đã build xong và upload bundle
- backend đã package xong
- docker compose đã resolve thành công
- image frontend/backend đã được publish lên GHCR
- chưa triển khai lên server thật

### 12.5 Vì sao vẫn giữ job này

Giữ `deploy-placeholder` có ích vì:

- giúp pipeline có cấu trúc CD hoàn chỉnh hơn
- giữ chỗ cho bước deploy thật trong tương lai
- cho người đọc Actions run thấy rõ trạng thái “đã phát hành image nhưng chưa deploy”

## 13. Review chi tiết job `release-bundle`

### 13.1 Mục tiêu

Gom tất cả artifact quan trọng của lần phát hành vào một gói duy nhất.

### 13.2 Job này tải gì xuống

- metadata
- frontend bundle
- backend bundle
- docker bundle
- ghcr image report
- deployment summary

### 13.3 Artifact đầu ra

- `full-release-bundle-<sha7>`

### 13.4 Giá trị thực tế

Artifact này rất hữu ích cho:

- kiểm tra sau phát hành
- bàn giao nội bộ
- làm đầu vào cho bước deploy thủ công hoặc script deploy riêng về sau

## 14. Review chi tiết job `cd-summary`

### 14.1 Vai trò

`cd-summary` là dashboard tổng hợp cuối cùng của workflow CD.

### 14.2 Nó hiển thị gì

- release name
- release version
- target environment
- trạng thái từng job
- artifact chính
- trạng thái job publish GHCR image

### 14.3 Ý nghĩa

Người đọc không cần mở từng job một để hiểu run CD đã đi tới đâu.

Đây là phần giúp workflow dễ vận hành và dễ review hơn rất nhiều.

## 15. Review chi tiết job `report-failure`

### 15.1 Khi nào job này chạy

Job chạy nếu một trong các job quan trọng bị fail, bao gồm cả `publish-container-images`.

### 15.2 Job này làm gì

- tạo GitHub Issue mới nếu chưa có issue mở phù hợp
- hoặc comment vào issue hiện có
- liệt kê các job lỗi
- gắn link tới run GitHub Actions

### 15.3 Giá trị thực tế

Điều này giúp CD có khả năng tự báo lỗi ở mức repo, không bắt buộc người vận hành phải canh tab Actions liên tục.

## 16. Các artifact quan trọng của CD hiện tại

Workflow CD hiện có các artifact đáng chú ý sau:

- `cd-release-metadata`
- `frontend-release-bundle-<sha7>`
- `backend-release-bundle-<sha7>`
- `docker-release-bundle-<sha7>`
- `ghcr-images-<sha7>`
- `deployment-summary-<sha7>`
- `full-release-bundle-<sha7>`

### Artifact quan trọng nhất nếu chỉ tải một thứ

Nếu chỉ chọn một artifact để tải, nên lấy:

- `full-release-bundle-<sha7>`

Vì nó là gói tổng hợp toàn bộ release hiện tại.

## 17. CD hiện tại mạnh ở đâu

CD hiện tại có các điểm mạnh rõ ràng:

1. **Có metadata release rõ ràng**
2. **Có artifact frontend/backend/docker riêng**
3. **Đã publish image thật lên GHCR**
4. **Đã có summary và alert khi lỗi**
5. **Đã checkout đúng `SOURCE_SHA` cho `workflow_run`**

Đây là một bước tiến quan trọng so với kiểu CD chỉ build nội bộ mà không phát hành ra bất kỳ nơi nào.

## 18. CD hiện tại còn thiếu gì

Nếu xét theo chuẩn deploy production hoàn chỉnh, CD hiện còn thiếu:

- job deploy server thật
- environment secrets tách riêng theo staging/production
- migration step
- post-deploy smoke test
- rollback strategy
- approval gate / environment protection thực sự

Nói cách khác: **publish image đã có, deploy runtime thì chưa có**.

## 19. Kết luận tổng thể về CD

CD hiện tại của dự án nên được hiểu như sau:

1. CI đi trước để gate chất lượng.
2. CD tạo metadata và release bundle.
3. CD build và push image frontend/backend lên GHCR.
4. CD mới dừng ở `deploy-placeholder`, chưa triển khai lên hạ tầng chạy thật.

Đây là trạng thái hợp lý nếu nhóm muốn hoàn thiện từng bước:

- trước hết chuẩn hóa CI
- sau đó publish image ổn định
- cuối cùng mới thêm deploy server ở giai đoạn sau

Nếu muốn nâng CD lên mức production hơn, ba bước tiếp theo hợp lý nhất là:

1. thêm job deploy server pull image từ GHCR
2. tách config/secrets theo từng environment
3. thêm health check sau deploy và rollback tối thiểu
