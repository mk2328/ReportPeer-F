from config import config
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.oxml import OxmlElement, parse_xml
from docx.enum.section import WD_SECTION
import os
import win32com.client
from fields import (
    insert_seq,
    insert_style_ref
)


# Load Template
doc = Document("template.docx")

# Global variables
current_chapter = 0

# ======================================================
# INJECT TRUE NATIVE WORD MULTILEVEL LIST
# ======================================================
def setup_true_multilevel_list(document):
    """
    Creates a native MS Word Multilevel List definition in the document's XML
    so that Headings act as real lists instead of independent fields.
    """
    try:
        num_part = document.part.numbering_part
        if num_part is None:
            return
        
        # 999 is a safe, distinct ID so it doesn't collide with template defaults
        abstract_num_xml = """
        <w:abstractNum xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" w:abstractNumId="999">
            <w:multiLevelType w:val="multilevel"/>
            <!-- Hidden Level 0 (Tracks Chapter) -->
            <w:lvl w:ilvl="0">
                <w:start w:val="1"/>
                <w:numFmt w:val="decimal"/>
                <w:lvlText w:val="%1."/>
                <w:lvlJc w:val="left"/>
                <w:pPr><w:ind w:left="0" w:hanging="0"/></w:pPr>
            </w:lvl>
            <!-- Level 1: Heading 2 (1.1) -->
            <w:lvl w:ilvl="1">
                <w:start w:val="1"/>
                <w:numFmt w:val="decimal"/>
                <w:lvlText w:val="%1.%2"/>
                <w:lvlJc w:val="left"/>

                <w:rPr>
                    <w:rFonts
                        w:ascii="Times New Roman"
                        w:hAnsi="Times New Roman"
                        w:cs="Times New Roman"/>
                    <w:sz w:val="32"/>
                    <w:b/>
                </w:rPr>

                <w:pPr><w:ind w:left="720" w:hanging="720"/></w:pPr>
                <w:suff w:val="tab"/>
            </w:lvl>
            <!-- Level 2: Heading 3 (1.1.1) -->
            <w:lvl w:ilvl="2">
                <w:start w:val="1"/>
                <w:numFmt w:val="decimal"/>
                <w:lvlText w:val="%1.%2.%3"/>
                <w:lvlJc w:val="left"/>
                <w:pPr><w:ind w:left="1080" w:hanging="1080"/></w:pPr>
                <w:suff w:val="tab"/>
            </w:lvl>
            <!-- Level 3: Heading 4 -->
            <w:lvl w:ilvl="3">
                <w:start w:val="1"/>
                <w:numFmt w:val="decimal"/>
                <w:lvlText w:val="%1.%2.%3.%4"/>
                <w:lvlJc w:val="left"/>
                <w:pPr><w:ind w:left="1440" w:hanging="1440"/></w:pPr>
                <w:suff w:val="tab"/>
            </w:lvl>
            <!-- Level 4: Heading 5 -->
            <w:lvl w:ilvl="4">
                <w:start w:val="1"/>
                <w:numFmt w:val="decimal"/>
                <w:lvlText w:val="%1.%2.%3.%4.%5"/>
                <w:lvlJc w:val="left"/>
                <w:pPr><w:ind w:left="1800" w:hanging="1800"/></w:pPr>
                <w:suff w:val="tab"/>
            </w:lvl>
        </w:abstractNum>
        """
        
        num_xml = """
        <w:num xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" w:numId="999">
            <w:abstractNumId w:val="999"/>
        </w:num>
        """
        
        num_part._element.append(parse_xml(abstract_num_xml))
        num_part._element.append(parse_xml(num_xml))
    except Exception:
        pass

setup_true_multilevel_list(doc)

# ======================================================
# TEMPLATE CLEANUP (Automatic Word Lists Strip)
# ======================================================
while len(doc.paragraphs) > 1 and doc.paragraphs[0].text.strip() == "":
    p = doc.paragraphs[0]
    p._element.getparent().remove(p._element)

if doc.paragraphs:
    doc.paragraphs[0].style = doc.styles["Normal"]
    doc.paragraphs[0].clear()

for i in range(1, 6):
    try:
        style = doc.styles[f"Heading {i}"]
        pPr = style.element.get_or_add_pPr()
        numPr = pPr.find(qn('w:numPr'))
        if numPr is not None:
            pPr.remove(numPr)
    except Exception:
        pass

# ======================================================
# PAGE SETUP (Section 0 - Front Matter)
# ======================================================
section = doc.sections[0]
section.left_margin = Inches(1.5)
section.right_margin = Inches(1.0)
section.top_margin = Inches(1.0)
section.bottom_margin = Inches(1.0)

sectPr = section._sectPr
pgNumType = OxmlElement('w:pgNumType')
pgNumType.set(qn('w:fmt'), 'lowerRoman')
sectPr.append(pgNumType)

