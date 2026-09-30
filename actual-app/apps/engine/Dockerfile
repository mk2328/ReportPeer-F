FROM debian:bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    HOME=/home/app \
    VIRTUAL_ENV=/opt/venv \
    PATH="/opt/venv/bin:$PATH" \
    REPORTPEER_SOFFICE=/usr/lib/libreoffice/program/soffice

# libreoffice-writer + python3-uno drive TOC/LOF/LOT updates and PDF export.
# Liberation fonts are metric-compatible with Times New Roman, so JUW
# typography keeps the same line and page breaks as on Windows.
RUN apt-get update && apt-get install -y --no-install-recommends \
        python3 \
        python3-pip \
        python3-venv \
        python3-uno \
        libreoffice-writer \
        libreoffice-core \
        fonts-liberation \
        fonts-dejavu-core \
        fontconfig \
        curl \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && fc-cache -f

# --system-site-packages keeps `uno` (python3-uno, dist-packages) importable
# while pip dependencies stay in the venv.
RUN python3 -m venv --system-site-packages "$VIRTUAL_ENV"

WORKDIR /app

COPY requirements.txt ./
RUN pip install --upgrade pip && pip install -r requirements.txt

COPY . .

RUN useradd --create-home --home-dir /home/app --shell /usr/sbin/nologin app \
    && chown -R app:app /app /home/app
USER app

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -fsS "http://127.0.0.1:${PORT:-8000}/health" || exit 1

CMD ["sh", "-c", "uvicorn api:app --host 0.0.0.0 --port ${PORT:-8000}"]
