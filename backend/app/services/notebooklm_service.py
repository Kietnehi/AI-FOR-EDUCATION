import asyncio
from concurrent.futures import ThreadPoolExecutor
import json
import os
import re
import shutil
import signal
import subprocess
import sys
import time
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from urllib.parse import urlparse

from app.core.config import settings
from app.core.logging import logger
from app.services import notebooklm_worker
from app.services.storage import storage_service


# In-memory storage for active browser sessions
_active_sessions: dict[str, dict] = {}


class NotebookLMService:
    VIDEO_DIR = Path(settings.generated_dir) / "notebooklm" / "videos"
    INFOGRAPHIC_DIR = Path(settings.generated_dir) / "notebooklm" / "infographics"
    TEMP_DIR = Path("./storage") / "notebooklm" / "temp"
    SESSION_STALE_MINUTES = 20

    async def generate_media(self, prompt: str) -> dict:
        """Start NotebookLM flow and stop after upload for user confirmation."""
        return await self._generate_media_async(prompt)

    async def generate_media_for_material(self, material: dict, guidance: str | None = None) -> dict:
        """Start NotebookLM flow from material and stop after upload for user confirmation."""
        return await self._generate_media_from_material_async(material, guidance)

    async def confirm_artifact_generation(self, session_id: str) -> dict:
        """Confirm and trigger video + infographic generation on NotebookLM."""
        return await self._confirm_artifact_generation_async(session_id)

    async def confirm_download(self, session_id: str) -> dict:
        """Move files from temp to permanent storage and return final URLs."""
        return await self._confirm_download_async(session_id)

    async def cancel_session(self, session_id: str) -> dict:
        """Delete temp session files."""
        return await self._cancel_session_async(session_id)

    def get_session_data(self, session_id: str) -> dict | None:
        """Get data for an active session."""
        return _active_sessions.get(session_id)

    async def _generate_media_from_material_async(self, material: dict, guidance: str | None = None) -> dict:
        # Get the original source file from material
        file_url = material.get("file_url")
        if not file_url:
            raise RuntimeError("Học liệu không có file gốc. Vui lòng upload file PDF/DOCX.")

        # Extract the stored filename from URL format: /api/files/{filename}/download
        stored_filename = self._extract_stored_filename(file_url)
        if not stored_filename:
            raise RuntimeError("Không thể xác định file gốc từ URL")

        # Get the source file path
        source_file = Path(settings.upload_dir) / stored_filename
        if not source_file.exists():
            object_name = storage_service.extract_object_name(file_url)
            if storage_service.enabled and object_name:
                await storage_service.download_file(
                    object_name,
                    str(source_file),
                    storage_type=storage_service.detect_storage_type(file_url),
                )
            if not source_file.exists():
                raise RuntimeError(f"File gốc không tồn tại: {stored_filename}")

        material_title = (material.get("title") or "Học liệu").strip()
        prompt = f"{material_title}"
        if guidance:
            prompt = f"{prompt} | Yêu cầu thêm: {guidance.strip()}"

        self._ensure_output_dirs()
        return await self._prepare_notebooklm_session(
            prompt=prompt,
            source_file=source_file,
            material_id=material.get("id"),
            preferred_storage_type=storage_service.default_storage_type(),
        )

    async def _generate_media_async(self, prompt: str) -> dict:
        self._ensure_output_dirs()
        source_file = self._create_prompt_source(prompt)
        return await self._prepare_notebooklm_session(
            prompt=prompt,
            source_file=source_file,
            material_id=None,
            preferred_storage_type=storage_service.default_storage_type(),
        )

    @staticmethod
    def _extract_stored_filename(file_url: str) -> str | None:
        normalized = (file_url or "").strip()
        if not normalized:
            return None

        parsed = urlparse(normalized)
        path = parsed.path or normalized

        if "/api/files/" in path and path.endswith("/download"):
            remainder = path.split("/api/files/", 1)[1].rsplit("/download", 1)[0].strip("/")
            return Path(remainder).name if remainder else None

        if "/uploads/" in path:
            remainder = path.split("/uploads/", 1)[1].strip("/")
            return Path(remainder).name if remainder else None

        filename = Path(path).name
        return filename or None

    async def _prepare_notebooklm_session(
        self,
        prompt: str,
        source_file: Path,
        material_id: str | None,
        preferred_storage_type: str | None,
    ) -> dict:
        """Open NotebookLM, create notebook, upload source, then wait for artifact confirmation."""
        self._ensure_single_active_session()
        session_id = str(uuid.uuid4())
        session_profile_dir = self._session_profile_dir(session_id)
        session_profile_dir.mkdir(parents=True, exist_ok=True)

        # Uvicorn on Windows often runs selector loop where asyncio subprocess is
        # unsupported. Use sync Playwright in-process to preserve interactive
        # confirmations instead of one-shot worker fallback.
        loop_name = type(asyncio.get_running_loop()).__name__.lower()
        if sys.platform == "win32" and "selector" in loop_name:
            executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix=f"notebooklm-{session_id[:8]}")
            logger.warning(
                "Playwright async transport is not supported by event loop %s; "
                "using sync Playwright interactive mode for session %s",
                loop_name,
                session_id,
            )
            try:
                result = await asyncio.get_running_loop().run_in_executor(
                    executor,
                    self._prepare_notebooklm_session_sync,
                    session_id,
                    prompt,
                    source_file,
                    material_id,
                    preferred_storage_type,
                )
                session_data = _active_sessions.get(session_id)
                if session_data is not None:
                    session_data["executor"] = executor
                else:
                    executor.shutdown(wait=False, cancel_futures=True)
                return result
            except Exception:
                executor.shutdown(wait=False, cancel_futures=True)
                raise

        try:
            from playwright.async_api import async_playwright
        except Exception as exc:  # pragma: no cover - import guard
            raise RuntimeError(
                "Playwright chưa được cài trong backend environment. "
                "Hãy chạy: pip install playwright && playwright install chrome"
            ) from exc

        # Create a persistent playwright instance and keep it alive.
        # On some Windows loop setups, asyncio subprocess is not available.
        try:
            playwright = await async_playwright().start()
        except NotImplementedError:
            logger.warning(
                "Playwright async transport is not supported by current event loop; "
                "falling back to isolated worker process for session %s",
                session_id,
            )
            await asyncio.to_thread(self._run_worker_subprocess_sync, prompt, source_file, session_id)
            return {
                "session_id": session_id,
                "material_id": material_id,
                "prompt": prompt,
                "notebook_title": self._build_notebook_title(prompt),
                "status": "generation_complete",
                "message": "Đã tạo xong ở chế độ worker fallback. Vui lòng xác nhận để tải xuống.",
            }

        context = await self._launch_async_context_with_recovery(playwright, session_profile_dir)
        page = context.pages[0] if context.pages else await context.new_page()

        try:
            await page.goto("https://notebooklm.google.com/", wait_until="domcontentloaded")
            await self._ensure_logged_in(page)
            await self._create_notebook(page)
            await self._upload_source(page, str(source_file))

            # Store browser session after upload; artifact generation is a separate confirmed step.
            _active_sessions[session_id] = {
                "playwright": playwright,
                "context": context,
                "page": page,
                "prompt": prompt,
                "material_id": material_id,
                "preferred_storage_type": preferred_storage_type,
                "profile_dir": str(session_profile_dir),
                "stage": "uploaded",
                "mode": "async",
                "created_at": datetime.utcnow(),
            }

            logger.info("✅ NotebookLM upload complete for session %s. Waiting for artifact confirmation.", session_id)

        except Exception as exc:
            # Clean up on error
            try:
                await context.close()
                await playwright.stop()
            except Exception:
                pass
            raise exc

        return {
            "session_id": session_id,
            "material_id": material_id,
            "prompt": prompt,
            "notebook_title": self._build_notebook_title(prompt),
            "status": "awaiting_artifact_confirmation",
            "message": "Đã upload tài liệu lên NotebookLM. Xác nhận để bấm tạo Video + Infographic.",
        }

    def _prepare_notebooklm_session_sync(
        self,
        session_id: str,
        prompt: str,
        source_file: Path,
        material_id: str | None,
        preferred_storage_type: str | None,
    ) -> dict:
        from playwright.sync_api import sync_playwright

        playwright = sync_playwright().start()
        session_profile_dir = self._session_profile_dir(session_id)
        session_profile_dir.mkdir(parents=True, exist_ok=True)
        context = self._launch_sync_context_with_recovery(playwright, session_profile_dir)
        page = context.pages[0] if context.pages else context.new_page()

        try:
            page.goto("https://notebooklm.google.com/", wait_until="domcontentloaded")
            notebooklm_worker._ensure_logged_in(page)
            notebooklm_worker._create_notebook(page)
            notebooklm_worker._upload_source(page, str(source_file))

            _active_sessions[session_id] = {
                "playwright": playwright,
                "context": context,
                "page": page,
                "prompt": prompt,
                "material_id": material_id,
                "preferred_storage_type": preferred_storage_type,
                "profile_dir": str(session_profile_dir),
                "stage": "uploaded",
                "mode": "sync",
                "created_at": datetime.utcnow(),
            }

            logger.info(
                "✅ NotebookLM upload complete for session %s in sync interactive mode.",
                session_id,
            )
        except Exception:
            try:
                context.close()
                playwright.stop()
            except Exception:
                pass
            raise

        return {
            "session_id": session_id,
            "material_id": material_id,
            "prompt": prompt,
            "notebook_title": self._build_notebook_title(prompt),
            "status": "awaiting_artifact_confirmation",
            "message": "Đã upload tài liệu lên NotebookLM. Xác nhận để bấm tạo Video + Infographic.",
        }

    def _run_worker_subprocess_sync(self, prompt: str, source_file: Path, session_id: str) -> None:
        """Run NotebookLM flow in a dedicated Python process to avoid loop subprocess limitations."""
        payload = {
            "session_id": session_id,
            "prompt": prompt,
            "source_file": str(source_file),
            "user_data_dir": settings.notebooklm_user_data_dir,
            "headless": settings.notebooklm_headless,
            "generate_wait_seconds": max(settings.notebooklm_generate_wait_seconds, 30),
            "temp_dir": str(self.TEMP_DIR),
        }

        backend_root = Path(__file__).resolve().parents[2]
        process = subprocess.run(
            [sys.executable, "-m", "app.services.notebooklm_worker"],
            input=json.dumps(payload),
            text=True,
            capture_output=True,
            cwd=str(backend_root),
        )

        if process.returncode != 0:
            details = process.stderr.strip() or process.stdout.strip() or "Unknown worker error"
            raise RuntimeError(f"NotebookLM worker thất bại: {details}")

    def _ensure_single_active_session(self) -> None:
        """NotebookLM uses one persistent Chrome profile, so only one active session is allowed."""
        self._cleanup_stale_sessions()
        if not _active_sessions:
            return

        for existing_session_id, data in _active_sessions.items():
            stage = data.get("stage")
            if stage in {"uploaded", "artifacts_requested", "generated"}:
                raise RuntimeError(
                    "Đang có phiên NotebookLM chưa hoàn tất "
                    f"(session_id={existing_session_id}, stage={stage}). "
                    "Hãy hoàn tất tải xuống hoặc hủy phiên đó trước khi tạo phiên mới."
                )

    def _cleanup_stale_sessions(self) -> None:
        now = datetime.utcnow()
        stale_ids: list[str] = []
        for session_id, data in _active_sessions.items():
            created_at = data.get("created_at")
            if isinstance(created_at, datetime) and now - created_at > timedelta(minutes=self.SESSION_STALE_MINUTES):
                stale_ids.append(session_id)

        for session_id in stale_ids:
            data = _active_sessions.pop(session_id, None)
            if not data:
                continue
            try:
                if data.get("mode") == "sync":
                    data.get("context") and data["context"].close()
                    data.get("playwright") and data["playwright"].stop()
                else:
                    context = data.get("context")
                    if context is not None:
                        asyncio.create_task(context.close())
                    playwright = data.get("playwright")
                    if playwright is not None:
                        asyncio.create_task(playwright.stop())
            except Exception:
                pass
            self._cleanup_session_profile_dir(data)
            logger.warning("NotebookLM session %s was stale and has been cleaned up.", session_id)

    async def _launch_async_context_with_recovery(self, playwright, user_data_dir: Path):
        launch_kwargs = {
            "user_data_dir": str(user_data_dir),
            "channel": "chrome",
            "headless": settings.notebooklm_headless,
            "args": ["--start-maximized", "--disable-blink-features=AutomationControlled"],
        }
        # Pre-clean orphan locks from previous crashed/stale browser runs.
        self._force_release_profile_lock(user_data_dir)
        try:
            return await playwright.chromium.launch_persistent_context(**launch_kwargs)
        except Exception as exc:
            if self._is_profile_lock_error(exc):
                if self._try_cleanup_profile_lock(user_data_dir):
                    try:
                        return await playwright.chromium.launch_persistent_context(**launch_kwargs)
                    except Exception as retry_exc:
                        raise RuntimeError(
                            "Chrome profile của NotebookLM vẫn đang bị khóa sau khi thử dọn lock tự động. "
                            "Hãy đóng phiên NotebookLM cũ/noVNC rồi thử lại."
                        ) from retry_exc
                raise RuntimeError(
                    "Chrome profile của NotebookLM đang bị khóa bởi một phiên khác. "
                    "Hãy hoàn tất hoặc hủy phiên NotebookLM trước đó rồi thử lại."
                ) from exc
            if self._is_target_closed_error(exc):
                if self._force_release_profile_lock(user_data_dir):
                    try:
                        return await playwright.chromium.launch_persistent_context(**launch_kwargs)
                    except Exception as retry_exc:
                        raise RuntimeError(
                            "Chrome profile của NotebookLM vẫn bị khóa sau khi cleanup. "
                            "Hãy restart backend và mở lại flow NotebookLM."
                        ) from retry_exc
                raise RuntimeError(
                    "Chrome profile của NotebookLM đang bị khóa bởi một tiến trình Chrome cũ. "
                    "Đã thử tự dọn nhưng chưa thành công, hãy restart backend rồi thử lại."
                ) from exc
            if "Chromium distribution 'chrome' is not found" in str(exc):
                raise RuntimeError(
                    "Thiếu Chrome cho Playwright trong container backend. "
                    "Với Docker Compose, build lại backend với INSTALL_PLAYWRIGHT_BROWSER=1."
                ) from exc
            raise

    def _launch_sync_context_with_recovery(self, playwright, user_data_dir: Path):
        launch_kwargs = {
            "user_data_dir": str(user_data_dir),
            "channel": "chrome",
            "headless": settings.notebooklm_headless,
            "args": ["--start-maximized", "--disable-blink-features=AutomationControlled"],
        }
        # Pre-clean orphan locks from previous crashed/stale browser runs.
        self._force_release_profile_lock(user_data_dir)
        try:
            return playwright.chromium.launch_persistent_context(**launch_kwargs)
        except Exception as exc:
            if self._is_profile_lock_error(exc):
                if self._try_cleanup_profile_lock(user_data_dir):
                    try:
                        return playwright.chromium.launch_persistent_context(**launch_kwargs)
                    except Exception as retry_exc:
                        playwright.stop()
                        raise RuntimeError(
                            "Chrome profile của NotebookLM vẫn đang bị khóa sau khi thử dọn lock tự động. "
                            "Hãy đóng phiên NotebookLM cũ/noVNC rồi thử lại."
                        ) from retry_exc
                playwright.stop()
                raise RuntimeError(
                    "Chrome profile của NotebookLM đang bị khóa bởi một phiên khác. "
                    "Hãy hoàn tất hoặc hủy phiên NotebookLM trước đó rồi thử lại."
                ) from exc
            if self._is_target_closed_error(exc):
                if self._force_release_profile_lock(user_data_dir):
                    try:
                        return playwright.chromium.launch_persistent_context(**launch_kwargs)
                    except Exception as retry_exc:
                        playwright.stop()
                        raise RuntimeError(
                            "Chrome profile của NotebookLM vẫn bị khóa sau khi cleanup. "
                            "Hãy restart backend và mở lại flow NotebookLM."
                        ) from retry_exc
                playwright.stop()
                raise RuntimeError(
                    "Chrome profile của NotebookLM đang bị khóa bởi một tiến trình Chrome cũ. "
                    "Đã thử tự dọn nhưng chưa thành công, hãy restart backend rồi thử lại."
                ) from exc
            if "Chromium distribution 'chrome' is not found" in str(exc):
                playwright.stop()
                raise RuntimeError(
                    "Thiếu Chrome cho Playwright trong container backend. "
                    "Với Docker Compose, build lại backend với INSTALL_PLAYWRIGHT_BROWSER=1."
                ) from exc
            playwright.stop()
            raise

    def _is_profile_lock_error(self, exc: Exception) -> bool:
        detail = str(exc).lower()
        return (
            "profile appears to be in use" in detail
            or "process_singleton_posix" in detail
            or ("target page, context or browser has been closed" in detail and "chrome" in detail)
        )

    def _is_target_closed_error(self, exc: Exception) -> bool:
        return "target page, context or browser has been closed" in str(exc).lower()

    def _profile_lock_likely_present(self) -> bool:
        profile_dir = Path(settings.notebooklm_user_data_dir)
        lock_files = (profile_dir / "SingletonLock", profile_dir / "SingletonSocket", profile_dir / "SingletonCookie")
        return any(path.exists() for path in lock_files)

    def _try_cleanup_profile_lock(self, profile_dir: Path | None = None) -> bool:
        if profile_dir is None:
            profile_dir = Path(settings.notebooklm_user_data_dir)
        if self._is_chrome_profile_in_use(profile_dir):
            return False

        removed_any = False
        for lock_name in ("SingletonLock", "SingletonSocket", "SingletonCookie"):
            lock_path = profile_dir / lock_name
            if lock_path.exists():
                try:
                    lock_path.unlink()
                    removed_any = True
                except Exception:
                    return False

        if removed_any:
            logger.warning("NotebookLM profile lock files were cleaned up automatically.")
        return True

    def _force_release_profile_lock(self, profile_dir: Path | None = None) -> bool:
        """Best-effort recovery for stale lock: kill orphan Chrome processes then clear lock files."""
        if _active_sessions:
            return False

        if profile_dir is None:
            profile_dir = Path(settings.notebooklm_user_data_dir)
        pids = self._get_chrome_profile_pids(profile_dir)
        for pid in pids:
            try:
                os.kill(pid, signal.SIGTERM)
            except Exception:
                continue

        if pids:
            time.sleep(0.8)

        alive_after_term = self._get_chrome_profile_pids(profile_dir)
        for pid in alive_after_term:
            try:
                os.kill(pid, signal.SIGKILL)
            except Exception:
                continue

        time.sleep(0.3)
        return self._try_cleanup_profile_lock(profile_dir)

    def _session_profile_dir(self, session_id: str) -> Path:
        return Path(settings.notebooklm_user_data_dir) / f"session-{session_id}"

    def _cleanup_session_profile_dir(self, session_data: dict) -> None:
        profile_dir = session_data.get("profile_dir")
        if not profile_dir:
            return
        try:
            shutil.rmtree(profile_dir, ignore_errors=True)
        except Exception:
            pass

    def _get_chrome_profile_pids(self, profile_dir: Path) -> list[int]:
        pids: list[int] = []
        profile_dir_str = str(profile_dir)
        proc_root = Path("/proc")
        if not proc_root.exists():
            return pids

        for proc_entry in proc_root.iterdir():
            if not proc_entry.name.isdigit():
                continue
            cmdline_path = proc_entry / "cmdline"
            try:
                raw = cmdline_path.read_bytes()
            except Exception:
                continue
            cmdline = raw.replace(b"\x00", b" ").decode("utf-8", errors="ignore")
            if "chrome" in cmdline and profile_dir_str in cmdline:
                try:
                    pids.append(int(proc_entry.name))
                except ValueError:
                    continue
        return pids

    def _is_chrome_profile_in_use(self, profile_dir: Path) -> bool:
        profile_dir_str = str(profile_dir)
        proc_root = Path("/proc")
        if not proc_root.exists():
            return False

        for proc_entry in proc_root.iterdir():
            if not proc_entry.name.isdigit():
                continue
            cmdline_path = proc_entry / "cmdline"
            try:
                raw = cmdline_path.read_bytes()
            except Exception:
                continue
            cmdline = raw.replace(b"\x00", b" ").decode("utf-8", errors="ignore")
            if "chrome" in cmdline and profile_dir_str in cmdline:
                return True
        return False

    def _ensure_output_dirs(self) -> None:
        self.VIDEO_DIR.mkdir(parents=True, exist_ok=True)
        self.INFOGRAPHIC_DIR.mkdir(parents=True, exist_ok=True)
        self.TEMP_DIR.mkdir(parents=True, exist_ok=True)
        Path(settings.notebooklm_documents_dir).mkdir(parents=True, exist_ok=True)

    def _build_notebook_title(self, prompt: str) -> str:
        compact = " ".join(prompt.split()).strip()
        return compact[:96] if len(compact) > 96 else compact

    def _create_prompt_source(self, prompt: str) -> Path:
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        file_name = f"source_{timestamp}.txt"
        path = Path(settings.notebooklm_documents_dir) / file_name
        content = (
            "Chủ đề cần tạo media:\n"
            f"{prompt}\n\n"
            "Yêu cầu:\n"
            "- Tạo tổng quan bằng video nhằm mục tiêu giáo dục.\n"
            "- Tạo infographic tóm tắt các ý chính và số liệu quan trọng nếu có.\n"
            "- Ngôn ngữ sử dụng: Tiếng Việt.\n"
        )
        path.write_text(content, encoding="utf-8")
        return path

    async def _is_notebook_ready(self, page) -> bool:
        create_button = page.locator("button:has-text('Tạo'), [role='button']:has-text('Tạo')").first
        upload_button = page.locator("button:has-text('Tải tệp lên'), [role='button']:has-text('Tải tệp lên')").first
        return await create_button.is_visible() or await upload_button.is_visible()

    async def _ensure_logged_in(self, page) -> None:
        # First quick check (12 seconds) in case already logged in
        if await self._wait_for_notebook_ready(page, timeout_ms=12000):
            logger.info("✅ NotebookLM đã sẵn sàng (đã đăng nhập trước đó)")
            return 0
        
        # If not ready, show waiting message and give user 5 minutes to log in manually
        logger.warning(
            "⏳ ĐANG CHỜ BẠN ĐĂNG NHẬP GOOGLE...\n"
            "Chrome đã mở, vui lòng:\n"
            "1. Đăng nhập vào Google Account\n"
            "2. Truy cập https://notebooklm.google.com/\n"
            "3. Chờ giao diện NotebookLM hiển thị\n"
            "Script sẽ tiếp tục tự động sau khi phát hiện bạn đã đăng nhập (tối đa 4 phút 48 giây)..."
        )
        
        # Longer timeout (288 seconds = 4 min 48 sec) for manual login
        if await self._wait_for_notebook_ready(page, timeout_ms=288000):
            logger.info("✅ NotebookLM đã sẵn sàng - bắt đầu xử lý...")
            return 0
        
        raise RuntimeError(
            "❌ TIMEOUT: Không phát hiện NotebookLM sẵn sàng trong 5 phút.\n"
            "Vui lòng kiểm tra:\n"
            "- Chrome profile có được cấu hình đúng (NOTEBOOKLM_USER_DATA_DIR)?\n"
            "- Đã đăng nhập vào Google chưa?\n"
            "- Có truy cập được NotebookLM (https://notebooklm.google.com/) không?\n"
            "Sau đó hãy thử lại."
        )

    async def _wait_for_notebook_ready(self, page, timeout_ms: int) -> bool:
        elapsed_ms = 0
        step_ms = 1000
        while elapsed_ms < timeout_ms:
            if await self._is_notebook_ready(page):
                return True
            await page.wait_for_timeout(step_ms)
            elapsed_ms += step_ms
        return False

    async def _create_notebook(self, page) -> None:
        create_btn = page.locator("button:has-text('Tạo'), [role='button']:has-text('Tạo')").first
        await create_btn.wait_for(state="visible", timeout=30000)
        await create_btn.click()
        await page.wait_for_timeout(1200)

    async def _upload_source(self, page, source_path: str) -> None:
        upload_target = page.locator("button:has-text('Tải tệp lên'), [role='button']:has-text('Tải tệp lên')").first
        await upload_target.wait_for(state="visible", timeout=30000)
        async with page.expect_file_chooser() as chooser_info:
            await upload_target.click()
        chooser = await chooser_info.value
        await chooser.set_files([source_path])
        await page.wait_for_timeout(2000)

    async def _close_stray_tabs(self, context, main_page) -> None:
        for tab in list(context.pages):
            if tab == main_page:
                continue
            try:
                await tab.close()
            except Exception:
                continue

    async def _click_scoped_create_button(self, page, artifact_label: str) -> bool:
        artifact_key = artifact_label.strip().lower()
        dialogs = page.locator("[role='dialog'], [aria-modal='true']")
        for i in range(await dialogs.count()):
            dialog = dialogs.nth(i)
            try:
                if not await dialog.is_visible():
                    continue
                dialog_text = (await dialog.inner_text()).lower()
                if artifact_key not in dialog_text:
                    continue
                create_btn = dialog.locator("button:has-text('Tạo'), [role='button']:has-text('Tạo')").first
                if await create_btn.is_visible():
                    await create_btn.click(force=True)
                    return True
            except Exception:
                continue

        scoped_btn = page.locator(
            f"[aria-label*='{artifact_label}'] button:has-text('Tạo'), "
            f"[aria-label*='{artifact_label}'] [role='button']:has-text('Tạo')"
        ).first
        try:
            if await scoped_btn.is_visible():
                await scoped_btn.click(force=True)
                return True
        except Exception:
            return False
        return False

    async def _activate_artifact_creation(self, page, context, artifact_label: str, selectors: list[str]) -> None:
        trigger = None
        for selector in selectors:
            candidate = page.locator(selector).last
            try:
                await candidate.wait_for(state="visible", timeout=3500)
                trigger = candidate
                break
            except Exception:
                continue

        if trigger is None:
            raise RuntimeError(f"Không tìm thấy artifact: {artifact_label}")

        await trigger.scroll_into_view_if_needed()
        await trigger.click(force=True)
        await self._close_stray_tabs(context, page)
        await page.wait_for_timeout(800)
        await self._click_scoped_create_button(page, artifact_label)

    async def _download_artifacts(self, page, target_dir: Path) -> int:
        menu_dots = page.locator(
            ".studio-card button[aria-haspopup='menu'], .studio-card button[aria-label*='Xem thêm']"
        )
        if await menu_dots.count() == 0:
            menu_dots = page.locator("button[aria-haspopup='menu'], button[aria-label*='Xem thêm']")

        total_items = await menu_dots.count()
        downloaded_count = 0
        if total_items == 0:
            logger.warning("NotebookLM không tìm thấy mục nào để tải xuống")
            return

        for i in range(total_items):
            try:
                current_dot = menu_dots.nth(i)
                await current_dot.scroll_into_view_if_needed()
                artifact_title = await self._extract_artifact_title(current_dot, i + 1)
                await current_dot.click(delay=150)
                await page.wait_for_timeout(700)

                download_btn = page.locator(
                    "div[role='menuitem']:has-text('Tải xuống'), "
                    "span:has-text('Tải xuống'), "
                    "button:has-text('Tải xuống')"
                ).last

                if not await download_btn.is_visible():
                    await page.keyboard.press("Escape")
                    continue

                async with page.expect_download() as download_info:
                    await download_btn.click(delay=150)

                download = await download_info.value
                extension = Path(download.suggested_filename).suffix or ".bin"
                safe_title = self._sanitize_file_name(artifact_title)
                output_file = target_dir / f"{i + 1}_{safe_title}{extension}"
                await download.save_as(str(output_file))
                downloaded_count += 1
                await page.wait_for_timeout(1000)
            except Exception as exc:
                logger.warning("Tải artifact thất bại tại vị trí %s: %s", i + 1, exc)
            finally:
                try:
                    await page.keyboard.press("Escape")
                except Exception:
                    pass
                await page.wait_for_timeout(400)

        return downloaded_count

    async def _extract_artifact_title(self, menu_button, fallback_index: int) -> str:
        fallback = f"artifact_{fallback_index}"
        try:
            raw_text = await menu_button.evaluate(
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

    def _organize_downloaded_files(self, video_dir: Path, infographic_dir: Path) -> None:
        """Move image files from video_dir to infographic_dir."""
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

    async def _confirm_artifact_generation_async(self, session_id: str) -> dict:
        """Trigger artifact creation after upload confirmation, then wait until rendering window ends."""
        if session_id not in _active_sessions:
            session_video_dir = self.TEMP_DIR / session_id / "videos"
            session_infographic_dir = self.TEMP_DIR / session_id / "infographics"
            if session_video_dir.exists() or session_infographic_dir.exists():
                return {
                    "session_id": session_id,
                    "material_id": None,
                    "prompt": "",
                    "notebook_title": None,
                    "status": "generation_complete",
                    "message": "Phiên đã hoàn tất tạo media. Vui lòng xác nhận để tải xuống.",
                }
            raise RuntimeError(f"Session {session_id} không tồn tại hoặc đã hết hạn.")

        session_data = _active_sessions[session_id]
        if session_data.get("mode") == "sync":
            executor = session_data.get("executor")
            if executor is None:
                raise RuntimeError("NotebookLM sync session không hợp lệ (thiếu executor).")
            return await asyncio.get_running_loop().run_in_executor(
                executor,
                self._confirm_artifact_generation_sync,
                session_id,
            )

        page = session_data["page"]
        context = session_data["context"]

        if session_data.get("stage") == "generated":
            return {
                "session_id": session_id,
                "material_id": session_data.get("material_id"),
                "prompt": session_data.get("prompt", ""),
                "notebook_title": self._build_notebook_title(session_data.get("prompt", "")),
                "status": "generation_complete",
                "message": "Media đã được tạo xong. Vui lòng xác nhận để tải xuống.",
            }

        await page.wait_for_timeout(1000)
        await self._activate_artifact_creation(
            page,
            context,
            artifact_label="Tổng quan bằng video",
            selectors=[
                "[aria-label*='Tổng quan bằng video']",
                "div[role='button']:has-text('Tổng quan bằng video')",
                "button:has-text('Tổng quan bằng video')",
            ],
        )

        await page.wait_for_timeout(2500)
        await self._activate_artifact_creation(
            page,
            context,
            artifact_label="Bản đồ hoạ thông tin",
            selectors=[
                "div[aria-label='Bản đồ hoạ thông tin']",
                "[role='button']:has-text('Bản đồ hoạ thông tin')",
                "button:has-text('Bản đồ hoạ thông tin')",
            ],
        )

        session_data["stage"] = "artifacts_requested"
        logger.info("✅ NotebookLM artifacts generated for session %s", session_id)

        prompt = session_data.get("prompt", "")
        return {
            "session_id": session_id,
            "material_id": session_data.get("material_id"),
            "prompt": prompt,
            "notebook_title": self._build_notebook_title(prompt),
            "status": "generation_complete",
            "message": "Đã tạo xong! Vui lòng xác nhận thêm một lần để tải xuống.",
        }

    def _confirm_artifact_generation_sync(self, session_id: str) -> dict:
        session_data = _active_sessions[session_id]
        page = session_data["page"]
        context = session_data["context"]

        if session_data.get("stage") == "generated":
            prompt = session_data.get("prompt", "")
            return {
                "session_id": session_id,
                "material_id": session_data.get("material_id"),
                "prompt": prompt,
                "notebook_title": self._build_notebook_title(prompt),
                "status": "generation_complete",
                "message": "Media đã được tạo xong. Vui lòng xác nhận để tải xuống.",
            }

        page.wait_for_timeout(1000)
        notebooklm_worker._activate_artifact_creation(
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
        notebooklm_worker._activate_artifact_creation(
            page,
            context,
            artifact_label="Bản đồ hoạ thông tin",
            selectors=[
                "div[aria-label='Bản đồ hoạ thông tin']",
                "[role='button']:has-text('Bản đồ hoạ thông tin')",
                "button:has-text('Bản đồ hoạ thông tin')",
            ],
        )

        session_data["stage"] = "artifacts_requested"

        prompt = session_data.get("prompt", "")
        return {
            "session_id": session_id,
            "material_id": session_data.get("material_id"),
            "prompt": prompt,
            "notebook_title": self._build_notebook_title(prompt),
            "status": "generation_complete",
            "message": "Đã tạo xong! Vui lòng xác nhận thêm một lần để tải xuống.",
        }

    async def _confirm_download_async(self, session_id: str) -> dict:
        """Download artifacts from stored browser session and move to permanent storage."""
        session_video_dir = self.TEMP_DIR / session_id / "videos"
        session_infographic_dir = self.TEMP_DIR / session_id / "infographics"

        # If session is not active in memory, allow finalize from pre-downloaded temp files (worker mode).
        if session_id not in _active_sessions:
            if not session_video_dir.exists() and not session_infographic_dir.exists():
                raise RuntimeError(f"Session {session_id} không tồn tại hoặc đã hết hạn.")
            return await self._move_temp_files_to_permanent(
                session_id,
                session_video_dir,
                session_infographic_dir,
                preferred_storage_type=None,
            )

        session_data = _active_sessions[session_id]
        stage = session_data.get("stage")
        if stage == "uploaded":
            raise RuntimeError("Bạn cần xác nhận tạo Video + Infographic trước khi tải xuống.")
        if stage not in {"artifacts_requested", "generated"}:
            raise RuntimeError("Session NotebookLM đang ở trạng thái không hợp lệ để tải xuống.")
        if False:
            if session_data.get("stage") == "uploaded":
                logger.info(
                    "Session %s received early download confirmation; triggering artifact generation first.",
                    session_id,
                )
                await self._confirm_artifact_generation_async(session_id)
                session_data = _active_sessions.get(session_id)
                if not session_data or session_data.get("stage") != "generated":
                    raise RuntimeError("Không thể hoàn tất tạo Video + Infographic trước khi tải xuống.")
            else:
                raise RuntimeError("Bạn cần xác nhận tạo Video + Infographic trước khi tải xuống.")

        if session_data.get("mode") == "sync":
            executor = session_data.get("executor")
            if executor is None:
                raise RuntimeError("NotebookLM sync session không hợp lệ (thiếu executor).")
            try:
                return await asyncio.get_running_loop().run_in_executor(
                    executor,
                    self._confirm_download_sync,
                    session_id,
                    session_video_dir,
                    session_infographic_dir,
                )
            finally:
                executor.shutdown(wait=False, cancel_futures=True)

        page = session_data["page"]
        context = session_data["context"]
        playwright = session_data["playwright"]

        # Create temp directories for download
        session_video_dir.mkdir(parents=True, exist_ok=True)
        session_infographic_dir.mkdir(parents=True, exist_ok=True)

        download_ready = False
        try:
            # Download artifacts from the open browser session
            logger.info(f"Downloading artifacts for session {session_id}...")
            downloaded_count = await self._download_artifacts(page, session_video_dir)

            # Organize downloaded files
            self._organize_downloaded_files(session_video_dir, session_infographic_dir)
            temp_file_count = sum(1 for item in session_video_dir.iterdir() if item.is_file()) + sum(
                1 for item in session_infographic_dir.iterdir() if item.is_file()
            )
            if downloaded_count == 0 or temp_file_count == 0:
                raise RuntimeError(
                    "NotebookLM chưa có file sẵn sàng để tải. Hãy chờ media render xong trên NotebookLM rồi bấm tải xuống lại."
                )
            session_data["stage"] = "generated"
            download_ready = True

        finally:
            if download_ready:
                # Close browser and clean up session
                try:
                    await context.close()
                    await playwright.stop()
                    logger.info(f"Browser closed for session {session_id}")
                except Exception as exc:
                    logger.warning(f"Failed to close browser for session {session_id}: {exc}")

                # Remove from active sessions
                closed_session = _active_sessions.pop(session_id, None)
                if closed_session:
                    self._cleanup_session_profile_dir(closed_session)

        preferred_storage_type = session_data.get("preferred_storage_type")
        return await self._move_temp_files_to_permanent(
            session_id,
            session_video_dir,
            session_infographic_dir,
            preferred_storage_type=preferred_storage_type,
        )

    def _confirm_download_sync(self, session_id: str, session_video_dir: Path, session_infographic_dir: Path) -> dict:
        session_data = _active_sessions[session_id]
        page = session_data["page"]
        context = session_data["context"]
        playwright = session_data["playwright"]

        session_video_dir.mkdir(parents=True, exist_ok=True)
        session_infographic_dir.mkdir(parents=True, exist_ok=True)

        download_ready = False
        try:
            downloaded_count = notebooklm_worker._download_artifacts(page, session_video_dir)
            notebooklm_worker._organize_downloaded_files(session_video_dir, session_infographic_dir)
            temp_file_count = sum(1 for item in session_video_dir.iterdir() if item.is_file()) + sum(
                1 for item in session_infographic_dir.iterdir() if item.is_file()
            )
            if downloaded_count == 0 or temp_file_count == 0:
                raise RuntimeError(
                    "NotebookLM chưa có file sẵn sàng để tải. Hãy chờ media render xong trên NotebookLM rồi bấm tải xuống lại."
                )
            session_data["stage"] = "generated"
            download_ready = True
        finally:
            if download_ready:
                try:
                    context.close()
                    playwright.stop()
                    logger.info("Browser closed for sync session %s", session_id)
                except Exception as exc:
                    logger.warning("Failed to close sync browser for session %s: %s", session_id, exc)
                closed_session = _active_sessions.pop(session_id, None)
                if closed_session:
                    self._cleanup_session_profile_dir(closed_session)

        preferred_storage_type = session_data.get("preferred_storage_type")
        return asyncio.run(
            self._move_temp_files_to_permanent(
                session_id,
                session_video_dir,
                session_infographic_dir,
                preferred_storage_type=preferred_storage_type,
            )
        )

    async def _move_temp_files_to_permanent(
        self,
        session_id: str,
        session_video_dir: Path,
        session_infographic_dir: Path,
        preferred_storage_type: str | None,
    ) -> dict:
        """Move prepared temp files to permanent storage and return download URLs."""

        target_storage_type = storage_service.default_storage_type()

        # Ensure permanent directories exist
        self.VIDEO_DIR.mkdir(parents=True, exist_ok=True)
        self.INFOGRAPHIC_DIR.mkdir(parents=True, exist_ok=True)

        videos = []
        infographics = []

        # Move videos to permanent storage
        if session_video_dir.exists():
            for item in session_video_dir.iterdir():
                if not item.is_file():
                    continue
                destination = self.VIDEO_DIR / item.name
                if destination.exists():
                    # Add timestamp to avoid conflicts
                    stem = item.stem
                    suffix = item.suffix
                    destination = self.VIDEO_DIR / f"{stem}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}{suffix}"
                shutil.move(str(item), str(destination))
                file_url, storage_type = await storage_service.persist_file(
                    file_path=str(destination),
                    local_relative_path=f"notebooklm/videos/{destination.name}",
                    object_name=f"generated/notebooklm/videos/{destination.name}",
                    content_type="video/mp4",
                    preferred_storage_type=target_storage_type,
                )
                videos.append({
                    "file_name": destination.name,
                    "file_url": file_url,
                    "storage_type": storage_type,
                })

        # Move infographics to permanent storage
        if session_infographic_dir.exists():
            for item in session_infographic_dir.iterdir():
                if not item.is_file():
                    continue
                destination = self.INFOGRAPHIC_DIR / item.name
                if destination.exists():
                    stem = item.stem
                    suffix = item.suffix
                    destination = self.INFOGRAPHIC_DIR / f"{stem}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}{suffix}"
                shutil.move(str(item), str(destination))
                file_url, storage_type = await storage_service.persist_file(
                    file_path=str(destination),
                    local_relative_path=f"notebooklm/infographics/{destination.name}",
                    object_name=f"generated/notebooklm/infographics/{destination.name}",
                    content_type="image/png",
                    preferred_storage_type=target_storage_type,
                )
                infographics.append({
                    "file_name": destination.name,
                    "file_url": file_url,
                    "storage_type": storage_type,
                })

        # Clean up temp session directory
        try:
            shutil.rmtree(self.TEMP_DIR / session_id)
        except Exception as exc:
            logger.warning(f"Failed to clean up temp session {session_id}: {exc}")

        return {
            "session_id": session_id,
            "videos": videos,
            "infographics": infographics,
        }

    async def _cancel_session_async(self, session_id: str) -> dict:
        """Cancel session, close browser if open, and delete temp files."""
        # Close browser if session is still active
        if session_id in _active_sessions:
            session_data = _active_sessions[session_id]
            try:
                if session_data.get("mode") == "sync":
                    executor = session_data.get("executor")
                    if executor is None:
                        raise RuntimeError("NotebookLM sync session không hợp lệ (thiếu executor).")
                    await asyncio.get_running_loop().run_in_executor(
                        executor,
                        self._close_sync_session,
                        session_id,
                    )
                    executor.shutdown(wait=False, cancel_futures=True)
                else:
                    await session_data["context"].close()
                    await session_data["playwright"].stop()
                logger.info(f"Browser closed for cancelled session {session_id}")
            except Exception as exc:
                logger.warning(f"Failed to close browser for session {session_id}: {exc}")
            finally:
                closed_session = _active_sessions.pop(session_id, None)
                if closed_session:
                    self._cleanup_session_profile_dir(closed_session)

        # Clean up temp files if they exist
        session_dir = self.TEMP_DIR / session_id
        if session_dir.exists():
            try:
                shutil.rmtree(session_dir)
            except Exception as exc:
                logger.error(f"Failed to delete temp files for session {session_id}: {exc}")
                raise RuntimeError(f"Không thể xóa file tạm: {exc}")

        return {"session_id": session_id, "status": "cancelled"}

    def _close_sync_session(self, session_id: str) -> None:
        session_data = _active_sessions.get(session_id)
        if not session_data:
            return
        session_data["context"].close()
        session_data["playwright"].stop()

    def _sanitize_file_name(self, value: str) -> str:
        cleaned = re.sub(r"[\\/*?:\"<>|]", "", value).strip().replace(" ", "_")
        cleaned = re.sub(r"_+", "_", cleaned)
        if not cleaned:
            return "artifact"
        return cleaned[:80]