# ======================================================
# HELPER : FORCE FONT ON A RUN
# ======================================================
def force_times_new_roman(run):
    run.font.name = "Times New Roman"
    rPr = run._element.get_or_add_rPr()
    rFonts = rPr.get_or_add_rFonts()
    rFonts.set(qn("w:ascii"), "Times New Roman")
    rFonts.set(qn("w:hAnsi"), "Times New Roman")
    rFonts.set(qn("w:eastAsia"), "Times New Roman")
    rFonts.set(qn("w:cs"), "Times New Roman")

# ======================================================
# FRONT MATTER FOOTER ONLY (No Headers on Roman Pages)
# ======================================================
def add_only_footer(section):
    footer = section.footer
    footer.is_linked_to_previous = False
    footer_para = footer.paragraphs[0]
    footer_para.clear()
    footer_para.alignment = WD_ALIGN_PARAGRAPH.CENTER

    page_run = footer_para.add_run()
    fldBegin = OxmlElement("w:fldChar")
    fldBegin.set(qn("w:fldCharType"), "begin")
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = " PAGE "
    fldSeparate = OxmlElement("w:fldChar")
    fldSeparate.set(qn("w:fldCharType"), "separate")
    text = OxmlElement("w:t")
    text.text = "1"
    fldEnd = OxmlElement("w:fldChar")
    fldEnd.set(qn("w:fldCharType"), "end")

    page_run._r.append(fldBegin)
    page_run._r.append(instr)
    page_run._r.append(fldSeparate)
    page_run._r.append(text)
    page_run._r.append(fldEnd)

    force_times_new_roman(page_run)
    page_run.font.size = Pt(10)

add_only_footer(doc.sections[0])

# ======================================================
# CHAPTER HEADER / FOOTER Setup
# ======================================================
def add_header_footer(chapter_title):
    section = doc.sections[-1]
    header = section.header
    header.is_linked_to_previous = False

    footer = section.footer
    # footer.is_linked_to_previous = False
    section.different_first_page_header_footer = False

    header_para = header.paragraphs[0]
    header_para.clear()
    header_para.alignment = WD_ALIGN_PARAGRAPH.LEFT
    run = header_para.add_run(chapter_title)
    force_times_new_roman(run)
    run.font.size = Pt(10)
    run.italic = True

    footer_para = footer.paragraphs[0]
    footer_para.clear()
    footer_para.alignment = WD_ALIGN_PARAGRAPH.CENTER

    page_run = footer_para.add_run()
    fldBegin = OxmlElement("w:fldChar")
    fldBegin.set(qn("w:fldCharType"), "begin")
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = " PAGE "
    fldSeparate = OxmlElement("w:fldChar")
    fldSeparate.set(qn("w:fldCharType"), "separate")
    text = OxmlElement("w:t")
    text.text = "1"
    fldEnd = OxmlElement("w:fldChar")
    fldEnd.set(qn("w:fldCharType"), "end")

    page_run._r.append(fldBegin)
    page_run._r.append(instr)
    page_run._r.append(fldSeparate)
    page_run._r.append(text)
    page_run._r.append(fldEnd)

    force_times_new_roman(page_run)
    page_run.font.size = Pt(10)

# ======================================================
# CONFIGURE BUILT-IN HEADING STYLES
# ======================================================
def configure_heading_style(level, size, bold, all_caps=False, small_caps=False):
    style = doc.styles[f"Heading {level}"]
    font = style.font
    font.name = "Times New Roman"
    font.size = Pt(size)
    font.bold = bold
    font.color.rgb = RGBColor(0, 0, 0)
    font.all_caps = all_caps
    font.small_caps = small_caps
    font.italic = False

    rPr = style.element.get_or_add_rPr()
    rFonts = rPr.get_or_add_rFonts()
    rFonts.set(qn("w:ascii"), "Times New Roman")
    rFonts.set(qn("w:hAnsi"), "Times New Roman")
    rFonts.set(qn("w:eastAsia"), "Times New Roman")
    rFonts.set(qn("w:cs"), "Times New Roman")

    pf = style.paragraph_format
    pf.line_spacing = 1.5
    pf.space_before = Pt(0)
    pf.space_after = Pt(0)
    pf.alignment = WD_ALIGN_PARAGRAPH.LEFT

headings = config["styles"]["headings"]
for i in range(1, 6):
    cfg_key = f"JUW_H{i}"
    configure_heading_style(
        i,
        headings[cfg_key]["size"],
        headings[cfg_key]["bold"],
        all_caps=headings[cfg_key].get("all_caps", False),
        small_caps=headings[cfg_key].get("small_caps", False)
    )

# ======================================================
# HELPER: ADD BOTTOM BORDER
# ======================================================
def add_bottom_border(paragraph):
    paragraph.paragraph_format.space_after = Pt(12) 

    pPr = paragraph._element.get_or_add_pPr()
    pBdr = OxmlElement("w:pBdr")
    bottom = OxmlElement("w:bottom")
    bottom.set(qn("w:val"), "single")
    bottom.set(qn("w:sz"), "24")      
    bottom.set(qn("w:space"), "4")    
    bottom.set(qn("w:color"), "000000") 
    pBdr.append(bottom)
    pPr.append(pBdr)

