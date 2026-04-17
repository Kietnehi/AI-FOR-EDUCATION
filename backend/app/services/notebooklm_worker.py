import json
import re
import shutil
import sys
from datetime import datetime
from pathlib import Path


def _sanitize_file_name(value: str) -> str:
    cleaned = re.sub(r"[\\/*?:\"<>|]", "", value).strip().replace(" ", "_")
    cleaned = re.sub(r"_+", "_", cleaned)
    if not cleaned:
        return "artifact"
    return cleaned[:80]


def _is_notebook_ready(page) -> bool:
    create_button = page.locator("button:has-text('Tạo'), [role='button']:has-text('Tạo')").first
    upload_button = page.locator("button:has-text('Tải tệp lên'), [role='button']:has-text('Tải tệp lên')").first
    return create_button.is_visible() or upload_button.is_visible()


def _wait_for_notebook_ready(page, timeout_ms: int) -> bool:
    elapsed_ms = 0
    step_ms = 1000
    while elapsed_ms < timeout_ms:
        if _is_notebook_ready(page):
            return True
        page.wait_for_timeout(step_ms)
        elapsed_ms += step_ms
    return False


def _ensure_logged_in(page) -> None:
    if _wait_for_notebook_ready(page, timeout_ms=12000):
        return

    if _wait_for_notebook_ready(page, timeout_ms=288000):
        return

    raise RuntimeError(
        "Không phát hiện NotebookLM sẵn sàng trong thời gian chờ. "
        "Vui lòng đăng nhập Google trên profile đã cấu hình và thử lại."
    )


def _create_notebook(page) -> None:
    create_btn = page.locator("button:has-text('Tạo'), [role='button']:has-text('Tạo')").first
    create_btn.wait_for(state="visible", timeout=30000)
    create_btn.click()
    page.wait_for_timeout(1200)


def _upload_source(page, source_path: str) -> None:
    upload_target = page.locator("button:has-text('Tải tệp lên'), [role='button']:has-text('Tải tệp lên')").first
    upload_target.wait_for(state="visible", timeout=30000)
    with page.expect_file_chooser() as chooser_info:
        upload_target.click()
    chooser = chooser_info.value
    chooser.set_files([source_path])
    page.wait_for_timeout(2000)


def _close_stray_tabs(context, main_page) -> None:
    for tab in list(context.pages):
        if tab == main_page:
            continue
        try:
            tab.close()
        except Exception:
            continue


def _click_scoped_create_button(page, artifact_label: str) -> bool:
    artifact_key = artifact_label.strip().lower()
    dialogs = page.locator("[role='dialog'], [aria-modal='true']")

    for i in range(dialogs.count()):
        dialog = dialogs.nth(i)
        try:
            if not dialog.is_visible():
                continue
            dialog_text = dialog.inner_text().lower()
            if artifact_key not in dialog_text:
                continue
            create_btn = dialog.locator("button:has-text('Tạo'), [role='button']:has-text('Tạo')").first
            if create_btn.is_visible():
                create_btn.click(force=True)
                return True
        except Exception:
            continue

    scoped_btn = page.locator(
        f"[aria-label*='{artifact_label}'] button:has-text('Tạo'), "
        f"[aria-label*='{artifact_label}'] [role='button']:has-text('Tạo')"
    ).first
    try:
        if scoped_btn.is_visible():
            scoped_btn.click(force=True)
            return True
    except Exception:
        return False
    return False


def _activate_artifact_creation(page, context, artifact_label: str, selectors: list[str]) -> None:
    trigger = None
    for selector in selectors:
        candidate = page.locator(selector).last
        try:
            candidate.wait_for(state="visible", timeout=3500)
            trigger = candidate
            break
        except Exception:
            continue

    if trigger is None:
        raise RuntimeError(f"Không tìm thấy artifact: {artifact_label}")

    trigger.scroll_into_view_if_needed()
    trigger.click(force=True)
    _close_stray_tabs(context, page)
    page.wait_for_timeout(800)
    _click_scoped_create_button(page, artifact_label)


def _extract_artifact_title(menu_button, fallback_index: int) -> str:
    fallback = f"artifact_{fallback_index}"
    try:
        raw_text = menu_button.evaluate(
            """
            (el) => {
                let current = el;
                for (let j = 0; j < 6; j++) {
                    if (!current.parentElement) {
                        break;
                    }
                    current = current.parentElement;
                    const titleNode = current.querySelector('.artifact-title');
                    if (titleNode && titleNode.innerText) {
                        return titleNode.innerText.trim();
                    }
                }
                return null;
            }
            """
        )
        if not raw_text:
            return fallback
        return raw_text
    except Exception:
        return fallback


