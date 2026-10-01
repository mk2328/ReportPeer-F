"""Convert figure formats that python-docx or LibreOffice cannot embed cleanly.

SVG and WEBP become PNG. PNG/GIF/TIFF/BMP are rewritten as opaque RGB PNG so
LibreOffice does not paint a SoftMask black. JPEG is left unchanged.
"""

from __future__ import annotations

import atexit
import os
import re
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


def _flatten_raster(path: Path, label: str, fmt: str) -> str:
    try:
        from PIL import Image
    except ImportError as error:
        raise FigureImageError(
            f"Cannot convert figure '{label}' ({fmt}): Pillow is not installed."
        ) from error

    try:
        with Image.open(path) as image:
            # Flatten onto white so LibreOffice does not emit broken SoftMask XObjects.
            return _save_rgb_png(image)
    except FigureImageError:
        raise
    except Exception as error:
        raise FigureImageError(
            f"Cannot convert figure '{label}' ({fmt}) to PNG: {error}"
        ) from error


def _convert_webp_to_png(path: Path, label: str) -> str:
    return _flatten_raster(path, label, "webp")


_SVG_STYLE_TAG_RE = re.compile(rb"<(?:\w+:)?style\b", re.IGNORECASE)
_CSS_COMPOUND_RE = re.compile(r"^(\*|[A-Za-z][\w-]*)?((?:[#.][\w-]+)*)$")


def _local_tag(tag) -> str:
    return tag.rsplit("}", 1)[-1] if isinstance(tag, str) else ""


def _strip_css_at_rules(css: str) -> str:
    out: list[str] = []
    i = 0
    while i < len(css):
        at = css.find("@", i)
        if at < 0:
            out.append(css[i:])
            break
        out.append(css[i:at])
        semi, brace = css.find(";", at), css.find("{", at)
        if brace < 0 or (0 <= semi < brace):
            i = len(css) if semi < 0 else semi + 1
            continue
        depth, j = 0, brace
        while j < len(css):
            depth += {"{": 1, "}": -1}.get(css[j], 0)
            j += 1
            if depth == 0:
                break
        i = j
    return "".join(out)


def _parse_css_declarations(text: str) -> dict[str, str]:
    decls: dict[str, str] = {}
    for part in (text or "").split(";"):
        name, sep, value = part.partition(":")
        name = name.strip().lower()
        value = value.replace("!important", "").strip()
        if sep and name and value and "var(" not in value:
            decls[name] = value
    return decls


def _parse_css_selector(selector: str):
    """Left-to-right [(combinator, (tag, ids, classes))]; None if unsupported."""
    chain = []
    combinator = " "
    for token in selector.replace(">", " > ").split():
        if token == ">":
            combinator = ">"
            continue
        match = _CSS_COMPOUND_RE.match(token)
        if not match or not token:
            return None
        parts = re.findall(r"[#.][\w-]+", match.group(2) or "")
        chain.append(
            (
                combinator,
                (
                    (match.group(1) or "").lower(),
                    [p[1:] for p in parts if p[0] == "#"],
                    [p[1:] for p in parts if p[0] == "."],
                ),
            )
        )
        combinator = " "
    return chain or None


def _css_compound_matches(element, compound) -> bool:
    tag, ids, classes = compound
    if tag and tag != "*" and _local_tag(element.tag).lower() != tag:
        return False
    if any(element.get("id") != value for value in ids):
        return False
    own = set((element.get("class") or "").split())
    return all(value in own for value in classes)


def _css_chain_matches(element, chain, parents, index) -> bool:
    combinator, compound = chain[index]
    if not _css_compound_matches(element, compound):
        return False
    if index == 0:
        return True
    parent = parents.get(element)
    if combinator == ">":
        return parent is not None and _css_chain_matches(parent, chain, parents, index - 1)
    while parent is not None:
        if _css_chain_matches(parent, chain, parents, index - 1):
            return True
        parent = parents.get(parent)
    return False