# ======================================================
# DYNAMIC NATIVE MULTILEVEL HEADING
# ======================================================
def add_heading(text, level):
    global current_chapter

    p = doc.add_paragraph()
    p.style = doc.styles[f"Heading {level}"]
    pf = p.paragraph_format

    if level == 1:
        pf.space_before = Pt(0)
        pf.space_after = Pt(0)
    elif level == 2:
        pf.space_before = Pt(18) 
        pf.space_after = Pt(6)

    # Automatically map levels 2-5 to MS Word's Native Multilevel List Engine
    if current_chapter > 0 and level > 1:
        pPr = p._element.get_or_add_pPr()
        numPr = OxmlElement('w:numPr')
        
        ilvl_el = OxmlElement('w:ilvl')
        ilvl_el.set(qn('w:val'), str(level - 1))  # Native List Level mapping (1 = H2, 2 = H3...)
        
        numId_el = OxmlElement('w:numId')
        numId_el.set(qn('w:val'), "999")          # Points to the List defined in setup_true_multilevel_list()
        
        numPr.append(ilvl_el)
        numPr.append(numId_el)
        pPr.append(numPr)
        # We NO LONGER manually calculate indents or type "1.1" prefixes.
        # Word draws the numbers, tabs, and perfect hanging indents automatically!

    run = p.add_run(text)
    force_times_new_roman(run)

    if level == 1:
        if text.startswith("CHAPTER"):
            run.font.size = Pt(20)
        else:
            run.font.size = Pt(18)
    elif level == 2:
        run.font.size = Pt(16)
    elif level == 3:
        run.font.size = Pt(14)

    # Border between CHAPTER & INTRODUCTION titles
    if level == 1 and text.startswith("CHAPTER"):
        add_bottom_border(p)
        
    return p

# ======================================================
# FRONT MATTER DYNAMIC PAGES
# ======================================================
def add_front_matter_page(title):
    global current_chapter
    old_chapter = current_chapter
    current_chapter = 0

    p = doc.add_paragraph()
    p.style = doc.styles["Heading 1"]
    add_bottom_border(p)
    
    run = p.add_run(title.upper())
    force_times_new_roman(run)
    run.font.size = Pt(18) 

    add_body_text(
    "The University Management System is a web-based application developed to automate and streamline the academic and administrative operations of a university. The system addresses the limitations of traditional manual processes by providing a centralized platform for managing student records, faculty information, course registration, attendance, examinations, and result processing. The objective of the proposed system is to improve efficiency, reduce paperwork, minimize human errors, and ensure secure management of institutional data."
    )

    add_body_text(
        "The proposed application provides role-based access for administrators, faculty members, and students, allowing each user to perform authorized tasks through a secure and user-friendly interface. Modern web technologies and a relational database are utilized to ensure data integrity, scalability, and system reliability. The application also supports report generation, efficient record management, and improved communication among different stakeholders."
    )

    add_body_text(
        "The implementation of the proposed system is expected to enhance the overall productivity of educational institutions by simplifying administrative tasks and improving the accessibility of academic information. Furthermore, the system provides a scalable foundation that can be extended with additional modules and advanced features to meet future institutional requirements."
    )
    doc.add_page_break()

    current_chapter = old_chapter


# ======================================================
# ADD BULLET POINTS (1.5 SPACING & DYNAMIC INDENTATION)
# ======================================================
def add_bullet_point(text, level=1, heading_level=2):
    """
    level: Bullet depth (1, 2, 3...)
    heading_level: Context (1 or 2 uses 0.5" indent, 3+ uses 0.75" indent)
    """
    bullet_chars = {1: '\u2022', 2: 'o', 3: '\u25AA'}
    bullet_char = bullet_chars.get(level, '\u2022')
    
    p = doc.add_paragraph()
    p.style = doc.styles['Normal']
    
    # 1. DYNAMIC INDENTATION LOGIC
    # Agar heading level 1 ya 2 hai, to base 0.5", warna 0.75"
    base_indent = 0.5 if heading_level <= 2 else 0.75
    
    pf = p.paragraph_format
    # Bullet ka starting point: Base Indent + level offset
    pf.left_indent = Inches(base_indent + (0.25 * (level - 1)))
    # Hanging indent taake text bullet ke neeche na jaye
    pf.first_line_indent = Inches(-0.20)
    
    pf.tab_stops.add_tab_stop(pf.left_indent)
    
    # 2. Add Bullet
    bullet_run = p.add_run(f"{bullet_char}\t")
    force_times_new_roman(bullet_run)
    
    # 3. Add Text
    run = p.add_run(text)
    force_times_new_roman(run)
    run.font.size = Pt(12)
    run.font.color.rgb = RGBColor(0, 0, 0)
    
    # 4. --- XML OVERRIDE: 1.5 SPACING & NO GAPS ---
    pPr = p._element.get_or_add_pPr()
    
    # Remove old spacing
    spacing = pPr.find(qn('w:spacing'))
    if spacing is not None:
        pPr.remove(spacing)
        
    spacing = OxmlElement('w:spacing')
    spacing.set(qn('w:before'), "0")
    spacing.set(qn('w:after'), "0")
    spacing.set(qn('w:beforeAutospacing'), "0")
    spacing.set(qn('w:afterAutospacing'), "0")
    spacing.set(qn('w:line'), "360")  # 360 twips = 1.5 line spacing
    spacing.set(qn('w:lineRule'), "auto")
    pPr.append(spacing)
    
    # Disable Snap to Grid
    snapToGrid = pPr.find(qn('w:snapToGrid'))
    if snapToGrid is None:
        snapToGrid = OxmlElement('w:snapToGrid')
        pPr.append(snapToGrid)
    snapToGrid.set(qn('w:val'), '0')
    
    pf.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    
    return p




