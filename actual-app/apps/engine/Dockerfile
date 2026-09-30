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
# DOCX runs request "Times New Roman". Without the real family installed,
# LibreOffice substitutes Liberation Serif and the PDF looks different from
# Word. ttf-mscorefonts-installer downloads Microsoft's Core Fonts for the
# Web (incl. Times New Roman) after EULA acceptance - not a substitute font.
# fonts-liberation / DejaVu remain as fallbacks for other missing faces.
RUN echo "ttf-mscorefonts-installer msttcorefonts/accepted-mscorefonts-eula select true" \
      | debconf-set-selections \
 && sed -i 's/Components: main$/Components: main contrib/' /etc/apt/sources.list.d/debian.sources \
 && apt-get update && apt-get install -y --no-install-recommends \
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
        cabextract \
        xfonts-utils \
        ttf-mscorefonts-installer \
    && rm -rf /var/lib/apt/lists/* \
    && fc-cache -f \
    && fc-list : family | grep -F "Times New Roman"

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

CMD ["sh", "-c", "uvicorn api:app --host 0.0.0.0 --port ${PORT:-8000} --timeout-keep-alive 120"]
