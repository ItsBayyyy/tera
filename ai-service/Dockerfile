# Tera AI service — CPU image for Hugging Face Spaces (sdk: docker) or any container host.
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=7860 \
    HOME=/home/user \
    HF_HOME=/home/user/.cache/huggingface \
    HF_HUB_DISABLE_TELEMETRY=1

# Hugging Face Spaces runs containers as uid 1000; match it so the model cache is writable.
RUN useradd --create-home --uid 1000 user
WORKDIR /home/user/app

COPY --chown=user requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

USER user
COPY --chown=user app ./app
COPY --chown=user tools/download_models.py ./tools/download_models.py

# Weights are baked in at build time: cold starts never depend on the Hub being reachable
# and every replica runs the exact pinned revisions. Cost: a larger image (~0.8 GB of weights).
RUN python tools/download_models.py
ENV HF_HUB_OFFLINE=1

EXPOSE 7860
# AI_SERVICE_KEY must be provided at runtime (HF Space secret); the app refuses to start without it.
CMD ["sh", "-c", "exec uvicorn --factory app.main:create_app --host 0.0.0.0 --port ${PORT} --workers 1 --no-access-log"]
