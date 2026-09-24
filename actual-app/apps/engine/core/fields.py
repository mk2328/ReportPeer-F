from docx.oxml import OxmlElement
from docx.oxml.ns import qn


def insert_field(paragraph, instruction, placeholder="1"):
    """Insert a Word field (SEQ, TOC, PAGE, STYLEREF, etc.)."""
    fld_begin = OxmlElement("w:fldChar")
    fld_begin.set(qn("w:fldCharType"), "begin")

    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = instruction

    fld_sep = OxmlElement("w:fldChar")
    fld_sep.set(qn("w:fldCharType"), "separate")

    text = OxmlElement("w:t")
    text.text = placeholder

    fld_end = OxmlElement("w:fldChar")
    fld_end.set(qn("w:fldCharType"), "end")

    run = paragraph.add_run()
    run._r.append(fld_begin)
    run._r.append(instr)
    run._r.append(fld_sep)
    run._r.append(text)
    run._r.append(fld_end)
    return run


def insert_seq(paragraph, label):
    return insert_field(paragraph, f"SEQ {label} \\* ARABIC", "1")


def insert_page(paragraph):
    return insert_field(paragraph, " PAGE ", "1")


def insert_num_pages(paragraph):
    return insert_field(paragraph, "NUMPAGES", "1")


def insert_style_ref(paragraph, heading_level=1):
    return insert_field(paragraph, f"STYLEREF {heading_level} \\s", "1")
