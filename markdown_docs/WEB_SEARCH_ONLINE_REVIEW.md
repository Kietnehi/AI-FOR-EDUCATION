# Review Chức Năng Search Website Online

## Mô tả ngắn

`Search Website Online` là chức năng tìm kiếm web tích hợp trực tiếp trong AI Learning Studio, cho phép người dùng tra cứu nội dung theo từ khóa với nhiều loại kết quả như web, tin tức, hình ảnh, video và sách ngay trong giao diện ứng dụng.

## Mục tiêu chức năng

- Cho phép người dùng tìm kiếm nhanh nội dung online mà không cần rời khỏi hệ thống.
- Hỗ trợ nhiều định dạng kết quả để phù hợp với các nhu cầu học tập và biên soạn học liệu.
- Tái sử dụng kết quả tìm kiếm trong trải nghiệm học tập hoặc tra cứu nội dung liên quan.

## Thành phần liên quan

### Frontend

- `frontend/app/web-search/page.tsx`
- `frontend/lib/api.ts`
- `frontend/types/index.ts`
- `frontend/components/layout/sidebar.tsx`

### Backend

- `backend/app/api/routes/web_search.py`
- `backend/app/api/router.py`

## Luồng hoạt động

1. Người dùng mở trang `Search Website Online` từ sidebar.
2. Người dùng nhập từ khóa tìm kiếm.
3. Frontend gọi hàm `searchDuckDuckGo(query, searchType, maxResults)`.
4. API frontend gửi request `GET /api/web-search/duckduckgo`.
5. Backend phân nhánh xử lý theo `type`:
   - `text`, `news`, `images`, `videos`: dùng `DDGS`
   - `books`: dùng Google Books API
6. Backend trả về danh sách kết quả dạng JSON.
7. Frontend render kết quả theo từng loại giao diện riêng.

## Các loại tìm kiếm hiện đang hỗ trợ

- `text`: kết quả web/text thông thường
- `news`: tin tức
- `images`: hình ảnh
- `videos`: video
- `books`: sách từ Google Books API

## Hành vi hiện tại của UI

- Có ô nhập từ khóa và nút tìm kiếm.
- Có tab đổi loại tìm kiếm.
- Có bộ chọn số lượng kết quả tối đa: `5`, `10`, `20`, `50`.
- Sau khi đã tìm kiếm, nếu đổi tab hoặc đổi `maxResults`, hệ thống sẽ tự động gọi lại tìm kiếm với cùng từ khóa hiện tại.
- Có trạng thái:
  - chưa tìm kiếm
  - đang tải
  - lỗi
  - không có kết quả
  - có kết quả

## Đánh giá chức năng

### Điểm tốt

- Luồng sử dụng đơn giản, dễ hiểu.
- Backend tách riêng route tìm kiếm web, dễ mở rộng thêm provider sau này.
- Hỗ trợ nhiều loại nội dung hơn một text search thông thường.
- Tìm kiếm sách có dữ liệu phong phú hơn nhờ lấy từ Google Books.
- Có fallback cho trường hợp Google Books lỗi.
- Có skeleton loading và empty state cơ bản.

### Hạn chế hiện tại

- Dữ liệu trả về giữa các loại tìm kiếm chưa có schema thống nhất.
- Frontend đang phụ thuộc nhiều vào `Record<string, any>`, nên khó kiểm soát chất lượng dữ liệu và dễ phát sinh lỗi giao diện.
- Chuỗi tiếng Việt trong file UI và backend hiện đã được chuẩn hóa và hiển thị chính xác.
- Các danh sách kết quả đang dùng `index` làm `key`, có thể gây render không ổn định khi dữ liệu thay đổi.
- Chưa có cơ chế hủy request cũ hoặc chống race condition khi người dùng đổi tab/liên tục thao tác nhanh.
- Chưa có phân trang hoặc tải thêm kết quả.
- Chưa có tracking/copy/open link analytics.
- Chưa có test chuyên biệt cho trang `web-search` theo từng loại kết quả.

## Review kỹ thuật

### 1. Rủi ro trung bình: typing quá lỏng cho dữ liệu kết quả

Trong `frontend/types/index.ts`, kiểu dữ liệu đang là:

