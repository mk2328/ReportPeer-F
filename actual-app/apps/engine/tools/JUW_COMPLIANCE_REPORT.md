# JUW FYP DOCX compliance report

- **Document:** `tools\generated_content_types_test.docx`
- **Guidelines:** `C:\Users\muskan\Documents\Report Peer AI -F\actual-app\apps\engine\templates\juw\config.json`
- **Document not modified.**

**Summary:** PASS 30 · FAIL 15 · WARNING 3 · MANUAL CHECK 1

| Status | Check | Expected | Actual | Location |
| ------ | ----- | -------- | ------ | -------- |
| PASS | A4 page size | A4 (8.27" x 11.69") | 8.268" x 11.693" | All sections / Page Setup |
| PASS | Margins (section 0) | L1.5 R1.0 T1.0 B1.0 in | L1.5 R1.0 T1.0 B1.0 in | Section 0 |
| PASS | Margins (section 1) | L1.5 R1.0 T1.0 B1.0 in | L1.5 R1.0 T1.0 B1.0 in | Section 1 |
| PASS | Body font | Times New Roman | Times New Roman | Body paragraphs |
| PASS | Body font size | 12 pt on Normal/body text | Normal style 12.0pt; 15 body runs match | Normal style / body runs |
| PASS | Body line spacing | 1.5 | 1.5 on Normal body paragraphs | Normal paragraphs |
| PASS | Body alignment | justify | justify on Normal body paragraphs | Normal paragraphs |
| PASS | Heading 1 style definition | 20pt, bold=True, all_caps=True, small_caps=False | 20.0pt, bold=True, all_caps=True, small_caps=None | Style Heading 1 |
| PASS | Heading 2 style definition | 18pt, bold=True, all_caps=True, small_caps=False | 18.0pt, bold=True, all_caps=True, small_caps=None | Style Heading 2 |
| PASS | Heading 3 style definition | 16pt, bold=True, all_caps=False, small_caps=True | 16.0pt, bold=True, all_caps=None, small_caps=True | Style Heading 3 |
| PASS | Heading 4 style definition | 14pt, bold=True, all_caps=False, small_caps=True | 14.0pt, bold=True, all_caps=None, small_caps=True | Style Heading 4 |
| PASS | Heading 5 style definition | 12pt, bold=True, all_caps=False, small_caps=True | 12.0pt, bold=True, all_caps=None, small_caps=True | Style Heading 5 |
| PASS | Applied heading run sizes / alignment | Run size matches JUW heading style; headings left-aligned | OK | Heading runs |
| WARNING | Heading numbering | Native multilevel numbers such as 1.1, 1.2, 2.1 | Could not confirm 1.1/2.1 in TOC | Table of Contents |
| PASS | Required front-matter item: Project Approval Form | Include 'Project Approval Form' | Present | Front matter |
| PASS | Required front-matter item: Abstract | Include 'Abstract' | Present | Front matter |
| PASS | Required front-matter item: Table of Contents | Include 'Table of Contents' | Present | Front matter |
| PASS | Required front-matter item: List of Figures | Include 'List of Figures' | Present | Front matter |
| PASS | Required front-matter item: List of Tables | Include 'List of Tables' | Present | Front matter |
| PASS | Required front-matter item: Acknowledgements | Include 'Acknowledgements' | Present | Front matter |
| PASS | Chapter 1 Introduction | CHAPTER 1 / Introduction | Present | Chapter 1 |
| FAIL | Chapter 1 section: Overview | Overview | Missing | Chapter 1 |
| FAIL | Chapter 1 section: Purpose | Purpose | Missing | Chapter 1 |
| FAIL | Chapter 1 section: Stakeholders | Stakeholders | Missing | Chapter 1 |
| FAIL | Chapter 1 section: Benefits | Benefits | Missing | Chapter 1 |
| FAIL | Chapter 1 section: Background Study | Background Study | Missing | Chapter 1 |
| FAIL | Chapter 2 Requirements | CHAPTER 2 / Requirements | Missing | Chapter 2 |
| FAIL | Chapter 3 Analysis and Design | CHAPTER 3 / Analysis and Design | Missing | Chapter 3 |
| FAIL | Chapter 4 Project Plan | CHAPTER 4 / Project Plan | Missing | Chapter 4 |
| FAIL | Chapter 5 Test Plan | CHAPTER 5 / Test Plan | Missing | Chapter 5 |
| FAIL | Chapter 6 Implementation Details | CHAPTER 6 / Implementation Details | Missing | Chapter 6 |
| FAIL | Chapter 7 Conclusion and Future Work | CHAPTER 7 / Conclusion and Future Work | Missing | Chapter 7 |
| PASS | Front-matter page numbers | roman | lowerRoman on section 0 | Section 0 |
| PASS | Chapter 1 page restart | Decimal numbering starts at 1 | start=1 on section 1 | Section 1 |
| PASS | Footer page-number field | bottom_center PAGE field | PAGE field present in footer | Headers/footers |
| PASS | Table of Contents | Auto-generated TOC including headings | TOC present and populated | Front matter |
| PASS | List of Figures | Include LOF | Present | Front matter |
| PASS | List of Tables | Include LOT | Present | Front matter |
| PASS | Figure captions / numbering / alignment | Figure {chapter}.{number} {title}, centered | 2 images; captions: ['Figure 1.1. Login screen', 'Figure 1.2. Signup screen'] | Figures |
| PASS | Figure width | 5.5 inches | 5.50in, 5.50in | Inline pictures |
| PASS | Table caption position | bottom | Not above table | Tables |
| WARNING | Table presence | Tables with Table X.Y captions | 2 tables | Tables |
| FAIL | Figures/tables referenced in body | Each figure/table is referenced in the text | No in-text references found | Body text |
| FAIL | References section | References chapter/section present | Missing | Back matter |
| FAIL | Citation style | [12] | None found | Body / references |
| WARNING | Total document pages | Full 7-chapter FYP length | 8 pages | Whole document |
| FAIL | Minimum 3 lines under each heading | >= 3 content paragraphs after each content heading | PROJECT APPROVAL FORM (1 lines); INTRODUCTION (1 lines); Tables (2 lines) | Chapter body headings |
| PASS | First-person / forbidden words | None of ['I', 'We', 'Us', 'Our'] (also scanned My/Me/Ours) | None found | Whole document |
| MANUAL CHECK | Required 50 UI screens | Not defined in JUW config.json; requested review is 50 UI screens | 2 images present (login.jpg reused in demo figures); no Appendix A screenshots section | Figures / missing appendix |