def _inline_svg_stylesheet(svg_bytes: bytes) -> bytes:
    """
    Copy <style> rules onto each element's style attribute.

    MuPDF ignores SVG stylesheets, so class-styled shapes (Mermaid, draw.io and
    most diagram exports) fall back to SVG's default black fill. Inline style is
    honoured. Returns the input unchanged when there is no stylesheet or the
    SVG cannot be parsed.
    """
    if not _SVG_STYLE_TAG_RE.search(svg_bytes):
        return svg_bytes
    import xml.etree.ElementTree as ET

    try:
        root = ET.fromstring(svg_bytes)
    except ET.ParseError:
        return svg_bytes

    css = "".join(
        "".join(el.itertext()) for el in root.iter() if _local_tag(el.tag) == "style"
    )
    css = _strip_css_at_rules(re.sub(r"/\*.*?\*/", "", css, flags=re.S))
    rules = []
    for order, block in enumerate(re.finditer(r"([^{}]+)\{([^{}]*)\}", css)):
        decls = _parse_css_declarations(block.group(2))
        if not decls:
            continue
        for selector in block.group(1).split(","):
            chain = _parse_css_selector(selector.strip())
            if chain:
                specificity = (
                    sum(len(c[1][1]) for c in chain),
                    sum(len(c[1][2]) for c in chain),
                    sum(1 for c in chain if c[1][0] not in ("", "*")),
                )
                rules.append((specificity, order, chain, decls))
    if not rules:
        return svg_bytes

    parents = {child: parent for parent in root.iter() for child in parent}
    for element in root.iter():
        if not isinstance(element.tag, str):
            continue
        matched = [
            (spec, order, decls)
            for spec, order, chain, decls in rules
            if _css_chain_matches(element, chain, parents, len(chain) - 1)
        ]
        if not matched:
            continue
        merged: dict[str, str] = {}
        for _, _, decls in sorted(matched, key=lambda item: (item[0], item[1])):
            merged.update(decls)
        # Inline style outranks the stylesheet in CSS.
        merged.update(_parse_css_declarations(element.get("style", "")))
        element.set("style", ";".join(f"{k}:{v}" for k, v in merged.items()))

    ET.register_namespace("", "http://www.w3.org/2000/svg")
    ET.register_namespace("xlink", "http://www.w3.org/1999/xlink")
    return ET.tostring(root, encoding="utf-8")


_CSS_COLOR_FUNC_RE = re.compile(r"\b(hsla?|rgba)\(\s*([^()]*)\)", re.IGNORECASE)
_SVG_COLOR_ATTRS = ("fill", "stroke", "color", "stop-color", "flood-color", "lighting-color")
_SVG_LENGTH_RE = re.compile(r"^\s*([0-9]*\.?[0-9]+)\s*(px|pt)?\s*$", re.IGNORECASE)
_HTML_BLOCK_TAGS = {"div", "p", "li", "tr", "h1", "h2", "h3", "h4", "h5", "h6"}


def _css_number(token: str, scale: float) -> float:
    """Parse a CSS number or percentage; percentages map onto `scale`."""
    token = token.strip()
    if token.endswith("%"):
        return float(token[:-1]) / 100.0 * scale
    return float(token)


def _css_hue_degrees(token: str) -> float:
    token = token.strip().lower()
    for unit, factor in (("deg", 1.0), ("grad", 0.9), ("rad", 57.29577951308232), ("turn", 360.0)):
        if token.endswith(unit):
            return float(token[: -len(unit)]) * factor
    return float(token)


def _css_color_func_to_hex(match: re.Match) -> str:
    """
    hsl()/hsla()/rgba() -> #rrggbb, alpha blended onto white.

    MuPDF only parses hex, rgb() and named colours and paints anything else
    solid black. Figures are flattened onto white, so blending matches the
    browser result. Unparseable values are left untouched.
    """
    import colorsys

    func = match.group(1).lower()
    parts = [p for p in re.split(r"[\s,/]+", match.group(2).strip()) if p]
    try:
        alpha = _css_number(parts[3], 1.0) if len(parts) > 3 else 1.0
        if func.startswith("hsl"):
            red, green, blue = colorsys.hls_to_rgb(
                (_css_hue_degrees(parts[0]) % 360.0) / 360.0,
                _css_number(parts[2], 1.0),
                _css_number(parts[1], 1.0),
            )
            channels = [red * 255.0, green * 255.0, blue * 255.0]
        else:
            channels = [_css_number(part, 255.0) for part in parts[:3]]
        if len(channels) != 3:
            return match.group(0)
    except (ValueError, IndexError):
        return match.group(0)

    alpha = max(0.0, min(1.0, alpha))
    blended = [
        max(0, min(255, round(c * alpha + 255.0 * (1.0 - alpha)))) for c in channels
    ]
    return "#{:02x}{:02x}{:02x}".format(*blended)


