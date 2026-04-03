import asyncio
import sys

import uvicorn


if sys.platform.startswith("win") and sys.version_info < (3, 14):
    # Must be set before uvicorn creates the server event loop.
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
