import asyncio
import sys


if sys.platform.startswith("win"):
    # Ensure subprocess support for asyncio across all Python processes,
    # including uvicorn reload worker processes.
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
