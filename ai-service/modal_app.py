"""Deploy the AI service to Modal: serverless CPU, covered by Modal's free monthly credits.

Once per workspace (the value must equal AI_SERVICE_KEY in Vercel):
    modal secret create tera-ai AI_SERVICE_KEY=<long random value>
Deploy (prints the https://...modal.run URL to use as AI_SERVICE_URL):
    modal deploy ai-service/modal_app.py

The FastAPI app in app/ is served unchanged. As in the Dockerfile, the pinned weights are baked into
the image at build time, so a cold start only loads them from disk and never depends on the Hub.
"""

from __future__ import annotations

from pathlib import Path

import modal

HERE = Path(__file__).resolve().parent
REMOTE = "/root/ai-service"

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install_from_requirements(str(HERE / "requirements.txt"))
    .env({"HF_HOME": "/root/.cache/huggingface", "HF_HUB_DISABLE_TELEMETRY": "1", "PYTHONUNBUFFERED": "1"})
    .add_local_dir(str(HERE / "app"), f"{REMOTE}/app", copy=True, ignore=["__pycache__"])
    .add_local_file(str(HERE / "tools" / "download_models.py"), f"{REMOTE}/tools/download_models.py", copy=True)
    .run_commands(f"cd {REMOTE} && python tools/download_models.py")
    .env({"HF_HUB_OFFLINE": "1"})
)

app = modal.App("tera-ai", image=image)


@app.function(
    secrets=[modal.Secret.from_name("tera-ai")],
    cpu=2.0,
    memory=4096,
    # One container is enough for judging traffic and caps what the free credits can be spent on.
    max_containers=1,
    # Stay warm for 15 minutes after the last request; the web app also pings /health when a
    # scan screen opens, so the container is usually up before the first photo arrives.
    scaledown_window=900,
    timeout=120,
)
@modal.asgi_app()
def web():
    import sys

    sys.path.insert(0, REMOTE)
    from app.main import create_app  # the service's own package, not this module's `app`

    return create_app()
