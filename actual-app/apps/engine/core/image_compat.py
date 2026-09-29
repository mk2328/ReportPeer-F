"""Convert figure formats that python-docx cannot embed into PNG.

python-docx accepts PNG/JPEG/GIF/BMP/TIFF. SVG and WEBP are converted to PNG
before add_picture. Compatible formats are returned unchanged.
"""

from __future__ import annotations

import atexit
import os
import tempfile
from pathlib import Path

# Temp files created for decoding/conversion; removed after generation.
_TEMP_PATHS: set[str] = set()


class FigureImageError(RuntimeError):
    """Raised when a figure cannot be prepared for python-docx."""


def register_temp_path(path: str | os.PathLike[str] | None) -> str | None:
    if not path:
        return None
    abs_path = str(Path(path).resolve())
    _TEMP_PATHS.add(abs_path)
    return abs_path


def cleanup_temp_images() -> None:
    """Delete temporary figure files created during this process."""
    remaining: set[str] = set()
    for path in list(_TEMP_PATHS):
        try:
            if os.path.isfile(path):
                os.remove(path)
            _TEMP_PATHS.discard(path)
        except OSError:
            remaining.add(path)
    _TEMP_PATHS.clear()
    _TEMP_PATHS.update(remaining)


atexit.register(cleanup_temp_images)


def _sniff_format(path: Path) -> str:
    """Return a short format label from magic bytes or file extension."""
    try:
        with path.open("rb") as handle:
            head = handle.read(32)
    except OSError:
        head = b""

    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if head.startswith(b"\xff\xd8\xff"):
        return "jpeg"
    if head.startswith((b"GIF87a", b"GIF89a")):
        return "gif"
    if head.startswith(b"BM"):
        return "bmp"
    if head.startswith(b"RIFF") and head[8:12] == b"WEBP":
        return "webp"
    if head[:4] in (b"II*\x00", b"MM\x00*"):
        return "tiff"
    text = head.lstrip()
    if text.startswith(b"<svg") or text.startswith(b"<?xml"):
        # Confirm SVG root when XML declaration is present.
        try:
            body = path.read_bytes()[:4096].lstrip().lower()
        except OSError:
            body = text.lower()
        if b"<svg" in body:
            return "svg"

    ext = path.suffix.lower().lstrip(".")
    if ext in {"png", "jpg", "jpeg", "gif", "bmp", "tif", "tiff", "webp", "svg"}:
        return "jpeg" if ext == "jpg" else ("tiff" if ext == "tif" else ext)
    return ext or "unknown"


def _figure_label(figure_name: str | None, path: Path) -> str:
    name = (figure_name or "").strip() or path.name or "figure"
    return name


def _write_temp_png(png_bytes: bytes) -> str:
    handle = tempfile.NamedTemporaryFile(delete=False, suffix=".png")
    try:
        handle.write(png_bytes)
    finally:
        handle.close()
    return register_temp_path(handle.name) or handle.name


def _save_rgb_png(image) -> str:
    """Write an opaque RGB PNG LibreOffice can embed without SoftMask corruption."""
    from PIL import Image

    if image.mode in ("RGBA", "LA") or (
        image.mode == "P" and "transparency" in image.info
    ):
        rgba = image.convert("RGBA")
        background = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
        flat = Image.alpha_composite(background, rgba).convert("RGB")
    elif image.mode != "RGB":
        flat = image.convert("RGB")
    else:
        flat = image

    out = tempfile.NamedTemporaryFile(delete=False, suffix=".png")
    try:
        flat.save(out, format="PNG", optimize=True)
    finally:
        out.close()
    return register_temp_path(out.name) or out.name


def _convert_webp_to_png(path: Path, label: str) -> str:
    try:
        from PIL import Image
    except ImportError as error:
        raise FigureImageError(
            f"Cannot convert figure '{label}' (webp): Pillow is not installed."
        ) from error

    try:
        with Image.open(path) as image:
            # Flatten onto white so LibreOffice does not emit broken SoftMask XObjects.
            return _save_rgb_png(image)
    except FigureImageError:
        raise
    except Exception as error:
        raise FigureImageError(
            f"Cannot convert figure '{label}' (webp) to PNG: {error}"
        ) from error


def _convert_svg_to_png(path: Path, label: str) -> str:
    try:
        import pymupdf
    except ImportError as error:
        raise FigureImageError(
            f"Cannot convert figure '{label}' (svg): PyMuPDF is not installed."
        ) from error

    try:
        from PIL import Image
        import io

        doc = pymupdf.open(path)
        try:
            if doc.page_count < 1:
                raise FigureImageError(
                    f"Cannot convert figure '{label}' (svg): SVG has no drawable page."
                )
            page = doc[0]
            # alpha=False composites onto white. alpha=True yields black RGB with
            # artwork only in the alpha channel, which LibreOffice renders black.
            pixmap = page.get_pixmap(dpi=150, alpha=False)
            png_bytes = pixmap.tobytes("png")
        finally:
            doc.close()
        if not png_bytes:
            raise FigureImageError(
                f"Cannot convert figure '{label}' (svg): conversion produced an empty PNG."
            )
        with Image.open(io.BytesIO(png_bytes)) as image:
            return _save_rgb_png(image)
    except FigureImageError:
        raise
    except Exception as error:
        raise FigureImageError(
            f"Cannot convert figure '{label}' (svg) to PNG: {error}"
        ) from error


def ensure_docx_compatible_image(
    image_path: str | os.PathLike[str],
    *,
    figure_name: str | None = None,
    mime_type: str | None = None,
) -> str:
    """
    Return a path python-docx can embed.

    PNG/JPEG/GIF/BMP/TIFF are returned as-is. SVG and WEBP are converted to a
    temporary PNG. Raises FigureImageError with filename and format on failure.
    """
    path = Path(image_path)
    label = _figure_label(figure_name, path)
    if not path.is_file() or path.stat().st_size <= 0:
        raise FigureImageError(
            f"Cannot use figure '{label}': file is missing or empty ({path})."
        )

    fmt = _sniff_format(path)
    mime = (mime_type or "").lower()
    if "svg" in mime:
        fmt = "svg"
    elif "webp" in mime:
        fmt = "webp"

    if fmt in {"png", "jpeg", "gif", "bmp", "tiff"}:
        return str(path.resolve())

    if fmt == "webp":
        return _convert_webp_to_png(path, label)
    if fmt == "svg":
        return _convert_svg_to_png(path, label)

    raise FigureImageError(
        f"Cannot embed figure '{label}' ({fmt}): format is not supported by "
        "python-docx and no converter is available."
    )