# ======================================================
# DYNAMIC TABLE OF CONTENTS GENERATION
# ======================================================
def add_table_of_contents():
    p = doc.add_paragraph()
    p.style = doc.styles["Normal"]
    add_bottom_border(p)
    
    run = p.add_run("TABLE OF CONTENTS")
    force_times_new_roman(run)
    run.font.size = Pt(18)
    run.bold = True

    paragraph = doc.add_paragraph()
    run = paragraph.add_run()
    fldChar = OxmlElement('w:fldChar')
    fldChar.set(qn('w:fldCharType'), 'begin')
    run._r.append(fldChar)

    instrText = OxmlElement('w:instrText')
    instrText.set(qn('xml:space'), 'preserve')
    instrText.text = 'TOC \\o "1-5" \\h \\z \\u'
    run._r.append(instrText)

    fldChar = OxmlElement('w:fldChar')
    fldChar.set(qn('w:fldCharType'), 'separate')
    run._r.append(fldChar)

    text = OxmlElement('w:t')
    text.text = "Right-click and choose 'Update Field' to generate the Table of Contents."
    run._r.append(text)

    fldChar = OxmlElement('w:fldChar')
    fldChar.set(qn('w:fldCharType'), 'end')
    run._r.append(fldChar)

    doc.add_page_break()


def add_list_of_figures():
    p = doc.add_paragraph()
    p.style = doc.styles["Heading 1"]
    add_bottom_border(p)

    run = p.add_run("LIST OF FIGURES")
    force_times_new_roman(run)
    run.font.size = Pt(18)
    run.bold = True

    paragraph = doc.add_paragraph()
    run = paragraph.add_run()

    # Field Begin
    fldBegin = OxmlElement('w:fldChar')
    fldBegin.set(qn('w:fldCharType'), 'begin')
    run._r.append(fldBegin)

    # Table of Figures Field
    instrText = OxmlElement('w:instrText')
    instrText.set(qn('xml:space'), 'preserve')
    instrText.text = 'TOC \\h \\z \\c "Figure"'
    run._r.append(instrText)

    # Separate
    fldSeparate = OxmlElement('w:fldChar')
    fldSeparate.set(qn('w:fldCharType'), 'separate')
    run._r.append(fldSeparate)

    text = OxmlElement('w:t')
    text.text = "Right-click and choose 'Update Field' to generate the List of Figures."
    run._r.append(text)

    # End
    fldEnd = OxmlElement('w:fldChar')
    fldEnd.set(qn('w:fldCharType'), 'end')
    run._r.append(fldEnd)

    doc.add_page_break()


# ======================================================
# SMART BODY TEXT (DYNAMIC INDENTATION BASED ON HEADING LEVEL)
# ======================================================
def add_body_text(text, level=2):
    """
    Adds body text paragraph.
    - If under Heading 1 or 2 (level <= 2): Indent is 0.5 inches.
    - If under Heading 3/Subheading (level >= 3): Indent is 0.75 inches to match heading text.
    """
    p = doc.add_paragraph()
    run = p.add_run(text)
    force_times_new_roman(run)
    run.font.size = Pt(12)
    run.font.color.rgb = RGBColor(0, 0, 0)

    pf = p.paragraph_format
    pf.line_spacing = 1.5
    pf.space_before = Pt(0)
    pf.space_after = Pt(0)
    pf.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    
    # DYNAMIC INDENTATION RULE:
    if level >= 3:
        pf.first_line_indent = Inches(0.75)  # Heading 3 ke niche alignment behtar karne ke liye
    else:
        pf.first_line_indent = Inches(0.5)   # Normal/Heading 2 ke niche ke liye
        
    return p