```ts
export type DuckDuckGoSearchItem = Record<string, any>;
```

Điều này làm frontend không có hợp đồng dữ liệu rõ ràng cho từng loại search.

Tác động:

- Khó bảo trì.
- Dễ render sai field.
- IDE và TypeScript gần như không hỗ trợ kiểm soát an toàn kiểu dữ liệu.

Khuyến nghị:

- Tạo union type riêng cho `text`, `news`, `images`, `videos`, `books`.
- Chuẩn hóa payload backend theo schema thống nhất hơn.

### 2. Rủi ro trung bình: dùng `index` làm `key` khi render list

Các block render kết quả đang dùng `key={index}`.

Tác động:

- Có thể gây lỗi cập nhật UI khi dữ liệu thay đổi.
- Không tối ưu cho React reconciliation.

Khuyến nghị:

- Ưu tiên dùng `id`, `url`, `href`, hoặc tổ hợp định danh ổn định hơn.

### 4. Rủi ro trung bình: chưa xử lý race condition khi đổi tab nhanh

Frontend gọi lại `handleSearch()` khi `searchType` hoặc `maxResults` đổi sau lần tìm đầu tiên.

Tác động:

- Nếu người dùng đổi tab nhanh liên tiếp, response cũ có thể ghi đè response mới.
- Trạng thái kết quả có thể không đúng với tab đang active.

Khuyến nghị:

- Dùng `AbortController` hoặc cơ chế request token/latest request wins.

### 5. Rủi ro thấp đến trung bình: fallback dữ liệu còn thiếu nhất quán

Khi Google Books lỗi, backend fallback sang `ddgs.text(f"{query} books")`, nhưng shape dữ liệu fallback không phong phú như shape chuẩn của Google Books.

Tác động:

- UI sách có thể hiển thị thiếu field.
- Trải nghiệm không đồng nhất giữa các lần tìm.

Khuyến nghị:

- Chuẩn hóa lại object fallback để tương thích với renderer của `books`.

### 6. Khoảng trống test

Hiện chưa thấy test chuyên biệt cho:

- route `/web-search/duckduckgo`
- từng loại kết quả
- trạng thái lỗi khi provider ngoài không phản hồi
- tự động search lại khi đổi tab hoặc `maxResults`

Khuyến nghị:

- Bổ sung unit test backend cho từng `search_type`
- Bổ sung integration/UI test cho trang `web-search`

## API hiện tại

### Frontend

```ts
searchDuckDuckGo(query: string, searchType: DuckDuckGoSearchType, maxResults: number)
```

### Backend

```http
GET /api/web-search/duckduckgo?q=<keyword>&type=<text|news|images|videos|books>&max_results=<1..50>
```

## Giới hạn hiện tại

- Phụ thuộc vào provider bên ngoài:
  - DuckDuckGo Search
  - Google Books API
- `max_results` bị giới hạn từ `1` đến `50`
- Chưa có phân trang
- Chưa có bộ lọc nâng cao
- Chưa có lưu lịch sử tìm kiếm

## Đề xuất cải tiến

### Ưu tiên cao

- Chuẩn hóa type dữ liệu cho từng loại search
- Thêm cơ chế chống race condition
- Chuẩn hóa shape fallback của `books`

### Ưu tiên trung bình

- Thêm phân trang hoặc `load more`
- Thêm logging lỗi provider
- Bổ sung test backend và frontend

### Ưu tiên thấp

- Lưu lịch sử tìm kiếm
- Gợi ý từ khóa
- Cho phép copy link hoặc mở nhanh theo nhóm

## Kết luận

Chức năng `Search Website Online` hiện đã hoạt động được ở mức sử dụng thực tế, có đủ luồng nhập từ khóa, đổi loại tìm kiếm, hiển thị nhiều dạng kết quả và kết nối backend rõ ràng. Tuy nhiên, chất lượng hoàn thiện vẫn còn không gian để nâng cấp tiếp, đặc biệt là typing dữ liệu, test và cơ chế ổn định request khi người dùng thao tác nhanh. Nếu xử lý 2 nhóm vấn đề chính là `schema dữ liệu` và `ổn định request`, đây sẽ là một chức năng khá tốt và đủ nền tảng để mở rộng tiếp.
