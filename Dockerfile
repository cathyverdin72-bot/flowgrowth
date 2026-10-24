
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Install backend dependencies separately for build-layer caching.
COPY engine/requirements.txt /app/engine/requirements.txt

RUN python -m pip install --upgrade pip \
    && python -m pip install -r /app/engine/requirements.txt

# Keep the Python import path stable.
COPY engine /app/engine

EXPOSE 8000

# Hosting platforms can supply PORT; local runs default to 8000.
CMD ["sh", "-c", "uvicorn engine.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