# ======================================================
# HELPER: SILENTLY ADVANCE NATIVE CHAPTER LIST COUNTER
# ======================================================
def increment_native_chapter():
    """
    Inserts a hidden paragraph bound to List Level 0 (Chapter).
    This natively increments the internal MS Word chapter counter to 1, 2, 3...
    so that subheadings automatically pick up '1.1', '2.1' without manually numbering.
    """
    p = doc.add_paragraph()
    pPr = p._element.get_or_add_pPr()
    
    numPr = OxmlElement('w:numPr')
    ilvl_el = OxmlElement('w:ilvl')
    ilvl_el.set(qn('w:val'), "0")
    numId_el = OxmlElement('w:numId')
    numId_el.set(qn('w:val'), "999")
    numPr.append(ilvl_el)
    numPr.append(numId_el)
    pPr.append(numPr)
    
    # Hide the paragraph entirely
    spacing = OxmlElement('w:spacing')
    spacing.set(qn('w:before'), "0")
    spacing.set(qn('w:after'), "0")
    spacing.set(qn('w:line'), "2")  # Effectively invisible
    spacing.set(qn('w:lineRule'), "exact")
    pPr.append(spacing)
    
    pPr_rPr = OxmlElement('w:rPr')
    pPr_rPr.append(OxmlElement('w:vanish'))
    pPr.append(pPr_rPr)

# ======================================================
# DYNAMIC CHAPTER INITIATION
# ======================================================

def start_chapter(number, title):
    global current_chapter
    current_chapter = number

    new_section = doc.add_section(WD_SECTION.NEW_PAGE)
    new_section.header.is_linked_to_previous = False
    new_section.footer.is_linked_to_previous = True # Keep footer continuous
    
    sectPr = new_section._sectPr
    
    # FIX: Clear existing page numbering settings from the new section
    # to prevent it from inheriting the "Start at 1" property.
    existing_pgNumType = sectPr.find(qn('w:pgNumType'))
    if existing_pgNumType is not None:
        sectPr.remove(existing_pgNumType)

    # Only apply "Start at 1" if it is Chapter 1
    if number == 1:
        pgNumType = OxmlElement('w:pgNumType')
        pgNumType.set(qn('w:fmt'), 'decimal')
        pgNumType.set(qn('w:start'), '1')
        sectPr.append(pgNumType)
    
    # For number > 1, we do nothing to pgNumType. 
    # Word defaults to "Continue from previous section" when no start is defined.

    add_header_footer(f"Chapter {number}. {title}")
    
    # 1. Silently advance Word's native Multilevel list
    increment_native_chapter()
    
    # 2. Add visual custom Chapter headers
    add_heading(f"CHAPTER {number}", 1)
    add_heading(title.upper(), 1)

# ======================================================
# ADD FIGURE
# ======================================================
def add_figure(image_path, caption):
    global current_chapter  
    
    fig_cfg = config["figures"]
    doc.add_picture(image_path, width=Inches(fig_cfg["width_inches"]))
    
    img_para = doc.paragraphs[-1]
    img_pf = img_para.paragraph_format
    img_pf.space_before = Pt(fig_cfg["space_before_image"])
    img_pf.space_after = Pt(fig_cfg["space_after_image"])
    img_para.alignment = WD_ALIGN_PARAGRAPH.CENTER

    p = doc.add_paragraph()
    apply_caption_style(p)
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER

    run = p.add_run(f"Figure {current_chapter}.")
    force_times_new_roman(run)
    run.font.size = Pt(fig_cfg["caption_font_size"])

    seq_run = insert_seq(p, "Figure \\s 1")
    force_times_new_roman(seq_run)
    seq_run.font.size = Pt(fig_cfg["caption_font_size"])

    run = p.add_run(". ")
    force_times_new_roman(run)
    run.font.size = Pt(fig_cfg["caption_font_size"])

    run = p.add_run(caption)
    force_times_new_roman(run)
    run.font.size = Pt(fig_cfg["caption_font_size"])
    run.bold = False
    run.italic = False

    pf = p.paragraph_format
    pf.space_before = Pt(fig_cfg["space_before_caption"])
    pf.space_after = Pt(fig_cfg["space_after_caption"])

# ======================================================
# ADD TABLE (WITH SMART SPACING)
# ======================================================
def add_custom_table(data, columns, caption=None):
    # SMART SPACING: 
    # Agar document mein already paragraphs hain, to table se pehle 1 space add karo
    # Isse tables aapas mein ya headings se chipkenge nahi.
    if len(doc.paragraphs) > 0:
        doc.add_paragraph() 
    
    # 1. ADD CAPTION FIRST
    if caption:
        add_table_caption(caption, current_chapter)
        
    # 2. Create the table
    table = doc.add_table(rows=1, cols=len(columns))
    
    # ... (Keep your existing border logic here) ...
    tbl = table._tbl
    tblPr = tbl.tblPr
    if tblPr is None:
        tblPr = OxmlElement('w:tblPr')
        tbl.append(tblPr)
        
    tblBorders = OxmlElement('w:tblBorders')
    for border_name in ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']:
        border = OxmlElement(f'w:{border_name}')
        border.set(qn('w:val'), 'single')
        border.set(qn('w:sz'), '4')
        border.set(qn('w:space'), '0')
        border.set(qn('w:color'), '000000')
        tblBorders.append(border)
    tblPr.append(tblBorders)

    # ... (Keep your existing Header/Data logic here) ...
    hdr_cells = table.rows[0].cells
    for i, column_name in enumerate(columns):
        cell = hdr_cells[i]
        cell.text = column_name
        paragraph = cell.paragraphs[0]
        run = paragraph.runs[0]
        force_times_new_roman(run)
        run.bold = True
        paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER

    for row_data in data:
        row_cells = table.add_row().cells
        for i, item in enumerate(row_data):
            cell = row_cells[i]
            cell.text = str(item)
            paragraph = cell.paragraphs[0]
            if len(paragraph.runs) > 0:
                run = paragraph.runs[0]
            else:
                run = paragraph.add_run()
            force_times_new_roman(run)
            paragraph.alignment = WD_ALIGN_PARAGRAPH.LEFT
        
    return table


