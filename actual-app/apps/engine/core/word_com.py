import gc
import os

from core.file_io import wait_until_unlocked


def update_word_fields(doc_path: str, lists_only: bool = False, page_numbers_only: bool = False) -> bool:
    """
    Refresh Word fields (TOC, SEQ, PAGE) via desktop Word.
    Optional: generation still succeeds if Word/COM is unavailable.

    lists_only=True updates TOC/TOF only.
    page_numbers_only=True refreshes TOC/TOF page numbers without rebuilding entries.
    """
    try:
        import pythoncom
        import win32com.client
    except ImportError:
        print("Word field update skipped: pywin32 is not installed.")
        return False

    abs_path = os.path.abspath(doc_path)
    word = None
    document = None
    com_ready = False
    try:
        pythoncom.CoInitialize()
        com_ready = True
        wait_until_unlocked(abs_path)

        # New Word instance so a leftover desktop Word session cannot keep this file open.
        word = win32com.client.DispatchEx("Word.Application")
        word.Visible = False
        word.DisplayAlerts = 0
        document = word.Documents.Open(abs_path, False, False, False)

        if page_numbers_only:
            for toc in document.TablesOfContents:
                try:
                    toc.UpdatePageNumbers()
                except Exception:
                    toc.Update()
            for tof in document.TablesOfFigures:
                try:
                    tof.UpdatePageNumbers()
                except Exception:
                    tof.Update()
        else:
            if not lists_only:
                document.Fields.Update()

            for index in range(1, 6):
                try:
                    style = document.Styles(f"TOC {index}")
                    style.Font.Name = "Times New Roman"
                    style.Font.Size = 10
                    style.ParagraphFormat.SpaceBefore = 0
                    style.ParagraphFormat.SpaceAfter = 0
                    # wdLineSpaceSingle = 0
                    style.ParagraphFormat.LineSpacingRule = 0
                except Exception:
                    pass

            for toc in document.TablesOfContents:
                toc.Update()
            for tof in document.TablesOfFigures:
                tof.Update()

        document.Save()
        document.Close(SaveChanges=0)
        document = None
        word.Quit()
        word = None
        return True
    except Exception as error:
        print(f"Word field update skipped: {error}")
        return False
    finally:
        if document is not None:
            try:
                document.Close(SaveChanges=0)
            except Exception:
                pass
            document = None
        if word is not None:
            try:
                word.Quit()
            except Exception:
                pass
            word = None
        gc.collect()
        if com_ready:
            try:
                pythoncom.CoUninitialize()
            except Exception:
                pass
        try:
            wait_until_unlocked(abs_path)
        except OSError:
            pass
