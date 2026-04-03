# Design System Document: Soft Brutalism & The Tech-Forward Edge

## 1. Overview & Creative North Star
**The Creative North Star: "The Neo-Technical Archive"**

This design system moves away from the "airy-nothingness" of generic SaaS and moves toward a high-end, editorial aesthetic. It is a dialogue between the raw, structural honesty of Brutalism and the fluid, organic intelligence of AI. By pairing heavy 2px strokes with ultra-rounded "pill" geometry, we create an interface that feels like a physical, premium tool—authoritative yet approachable.

The "template" look is avoided through intentional white space, high-contrast typography scaling, and "The Layering Principle," ensuring that the AI Learning Studio feels like a curated workspace rather than a cluttered dashboard.

---

## 2. Colors & Surface Philosophy

### The Palette
The color logic leverages a sophisticated "Slate" foundation to allow the **Mint Green (#A1E8AF)** to act as a high-frequency signal for progress and intelligence.

*   **Background (`#f5f7f9` / slate-50):** The base canvas.
*   **Surface (`#ffffff`):** Reserved for primary interactive cards and containers.
*   **Primary Mint (`#A1E8AF`):** Used for "Active State" signatures, progress bars, and "AI Thinking" indicators.
*   **Structural Slate (`#e2e8f0` / slate-200):** Used for the signature 2px borders.

### The "No-Line" Rule (Internal)
While 2px borders are used for major containers (Cards, Sidebars), **prohibit 1px solid borders for internal sectioning.** 
*   **Rule:** To separate content *within* a card or section, use vertical white space or a subtle shift to `surface-container-low`. 
*   **Nesting:** Depth is created by stacking. A `surface-container-lowest` card (white) should sit on a `surface-container-low` section (slate-50) to create a natural lift.

### Glassmorphism & Texture
For floating elements like "Tool Tips" or "Floating Action Menus," use **Backdrop Blur (12px)** with a semi-transparent `surface` color (80% opacity). Main CTA buttons should utilize a subtle linear gradient from `primary` to `primary_container` to provide a "tactile glow" that flat color cannot achieve.

---

## 3. Typography: The Editorial Contrast

This system utilizes a high-contrast pairing to distinguish between "Action" and "Content."

*   **Display & Headlines (Space Grotesk):** This typeface provides the "Tech-Forward Edge." It is geometric, wide, and evokes a sense of modern engineering. Use `display-lg` for hero AI moments and `headline-sm` for tool titles.
*   **Body & Labels (Inter):** The "Workhorse." Inter provides maximum legibility for RAG chatbot responses and technical settings. 

**Hierarchy Tip:** Use `label-md` in all-caps with 0.05em letter spacing for sidebar categories to create an authoritative, architectural feel.

---

## 4. Elevation, Depth & The 2px Border

In this design system, we do not hide our structure; we celebrate it.

*   **The Structural Accent:** All primary cards and the main sidebar must use a **2px border (`#e2e8f0`)**. This creates the "Soft Brutalist" weight.
*   **Ambient Shadows:** Use shadows sparingly. When required, use a "Crisp-Soft" shadow:
    *   `box-shadow: 0px 4px 20px 0px rgba(15, 23, 42, 0.06);`
    *   The shadow should feel like a soft glow of light blocked by a thick piece of cardstock.
*   **The "Ghost Border" Fallback:** If a secondary element needs containment without adding visual weight, use the `outline-variant` at 10% opacity. Never use 100% opaque thin lines.

---

## 5. Components

### Pill Buttons & Search
*   **Geometry:** Always `rounded-full`. 
*   **Primary Button:** Background `primary`, text `on_primary_fixed`, 2px border of `primary_dim`.
*   **Search Bar:** `rounded-full`, 2px slate-200 border. On focus, the border transitions to Mint Green.

### The AI Navigation Sidebar
The sidebar is the "Control Tower" for the studio.
*   **Items:** (Dashboard, Học liệu, Tải lên, Tạo Video AI, Chatbot RAG, Search Website Online, Nội dung AI, Chuyển đổi & trích xuất, Cài đặt).
*   **Active State:** The active item should use a Mint Green (`#A1E8AF`) pill background with a high-contrast `on_primary_fixed` text.
*   **Spacing:** Use "generous breathing room" (12px vertical gap between items) to maintain the editorial look.

### Cards & AI Tool Modules
*   **Border-Radius:** `2xl` (1rem to 1.5rem).
*   **Structure:** No internal dividers. Use `title-md` (Inter) for headers and `body-sm` (Inter) for metadata.
*   **Interaction:** On hover, the 2px border should shift from slate-200 to Mint Green, and the ambient shadow should slightly deepen.

### Input Fields
*   **Style:** Minimalist. No background fill—only a 2px bottom border or a full 2px pill-shaped border for search.
*   **Error State:** Border transitions to `error` (#b31b25), with a soft `error_container` glow.

---

## 6. Do’s and Don’ts

### Do:
*   **Do** use asymmetrical layouts for Hero sections (e.g., text left-aligned, AI visual overlapping the right container edge).
*   **Do** use the Mint Green for "Success" and "AI Activity" pulses.
*   **Do** embrace large margins. If it feels too empty, add more margin.

### Don't:
*   **Don't** use 1px borders. They look "cheap" and "default."
*   **Don't** use pure black for text. Use `on_surface` (Slate-900 equivalent) to keep the "Soft" in Soft Brutalism.
*   **Don't** use sharp corners. Everything in the AI Learning Studio is built to be touched; keep the `2xl` and `full` radii consistent.
*   **Don't** use standard "Drop Shadows." If the shadow isn't diffused and subtle, it doesn't belong here.