def add_list_of_tables():
    p = doc.add_paragraph()
    p.style = doc.styles["Heading 1"]
    add_bottom_border(p) # Using your existing border helper

    run = p.add_run("LIST OF TABLES")
    force_times_new_roman(run)
    run.font.size = Pt(18)
    run.bold = False

    paragraph = doc.add_paragraph()
    run = paragraph.add_run()
    
    # Field Begin
    fldBegin = OxmlElement('w:fldChar')
    fldBegin.set(qn('w:fldCharType'), 'begin')
    run._r.append(fldBegin)

    # Instruction: Table of Tables
    instrText = OxmlElement('w:instrText')
    instrText.set(qn('xml:space'), 'preserve')
    instrText.text = 'TOC \\h \\z \\c "Table"'
    run._r.append(instrText)

    # Separate
    fldSeparate = OxmlElement('w:fldChar')
    fldSeparate.set(qn('w:fldCharType'), 'separate')
    run._r.append(fldSeparate)

    # Placeholder text
    text = OxmlElement('w:t')
    text.text = "Right-click and choose 'Update Field' to generate the List of Tables."
    run._r.append(text)

    # End
    fldEnd = OxmlElement('w:fldChar')
    fldEnd.set(qn('w:fldCharType'), 'end')
    run._r.append(fldEnd)

    doc.add_page_break()


def add_table_caption(caption_text, chapter_num):
    p = doc.add_paragraph()
    apply_caption_style(p) 
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    
   
    # 1. First part: "Table X."
    run = p.add_run(f"Table {chapter_num}.")
    force_times_new_roman(run)
    run.bold = False
    run.italic = True
    
    # 2. Sequence part
    seq_run = insert_seq(p, "Table \\s 1") 
    force_times_new_roman(seq_run)
    seq_run.bold = False
    seq_run.italic = True


    # 3. Text part
    run = p.add_run(". " + caption_text)
    force_times_new_roman(run)
    run.bold = False
    run.italic = True
  
# ======================================================
# FIX TOC FONT (TOC 1, TOC 2, TOC 3)
# ======================================================
def configure_toc_styles():
    for i in range(1, 4): # TOC 1, TOC 2, TOC 3
        try:
            style = doc.styles[f"TOC {i}"]
            style.font.name = "Times New Roman"
            
            # rFonts set karna zaroori hai taake Word override na kare
            rPr = style.element.get_or_add_rPr()
            rFonts = rPr.get_or_add_rFonts()
            rFonts.set(qn("w:ascii"), "Times New Roman")
            rFonts.set(qn("w:hAnsi"), "Times New Roman")
            rFonts.set(qn("w:cs"), "Times New Roman")
        except Exception:
            pass 

def apply_caption_style(paragraph):
    try:
        # Check agar 'Caption' style pehle se exist karta hai
        style = doc.styles['Caption']
    except KeyError:
        # Agar template mein Caption style na ho, to create karein
        style = doc.styles.add_style('Caption', 1) # 1 = Paragraph Style
    
    # Ab style ki properties set karein (Global update)
    style.font.name = 'Times New Roman'
    style.font.size = Pt(12)
    style.font.italic = True
    
    # Finally, paragraph par style apply karein
    paragraph.style = style



# ======================================================
# DOCUMENT PAGES BUILDING SEQUENCE
# ======================================================
add_front_matter_page("Abstract")
add_table_of_contents()
add_list_of_figures()
add_list_of_tables()
add_front_matter_page("Acknowledgement")

# ======================================================
# CHAPTER 1
# ======================================================
start_chapter(1, "Introduction")
add_body_text(
    "In today's digital era, educational institutions are increasingly adopting information systems to automate academic and administrative activities. Traditional manual methods of managing student records, faculty information, course registration, attendance, examinations, and result processing are often time-consuming, error-prone, and difficult to maintain. These challenges create inefficiencies that affect both institutional performance and user satisfaction."
)

add_body_text(
    "The proposed University Management System is designed to provide a centralized platform that integrates various academic and administrative functions into a single application. The system enables students, faculty members, and administrators to perform their respective tasks efficiently through role-based access. By digitizing routine operations, the system minimizes paperwork, improves data accuracy, enhances communication, and simplifies overall university management."
)

add_body_text(
    "This chapter presents an overview of the proposed system, including its objectives, purpose, stakeholders, expected benefits, and background study. It provides a foundation for understanding the project and explains the motivation behind developing an automated solution for university management."
)


