# -*- coding: utf-8 -*-
"""PDF хуудсыг рендерлэж, бүдэг саарал текстийг тодруулна (levels stretch)."""
import io


def render_page_png(pdf_path, page_1indexed, dpi=300, lo=108.0, hi=200.0):
    """Нэг хуудсыг саарал болгож, levels стрэтч хийгээд PNG bytes буцаана."""
    import fitz
    import numpy as np
    from PIL import Image

    doc = fitz.open(pdf_path)
    try:
        pix = doc[page_1indexed - 1].get_pixmap(dpi=dpi)
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples).convert("L")
        arr = np.asarray(img).astype(np.float32)
        arr = np.clip((arr - lo) / (hi - lo) * 255, 0, 255).astype(np.uint8)
        buf = io.BytesIO()
        Image.fromarray(arr).save(buf, format="PNG", optimize=True)
        return buf.getvalue()
    finally:
        doc.close()


def page_count(pdf_path):
    import fitz
    doc = fitz.open(pdf_path)
    try:
        return doc.page_count
    finally:
        doc.close()
