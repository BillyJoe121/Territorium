import os
import sys
import docx

templates_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "plantillas documentos finales"))

def inspect_docx(path):
    print(f"\n--- Reading DOCX: {os.path.basename(path)} ---")
    doc = docx.Document(path)
    print(f"Total Paragraphs: {len(doc.paragraphs)}")
    print(f"Total Tables: {len(doc.tables)}")
    
    print("\nFirst 15 Paragraphs:")
    for i, p in enumerate(doc.paragraphs[:15]):
        if p.text.strip():
            print(f"[{i}] {p.text.strip()[:120]}")
            
    print("\nTables info:")
    for t_idx, table in enumerate(doc.tables):
        print(f"Table {t_idx}: {len(table.rows)} rows, {len(table.columns)} cols")
        for r_idx, row in enumerate(table.rows[:3]):
            cells = [c.text.strip().replace('\n', ' ') for c in row.cells]
            print(f"  Row {r_idx}: {cells[:4]}")

inspect_docx(os.path.join(templates_dir, "ESCRITURA TOL-ANZ-045.docx"))
inspect_docx(os.path.join(templates_dir, "ID02 descripción de linderos.docx"))

# Now inspect MINUTA_TIPO_TERRITORIUM.doc
minuta_path = os.path.join(templates_dir, "MINUTA_TIPO_TERRITORIUM.doc")
print(f"\n--- Checking .doc: {minuta_path} ---")
try:
    import win32com.client
    print("win32com available, testing Word application...")
    word = win32com.client.Dispatch("Word.Application")
    word.Visible = False
    doc = word.Documents.Open(minuta_path)
    docx_minuta_path = os.path.join(templates_dir, "MINUTA_TIPO_TERRITORIUM_converted.docx")
    doc.SaveAs2(docx_minuta_path, FileFormat=16) # 16 = wdFormatXMLDocument (.docx)
    doc.Close()
    word.Quit()
    print("Successfully converted MINUTA_TIPO_TERRITORIUM.doc to .docx!")
    inspect_docx(docx_minuta_path)
except Exception as e:
    print(f"Could not convert with win32com Word: {e}")
    # Let's inspect raw text or strings
    with open(minuta_path, "rb") as f:
        content = f.read()
    # Extract readable strings
    import re
    strings = re.findall(b"[\x20-\x7e\xc0-\xff]{4,}", content)
    print(f"Extracted {len(strings)} raw strings. Sample:")
    for s in strings[:30]:
        try:
            print(s.decode('latin1', errors='ignore'))
        except:
            pass