add_heading("PROJECT OVERVIEW", 2)
add_body_text(
    "The University Management System is a web-based application designed to automate and manage various academic and administrative functions of an educational institution. The system integrates multiple modules, including student management, faculty management, course registration, attendance monitoring, examination management, and result processing, into a single centralized platform."
)

add_body_text(
    "The application provides different access levels for administrators, faculty members, and students based on their respective roles. Administrators can manage departments, users, courses, and reports, while faculty members can manage attendance, grades, and course materials. Students are provided with facilities to register courses."
)

add_heading("EXISTING SYSTEM", 2)
add_body_text(
    "Most educational institutions still rely on manual or semi-computerized systems for maintaining academic records and administrative information. These systems involve significant paperwork and require considerable human effort to perform routine tasks such as student registration, attendance management, result preparation, and report generation. The absence of centralized data management often results in duplication of records, inconsistencies, delayed processing, and increased operational costs."
)

add_figure("images/login.jpg", "Login Screen")



add_heading("PURPOSE", 2)
add_body_text(
    "The primary purpose of the proposed University Management System is to automate academic and administrative operations through a centralized and secure web-based platform. The system aims to eliminate manual record keeping, reduce paperwork, and improve the efficiency of daily institutional activities."
)

add_body_text(
    "Another important objective of the proposed system is to provide timely access to accurate information for students, faculty members, and administrators. The system facilitates better decision-making by maintaining organized records and generating reports whenever required. Overall, the project is intended to improve productivity, ensure transparency, and enhance the quality of educational management."
)


add_heading("STAKEHOLDERS", 2)
add_body_text(
    "The primary stakeholders of the proposed system include students, faculty members, administrative staff, department heads, and system administrators. Each stakeholder interacts with the system according to predefined roles and responsibilities to ensure secure and efficient operation."
)
add_figure("images/login.jpg", "Signup Screen")

add_body_text(
    "Students utilize the system for course registration, attendance monitoring, result viewing, and profile management. Faculty members manage attendance records, course materials, examinations, and grading activities. Administrative staff oversee user management, departmental operations, report generation, and overall system maintenance. The collaboration among these stakeholders ensures smooth academic and administrative functioning of the university."
)

add_heading("BENEFITS", 2)
add_body_text(
    "The proposed system provides numerous benefits to educational institutions by automating routine administrative and academic processes. It significantly reduces paperwork, minimizes human errors, improves data accuracy, and accelerates information processing. The centralized database ensures that all authorized users can access updated information whenever required."
)

# Adding Level 1 Bullets (Main bullets)
add_bullet_point("Login with username and password.", level=1 ,heading_level=2)
add_bullet_point("Role-based access control for different users.", level=1,heading_level=2)

# Adding Level 2 Bullets (Nested bullets)
add_bullet_point("Administrator access.", level=2, heading_level=2)
add_bullet_point("Faculty access.", level=2, heading_level=2)
add_bullet_point("Student access.", level=2, heading_level=2)

add_bullet_point("Password encryption using SHA-256.", level=1, heading_level=2)


add_heading("BACKGROUND STUDY", 2)
add_body_text(
    "Educational institutions across the world have increasingly adopted digital information systems to improve operational efficiency and academic management. Various University Management Systems have been developed to automate processes such as admissions, student information management, attendance monitoring, course registration, examinations, and result processing. These systems reduce manual effort while improving data consistency and accessibility."
)

# Define your headers and data
table_headers = ["ID", "Module Name", "Status","Test1","Test2"]
table_data = [
    ["1", "User Authentication", "Completed","test","test"],
    ["2", "Student Management", "In Progress","test","test"],
    ["3", "Report Generation", "Pending","test","test"]
]

# Call the function
add_custom_table(table_data, table_headers, caption="Test Table One")


# Define your headers and data
table_headers = ["ID", "Module Name", "Status","Test1","Test2"]
table_data = [
    ["1", "User Authentication", "Completed","test","test"],
    ["2", "Student Management", "In Progress","test","test"],
    ["3", "Report Generation", "Pending","test","test"]
]

# Call the function
add_custom_table(table_data, table_headers, caption="Test Table Two")

add_body_text(
    "Educational institutions across the world have increasingly adopted digital information systems to improve operational efficiency and academic management. Various University Management Systems have been developed to automate processes such as admissions, student information management, attendance monitoring, course registration, examinations, and result processing. These systems reduce manual effort while improving data consistency and accessibility."
)

add_body_text(
    "Several existing solutions provide comprehensive academic management functionalities; however, many of them are expensive, difficult to customize, or contain unnecessary features that do not satisfy the specific requirements of individual institutions. The proposed University Management System is developed after studying these existing solutions with the objective of providing a user-friendly, cost-effective, secure, and scalable platform tailored to institutional requirements."
)

# ======================================================
# CHAPTER 2
# ======================================================
start_chapter(2, "Requirements")
add_body_text(
    "This chapter presents the system requirements identified during the analysis phase of the proposed University Management System. System requirements define the functional capabilities and quality attributes that the application must satisfy to meet user expectations and business objectives. These requirements serve as the foundation for system design, development, testing, and deployment."
)