def _normalize_svg_colors(root) -> bool:
    changed = False
    for element in root.iter():
        if not isinstance(element.tag, str):
            continue
        for attr in ("style", *_SVG_COLOR_ATTRS):
            value = element.get(attr)
            if value and _CSS_COLOR_FUNC_RE.search(value):
                element.set(attr, _CSS_COLOR_FUNC_RE.sub(_css_color_func_to_hex, value))
                changed = True
    return changed


def _html_label_lines(foreign_object) -> list[str]:
    """Visible text of an HTML label; <br> and block elements start new lines."""
    lines: list[str] = [""]

    def visit(node):
        tag = _local_tag(node.tag).lower()
        if tag == "br":
            lines.append("")
        elif tag in _HTML_BLOCK_TAGS and lines[-1].strip():
            lines.append("")
        if node.text:
            lines[-1] += node.text
        for child in node:
            visit(child)
            if child.tail:
                lines[-1] += child.tail
        if tag in _HTML_BLOCK_TAGS and lines[-1].strip():
            lines.append("")

    for child in foreign_object:
        visit(child)
    return [" ".join(line.split()) for line in lines if line.strip()]


def _label_style_value(foreign_object, ancestors, names) -> str | None:
    """
    First matching declaration on the label's HTML (innermost wins), then on its
    SVG ancestors, mirroring CSS inheritance after _inline_svg_stylesheet.
    """
    html = [el for el in foreign_object.iter() if el is not foreign_object]
    for element in reversed(html):
        decls = _parse_css_declarations(element.get("style", ""))
        for name in names:
            if decls.get(name):
                return decls[name]
    for element in [foreign_object, *ancestors]:
        decls = _parse_css_declarations(element.get("style", ""))
        for name in names:
            if decls.get(name):
                return decls[name]
            if element.get(name):
                return element.get(name)
    return None


def _svg_number(value, default: float = 0.0) -> float:
    match = _SVG_LENGTH_RE.match(str(value or ""))
    return float(match.group(1)) if match else default


def _replace_foreign_object_labels(root) -> bool:
    """
    Turn HTML labels (Mermaid's default htmlLabels) into centred SVG <text>.

    MuPDF does not render <foreignObject>, so every label was dropped. Each
    label is redrawn in the foreignObject's own box with its resolved colour,
    font and alignment. Existing SVG <text> is not touched.
    """
    import xml.etree.ElementTree as ET

    parents = {child: parent for parent in root.iter() for child in parent}
    targets = [
        el for el in root.iter()
        if isinstance(el.tag, str) and _local_tag(el.tag) == "foreignObject"
    ]
    changed = False
    for foreign_object in targets:
        lines = _html_label_lines(foreign_object)
        parent = parents.get(foreign_object)
        if not lines or parent is None:
            continue

        ancestors = []
        node = parent
        while node is not None:
            ancestors.append(node)
            node = parents.get(node)

        x = _svg_number(foreign_object.get("x"))
        y = _svg_number(foreign_object.get("y"))
        width = _svg_number(foreign_object.get("width"))
        height = _svg_number(foreign_object.get("height"))
        font_size = _svg_number(
            _label_style_value(foreign_object, ancestors, ("font-size",)), 16.0
        ) or 16.0
        colour = _label_style_value(foreign_object, ancestors, ("color", "fill")) or "#000000"
        colour = _CSS_COLOR_FUNC_RE.sub(_css_color_func_to_hex, colour)
        family = _label_style_value(foreign_object, ancestors, ("font-family",))
        weight = _label_style_value(foreign_object, ancestors, ("font-weight",))
        align = (_label_style_value(foreign_object, ancestors, ("text-align",)) or "center").lower()

        if align in ("left", "start"):
            anchor, text_x = "start", x
        elif align in ("right", "end"):
            anchor, text_x = "end", x + width
        else:
            anchor, text_x = "middle", x + width / 2.0

        line_height = height / len(lines) if height > 0 else font_size * 1.5
        namespace = foreign_object.tag[: -len("foreignObject")]
        text = ET.Element(f"{namespace}text")
        text.set("text-anchor", anchor)
        text.set("font-size", f"{font_size:g}")
        text.set("fill", colour)
        if family:
            text.set("font-family", family)
        if weight:
            text.set("font-weight", weight)
        for index, line in enumerate(lines):
            span = ET.SubElement(text, f"{namespace}tspan")
            span.set("x", f"{text_x:g}")
            # ~0.35em below the line centre puts the baseline where a browser's
            # vertically centred label would sit.
            span.set("y", f"{y + line_height * (index + 0.5) + font_size * 0.35:g}")
            span.text = line

        slot = list(parent).index(foreign_object)
        parent.remove(foreign_object)
        parent.insert(slot, text)
        changed = True
    return changed