def _download_artifacts(page, target_dir: Path) -> int:
    menu_dots = page.locator(
        ".studio-card button[aria-haspopup='menu'], .studio-card button[aria-label*='Xem thêm']"
    )
    if menu_dots.count() == 0:
        menu_dots = page.locator("button[aria-haspopup='menu'], button[aria-label*='Xem thêm']")

    total_items = menu_dots.count()
    if total_items == 0:
        return 0

    downloaded_count = 0

    for i in range(total_items):
        try:
            current_dot = menu_dots.nth(i)
            current_dot.scroll_into_view_if_needed()
            artifact_title = _extract_artifact_title(current_dot, i + 1)
            current_dot.click(delay=150)
            page.wait_for_timeout(700)

            download_btn = page.locator(
                "div[role='menuitem']:has-text('Tải xuống'), "
                "span:has-text('Tải xuống'), "
                "button:has-text('Tải xuống')"
            ).last

            if not download_btn.is_visible():
                page.keyboard.press("Escape")
                continue

            with page.expect_download() as download_info:
                download_btn.click(delay=150)

            download = download_info.value
            extension = Path(download.suggested_filename).suffix or ".bin"
            safe_title = _sanitize_file_name(artifact_title)
            output_file = target_dir / f"{i + 1}_{safe_title}{extension}"
            download.save_as(str(output_file))
            downloaded_count += 1
            page.wait_for_timeout(1000)
        except Exception:
            pass
        finally:
            try:
                page.keyboard.press("Escape")
            except Exception:
                pass
            page.wait_for_timeout(400)

    return downloaded_count


def _organize_downloaded_files(video_dir: Path, infographic_dir: Path) -> None:
    image_extensions = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".svg"}
    for item in video_dir.iterdir():
        if not item.is_file():
            continue
        if item.suffix.lower() not in image_extensions:
            continue
        destination = infographic_dir / item.name
        if destination.exists():
            destination = infographic_dir / f"{item.stem}_{datetime.utcnow().strftime('%H%M%S')}{item.suffix}"
        shutil.move(str(item), str(destination))


def _run(payload: dict) -> dict:
    from playwright.sync_api import sync_playwright

    session_id = payload["session_id"]
    source_file = payload["source_file"]
    user_data_dir = payload["user_data_dir"]
    headless = bool(payload.get("headless", False))
    generate_wait_seconds = int(payload.get("generate_wait_seconds", 120))
    temp_root = Path(payload["temp_dir"])

    session_video_dir = temp_root / session_id / "videos"
    session_infographic_dir = temp_root / session_id / "infographics"
    session_video_dir.mkdir(parents=True, exist_ok=True)
    session_infographic_dir.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as playwright:
        context = playwright.chromium.launch_persistent_context(
            user_data_dir=user_data_dir,
            headless=headless,
            args=["--start-maximized", "--disable-blink-features=AutomationControlled"],
        )
        page = context.pages[0] if context.pages else context.new_page()

        try:
            page.goto("https://notebooklm.google.com/", wait_until="domcontentloaded")
            _ensure_logged_in(page)
            _create_notebook(page)
            _upload_source(page, source_file)

            page.wait_for_timeout(10000)
            _activate_artifact_creation(
                page,
                context,
                artifact_label="Tổng quan bằng video",
                selectors=[
                    "[aria-label*='Tổng quan bằng video']",
                    "div[role='button']:has-text('Tổng quan bằng video')",
                    "button:has-text('Tổng quan bằng video')",
                ],
            )

            page.wait_for_timeout(2500)
            _activate_artifact_creation(
                page,
                context,
                artifact_label="Bản đồ hoạ thông tin",
                selectors=[
                    "div[aria-label='Bản đồ hoạ thông tin']",
                    "[role='button']:has-text('Bản đồ hoạ thông tin')",
                    "button:has-text('Bản đồ hoạ thông tin')",
                ],
            )

            page.wait_for_timeout(max(generate_wait_seconds, 30) * 1000)
            _download_artifacts(page, session_video_dir)
            _organize_downloaded_files(session_video_dir, session_infographic_dir)
        finally:
            context.close()

    return {
        "session_id": session_id,
        "videos_count": len(list(session_video_dir.glob("*"))),
        "infographics_count": len(list(session_infographic_dir.glob("*"))),
    }


def main() -> None:
    try:
        raw = sys.stdin.read().strip()
        if not raw:
            raise RuntimeError("Worker không nhận được input payload")
        payload = json.loads(raw)
        result = _run(payload)
        print(json.dumps(result, ensure_ascii=False))
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        raise


if __name__ == "__main__":
    main()