add_body_text(
    "The requirements are categorized into Functional Requirements and Non-Functional Requirements. Functional requirements describe the specific services and operations that the system must perform, whereas Non-Functional Requirements define the performance, security, reliability, usability, and other quality characteristics of the system. Proper identification of these requirements ensures that the developed application fulfills both user needs and technical standards."
)

add_heading("FUNCTIONAL REQUIREMENTS", 2)
add_body_text(
    "Functional requirements describe the core functionalities that the proposed University Management System must provide. These requirements specify how different users interact with the application and define the services that the system should perform. The following functional requirements represent the major operations supported by the proposed system."
)

# Define your headers and data
table_headers = ["ID", "Module Name", "Status","Test1","Test2"]
table_data = [
    ["1", "User Authentication", "Completed","test","test"],
    ["2", "Student Management", "In Progress","test","test"],
    ["3", "Report Generation", "Pending","test","test"]
]

# Call the function
add_custom_table(table_data, table_headers, caption="System Module Status")

add_figure("images/login.jpg", "Signup Screen")


add_heading("FR01 – User Authentication", 3)
add_body_text(
    "The system shall provide a secure authentication mechanism for all authorized users. Every user must log in using a valid username and password before accessing the application. The system shall verify user credentials and grant access according to predefined roles such as Administrator, Faculty Member, or Student.",level=3
)

# Adding Level 1 Bullets (Main bullets)
add_bullet_point("Login with username and password.", level=1 ,heading_level=3)
add_bullet_point("Role-based access control for different users.", level=1,heading_level=3)

# Adding Level 2 Bullets (Nested bullets)
add_bullet_point("Administrator access.", level=2, heading_level=3)
add_bullet_point("Faculty access.", level=2, heading_level=3)
add_bullet_point("Student access.", level=2, heading_level=3)

add_bullet_point("Password encryption using SHA-256.", level=1, heading_level=3)


add_heading("FR02 – Student Management", 3)
add_body_text(
    "The system shall provide comprehensive student management functionality that enables administrators to register new students, update student profiles, manage enrollment information, and maintain complete academic records. Student information shall be stored in a centralized database to ensure consistency and accuracy.",level=3
)


add_heading("FR03 – Report Generation", 3)
add_body_text(
    "The system shall generate various academic and administrative reports required by university management. These reports may include student enrollment statistics, attendance reports, examination results, faculty workload summaries, and departmental performance reports.",level=3
)


add_heading("NON-FUNCTIONAL REQUIREMENTS", 2)
add_body_text(
    "Non-Functional Requirements define the quality standards and operational characteristics of the proposed system. These requirements ensure that the application performs efficiently, remains secure, provides a reliable user experience, and continues to operate effectively under different conditions."
)

add_heading("NFR01 – Performance", 3)
add_body_text(
    "The proposed system shall provide fast response times during normal operation. User requests such as login, searching records, generating reports, and retrieving information should be processed efficiently without noticeable delays.",level=3
)
add_heading("NFR02 – Security", 3)
add_body_text(
    "The system shall ensure the confidentiality, integrity, and security of institutional data through proper authentication and authorization mechanisms. User passwords shall be stored securely using encryption or hashing techniques, and role-based access control shall prevent unauthorized access to sensitive information.",level=3
)

add_heading("NFR03 – Reliability", 3)
add_body_text(
    "The proposed system shall provide reliable services with minimal downtime during normal operation. Proper exception handling and error recovery mechanisms shall be implemented to ensure uninterrupted access to system functionalities.",level=3
)

# ======================================================
# COMPILING & SAVING (WITH WIN32 FIELDS UPDATE)
# ======================================================
def update_word_fields(doc_path):
    word = win32com.client.Dispatch("Word.Application")
    word.Visible = False
    doc_app = word.Documents.Open(doc_path)

    # 1) Fields Update (TOC Regenerate hoga)
    doc_app.Fields.Update()

    # 2) FORCE FONT AFTER GENERATION (Ye Step Zaroori Hai)
    # Word ke internal Styles object ko directly set karein
    for i in range(1, 4):
        try:
            style = doc_app.Styles(f"TOC {i}")
            style.Font.Name = "Times New Roman"
            style.Font.Size = 12 # Aap apni pasand ki size set kar sakte hain
        except Exception as e:
            print(f"Could not force style for TOC {i}: {e}")

    # 3) TOC aur TOF ko dubara refresh karein taake styles apply ho jayen
    for toc in doc_app.TablesOfContents:
        toc.Update()
    for tof in doc_app.TablesOfFigures:
        tof.Update()

    # 4) Final Save
    doc_app.Save()
    doc_app.Close()
    word.Quit()

    
configure_toc_styles()

OUTPUT_FILE = os.path.abspath("Final_JUW_Report_Fixed3.docx")
doc.save(OUTPUT_FILE)
update_word_fields(OUTPUT_FILE)

print("Document generated successfully.")