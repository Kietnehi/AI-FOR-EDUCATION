# Notification System - Hướng dẫn sử dụng

## ✅ Notification bell đã hoạt động!

Tôi đã implement hệ thống thông báo hoàn chỉnh cho web của bạn. Đây là những gì đã được làm:

### 📋 Đã tạo các file mới:

1. **`frontend/components/notification-provider.tsx`**
   - Context provider để quản lý state notifications
   - Theo dõi số lượng thông báo chưa đọc
   - Các hàm: add, mark as read, mark all read, remove, clear all

2. **`frontend/components/notification-dropdown.tsx`**
   - Dropdown panel hiển thị danh sách thông báo
   - Hiển thị badge số lượng chưa đọc trên bell icon
   - Cho phép đánh dấu đã đọc/xóa từng cái hoặc tất cả
   - Hiển thị thời gian tương đối (vd: "5 phút trước")

3. **`frontend/components/use-notify.ts`**
   - Hook tiện lợi để gửi thông báo từ bất kỳ component nào
   - Methods: `notify.success()`, `notify.error()`, `notify.info()`, `notify.warning()`

### 🔧 Đã cập nhật các file:

1. **`frontend/app/layout.tsx`**
   - Wrapped app với `NotificationProvider`

2. **`frontend/components/layout/topbar.tsx`**
   - Bell button giờ đây có click handler
   - Hiển thị badge động với số thông báo chưa đọc
   - Mở dropdown khi click

3. **`frontend/types/index.ts`**
   - Fixed type errors (added `knowledge_graph`, made `sources` optional)

4. **`frontend/components/3d/floating-mascot.tsx`**
   - Fixed type error for `model_used`

### 🎯 Cách sử dụng notification system:

#### Trong bất kỳ component nào:

```tsx
"use client";
import { useNotify } from "@/components/use-notify";

export default function MyComponent() {
  const { notify, success, error, info, warning } = useNotify();

  // Cách 1: Dùng helper methods
  const handleSuccess = () => {
    success("Tạo học liệu thành công!");
  };

  const handleError = () => {
    error("Có lỗi xảy ra khi xử lý!");
  };

  const handleInfo = () => {
    info("Đang xử lý tài liệu...");
  };

  const handleWarning = () => {
    warning("File vượt quá 10MB!");
  };

  // Cách 2: Dùng notify trực tiếp với custom title
  const handleCustom = () => {
    notify("Nội dung thông báo", "success", "Tiêu đề tùy chỉnh");
  };

  return (
    <div>
      <button onClick={handleSuccess}>Test Success</button>
      <button onClick={handleError}>Test Error</button>
      <button onClick={handleInfo}>Test Info</button>
      <button onClick={handleWarning}>Test Warning</button>
    </div>
  );
}
```

### 🧪 Để test ngay:

Bạn có thể test notification system bằng cách:

1. **Mở browser console** (F12)
2. **Chạy code này** để thêm thông báo demo:

```javascript
// Sẽ hiển thị sau khi bạn start server
// Code example để test từ console sẽ cần thêm setup
```

Hoặc đơn giản hơn, thêm thông báo demo vào dashboard page.

### 📊 Notification types:

| Type | Color | Use Case |
|------|-------|----------|
| `success` | Green | Tạo học liệu thành công, upload thành công |
| `error` | Red | Lỗi xử lý, lỗi upload |
| `info` | Blue | Thông tin chung, đang xử lý |
| `warning` | Amber | Cảnh báo, cần chú ý |

### 🎨 Features:

✅ Badge động hiển thị số thông báo chưa đọc  
✅ Dropdown panel với animation  
✅ Mark as read/unread  
✅ Mark all as read  
✅ Delete individual notifications  
✅ Clear all notifications  
✅ Time formatting (Vietnamese)  
✅ Responsive design  
✅ Dark mode support  
✅ Type-safe với TypeScript  

### 🚀 Next steps (optional):

Để tích hợp notification vào các actions hiện tại (upload, generate, etc.), bạn có thể:

1. Mở file cần thêm notification (vd: `app/materials/upload/page.tsx`)
2. Import hook: `import { useNotify } from "@/components/use-notify";`
3. Sử dụng: `const { success, error } = useNotify();`
4. Thay thế `setToast()` bằng `success()` hoặc `error()`

Ví dụ:
```tsx
// Old code:
setToast({ message: "Tạo học liệu thành công!", type: "success" });

// New code:
success("Tạo học liệu thành công!");
```