## Critical issues

- **Chapter 1 section: Overview** — expected `Overview`; actual `Missing` (Chapter 1)
- **Chapter 1 section: Purpose** — expected `Purpose`; actual `Missing` (Chapter 1)
- **Chapter 1 section: Stakeholders** — expected `Stakeholders`; actual `Missing` (Chapter 1)
- **Chapter 1 section: Benefits** — expected `Benefits`; actual `Missing` (Chapter 1)
- **Chapter 1 section: Background Study** — expected `Background Study`; actual `Missing` (Chapter 1)
- **Chapter 2 Requirements** — expected `CHAPTER 2 / Requirements`; actual `Missing` (Chapter 2)
- **Chapter 3 Analysis and Design** — expected `CHAPTER 3 / Analysis and Design`; actual `Missing` (Chapter 3)
- **Chapter 4 Project Plan** — expected `CHAPTER 4 / Project Plan`; actual `Missing` (Chapter 4)
- **Chapter 5 Test Plan** — expected `CHAPTER 5 / Test Plan`; actual `Missing` (Chapter 5)
- **Chapter 6 Implementation Details** — expected `CHAPTER 6 / Implementation Details`; actual `Missing` (Chapter 6)
- **Chapter 7 Conclusion and Future Work** — expected `CHAPTER 7 / Conclusion and Future Work`; actual `Missing` (Chapter 7)
- **Figures/tables referenced in body** — expected `Each figure/table is referenced in the text`; actual `No in-text references found` (Body text)
- **References section** — expected `References chapter/section present`; actual `Missing` (Back matter)
- **Citation style** — expected `[12]`; actual `None found` (Body / references)
- **Minimum 3 lines under each heading** — expected `>= 3 content paragraphs after each content heading`; actual `PROJECT APPROVAL FORM (1 lines); INTRODUCTION (1 lines); Tables (2 lines)` (Chapter body headings)
