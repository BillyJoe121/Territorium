import os
import sys
import docx

templates_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "plantillas documentos finales"))

files = [
    "ESCRITURA TOL-ANZ-045.docx",
    "ID02 descripción de linderos.docx",
    "MINUTA_TIPO_TERRITORIUM.docx"
]

for filename in files:
    filepath = os.path.join(templates_dir, filename)
    print("=" * 80)
    print(f"FILE: {filename}")
    print("=" * 80)
    doc = docx.Document(filepath)
    print(f"Total Paragraphs: {len(doc.paragraphs)}")
    print(f"Total Tables: {len(doc.tables)}")
    
    print("\n--- SAMPLE PARAGRAPHS (First 40 non-empty) ---")
    count = 0
    for idx, p in enumerate(doc.paragraphs):
        text = p.text.strip()
        if text:
            print(f"P[{idx}]: {text}")
            count += 1
            if count >= 35:
                break
                
    if doc.tables:
        print("\n--- TABLES SUMMARY ---")
        for t_idx, t in enumerate(doc.tables):
            print(f"\nTable {t_idx} ({len(t.rows)} rows x {len(t.columns)} cols):")
            for r_idx, row in enumerate(t.rows[:10]):
                cells = [c.text.strip().replace("\n", " | ") for c in row.cells]
                # print unique cells to avoid merged cell duplicates
                uniq = []
                for c in cells:
                    if not uniq or c != uniq[-1]:
                        uniq.append(c)
                print(f"  R{r_idx}: {uniq}")
