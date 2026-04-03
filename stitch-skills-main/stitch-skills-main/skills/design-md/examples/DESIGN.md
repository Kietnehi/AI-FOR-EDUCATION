# Design System Specification: AI Learning Studio

## 1. Overview & Creative North Star
The Creative North Star for this design system is **"Soft Brutalism with a Tech-Forward Edge."**
This is a modern EdTech/AI SaaS interface. We want a clean, highly functional workspace that feels substantial but not overpowering. The style relies on distinct structural boundaries (thicker borders, soft but intentional shadows) combined with rounded friendly shapes (pill-shaped buttons) to balance the "tech" with "human learning mechanics."

## 2. Layout & Global Rules
The interface is structured as a professional learning workspace with three main regions:

*   **Header (Topbar):** Global navigation, search, and user actions.
*   **Sidebar (Left):** Primary app navigation.
*   **Main Workspace (Center/Right):** The core active area divided into actionable blocks.

**UX / Soft Brutalism Principles:**
*   **Borders:** Use thicker borders (e.g., `2px` or `border-2`) with `#e2e8f0` (slate-200) to define distinct blocks and cards, giving a solid "brutalist" structure.
*   **Shadows:** Use soft, crisp shadows (`shadow-sm` or a custom `box-shadow: 2px 2px 0px rgba(0,0,0,0.05)`) rather than heavy blurred drop-shadows.
*   **Shapes:** Maximize contrast in shapes. Use `rounded-full` (pill shape) for primary buttons, chips, and search bars. Use `rounded-2xl` for main content cards to soften the rigid borders.
*   **Interactivity:** Ensure all clickable elements respond. Cards should scale slightly (`scale-[1.02]`) and increase shadow on hover.

## 3. Colors & Atmospheric Depth
Our palette is built for long learning sessions—clean and bright, but easy on the eyes.

*   **Background:** `#F8FAFC` (`slate-50`) - A slightly off-white, cool canvas for the main workspace.
*   **Surface/Cards:** `#FFFFFF` (White) - Clean white for cards and readable areas to pop against the background.
*   **Primary Active Color:** `#A1E8AF` - A fresh, distinct mint green. Used explicitly for **Active States** (like active sidebar items) and progress fills.
*   **Text/Ink:** `#0F172A` (`slate-900`) for primary text (Headings). `#475569` (`slate-600`) for secondary/body text.
*   **Borders:** `#E2E8F0` (`slate-200`) for structural separation.

## 4. Typography
*   **Display/Headlines:** `Space Grotesk` or `Inter` font for a modern, slightly technical feel.
*   **Body:** `Inter` for maximum legibility in dense learning scenarios.

## 5. Component Structure (The Blueprint)

### 1. Header (Topbar)
*   **Layout:** Fixed top, full width. `bg-white`, `border-b-2 border-slate-200`.
*   **Left:** Logo ("AI Learning Studio").
*   **Center:** Search bar ("Tìm kiếm học liệu, nội dung..."). Wide layout, `rounded-full` (pill-shaped).
*   **Right (Quick Actions):**
    *   Dark mode toggle, notification icon, user avatar.

### 2. Sidebar (Left - Primary Navigation)
*   **Layout:** Fixed left side, full height under header. `bg-white`, `border-r-2 border-slate-200`.
*   **Items (Exactly matching functions):** 
    1. Dashboard
    2. Học liệu
    3. Tải lên
    4. Tạo Video AI
    5. Chatbot RAG
    6. Search Website Online
    7. Nội dung AI
    8. Chuyển đổi & trích xuất
    9. Cài đặt (at the bottom)
*   **UX/Styling:**
    *   Flex row layout for links: Icon + Label.
    *   **Active State:** Background `bg-[#A1E8AF]`, text color `text-slate-900` (bold), shape `rounded-xl`.
    *   **Hover State:** `bg-slate-100` for inactive items, `rounded-xl`.

### 3. Main Workspace (Center - Dashboard Layout)
This is a scrollable area, visually distinct with `bg-slate-50`. Divided into main sections:

#### Block A: Hero Banner (Top)
*   **Style:** Large container, rounded-2xl, soft-brutalism 2px border. Can use a gradient or Solid Dark color to contrast with the light theme.
*   **Content:** Headline "Tạo học liệu thông minh với AI". Subtext describing features (Upload PDF, generate podcast, minigames, bots).
*   **Buttons:** "Tải lên học liệu" (Primary pill button), "Xem tất cả" (Secondary).

#### Block B: Showcase / Video Introduction (Center)
*   **Style:** Title "Showcase - Video giới thiệu". Subtitle on how it works.
*   **Content:** A large video placeholder card, rounded-2xl, 2px border, containing a visual player mockup.

#### Block C: Features Grid / Quick Tools (Bottom)
*   **Style:** Grid of cards representing the tools (Học liệu, Tạo Video AI, Chatbot, etc.). Soft drop-shadow, scaling on hover.

### 4. Footer (Mini)
*   **Layout:** Minimalist, situated at the bottom of the Sidebar or bottom of the Main Workspace list.
*   **Content:** App Version, Docs, Support links.
*   **Styling:** Small text (`text-xs` or `text-sm`), muted `text-slate-400`, minimal spacing.