def _resolve_svg_root_size(root) -> bool:
    """
    Replace percentage/missing root width/height with viewBox dimensions.

    MuPDF renders width="100%" (Mermaid's default) onto a Letter-size page,
    clipping wide diagrams and padding small ones. Fixed sizes are kept.
    """
    try:
        _, _, vb_width, vb_height = (
            float(v) for v in re.split(r"[\s,]+", (root.get("viewBox") or "").strip())
        )
    except ValueError:
        return False
    if vb_width <= 0 or vb_height <= 0:
        return False

    def unresolved(value) -> bool:
        value = (value or "").strip().lower()
        return not value or value.endswith("%") or value == "auto"

    width_open = unresolved(root.get("width"))
    height_open = unresolved(root.get("height"))
    if not width_open and not height_open:
        return False
    if not width_open:
        width = _svg_number(root.get("width"))
        if width <= 0:
            return False
        root.set("height", f"{width * vb_height / vb_width:g}")
    elif not height_open:
        height = _svg_number(root.get("height"))
        if height <= 0:
            return False
        root.set("width", f"{height * vb_width / vb_height:g}")
    else:
        root.set("width", f"{vb_width:g}")
        root.set("height", f"{vb_height:g}")
    return True


def _prepare_svg_for_mupdf(svg_bytes: bytes) -> bytes:
    """
    Make an SVG renderable by MuPDF without losing colour, labels or extent.

    Runs on every SVG: stylesheet inlining, then colour-function conversion,
    HTML-label conversion and root sizing. Returns the inlined bytes unchanged
    when none of those apply or the SVG cannot be parsed.
    """
    svg_bytes = _inline_svg_stylesheet(svg_bytes)
    import xml.etree.ElementTree as ET

    try:
        root = ET.fromstring(svg_bytes)
    except ET.ParseError:
        return svg_bytes

    changed = _normalize_svg_colors(root)
    changed = _replace_foreign_object_labels(root) or changed
    changed = _resolve_svg_root_size(root) or changed
    if not changed:
        return svg_bytes

    ET.register_namespace("", "http://www.w3.org/2000/svg")
    ET.register_namespace("xlink", "http://www.w3.org/1999/xlink")
    return ET.tostring(root, encoding="utf-8")


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

        svg_bytes = _prepare_svg_for_mupdf(path.read_bytes())
        doc = pymupdf.open(stream=svg_bytes, filetype="svg")
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

    if fmt == "jpeg":
        return str(path.resolve())

    # PNG/GIF/TIFF/BMP often carry an alpha channel or tRNS. LibreOffice then
    # emits a SoftMask and paints the figure black. Flatten every raster the
    # same way WEBP already is, including visually opaque RGBA screenshots.
    if fmt in {"png", "gif", "bmp", "tiff"}:
        return _flatten_raster(path, label, fmt)

    if fmt == "webp":
        return _convert_webp_to_png(path, label)
    if fmt == "svg":
        return _convert_svg_to_png(path, label)

    raise FigureImageError(
        f"Cannot embed figure '{label}' ({fmt}): format is not supported by "
        "python-docx and no converter is available."
    )
