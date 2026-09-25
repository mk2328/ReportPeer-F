import sys
import json

print("DEBUG: Script shuru ho gayi hai...")

try:
    print("DEBUG: template-config.json dhoond raha hoon...")
    with open('template-config.json', 'r') as f:
        config = json.load(f)
    print("DEBUG: Config file mil gayi aur load ho gayi!")

    print("DEBUG: python-docx library import kar raha hoon...")
    from docx import Document
    print("DEBUG: Document class initialize kar raha hoon...")
    doc = Document()
    
    print("DEBUG: Test paragraph add kar raha hoon...")
    doc.add_paragraph("Agar ye dikh raha hai, to engine sahi chal raha hai!")
    
    print("DEBUG: File save kar raha hoon...")
    doc.save('TEST_OUTPUT.docx')
    print("DEBUG: DONE! File 'TEST_OUTPUT.docx' ban gayi hai.")

except Exception as e:
    print(f"!!! CRITICAL ERROR: {e}")

input("DEBUG: Press Enter to exit...")