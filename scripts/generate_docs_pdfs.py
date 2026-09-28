import os
import re
import sys
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        # Top banner on all pages except page 1
        if self._pageNumber > 1:
            self.setFont("Helvetica-Bold", 7.5)
            self.setFillColor(colors.HexColor("#0F2B26"))
            self.drawString(54, letter[1] - 36, "TERRITORIUM LEGALÍTICA  ·  SISTEMA EXPERTO DE INGENIERÍA JURÍDICA PREDIAL")
            self.setFont("Helvetica", 7.5)
            self.setFillColor(colors.HexColor("#64748B"))
            self.drawRightString(letter[0] - 54, letter[1] - 36, "DOCUMENTO TÉCNICO OFICIAL")
            self.setStrokeColor(colors.HexColor("#CBD5E1"))
            self.setLineWidth(0.6)
            self.line(54, letter[1] - 42, letter[0] - 54, letter[1] - 42)

        # Footer on all pages
        self.setStrokeColor(colors.HexColor("#CBD5E1"))
        self.setLineWidth(0.6)
        self.line(54, 46, letter[0] - 54, 46)
        
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))
        self.drawString(54, 32, "Territorium · Módulo de Auditoría y Verificación Probatoria  |  Confidencial")
        
        page_str = f"Página {self._pageNumber} de {page_count}"
        self.drawRightString(letter[0] - 54, 32, page_str)
        self.restoreState()


def build_styles():
    base = getSampleStyleSheet()
    
    # Custom color palette
    c_primary = colors.HexColor("#0F2B26")     # Territorium Dark Forest Emerald
    c_accent = colors.HexColor("#1E6F5C")      # Rich Green
    c_gold = colors.HexColor("#B48A3C")        # Metallic Gold
    c_dark = colors.HexColor("#1E293B")        # Slate 800
    c_muted = colors.HexColor("#475569")       # Slate 600

    styles = {
        'DocTitle': ParagraphStyle(
            'DocTitle',
            fontName='Helvetica-Bold',
            fontSize=21,
            leading=25,
            textColor=c_primary,
            spaceAfter=6,
        ),
        'DocSubtitle': ParagraphStyle(
            'DocSubtitle',
            fontName='Helvetica-Bold',
            fontSize=13,
            leading=16,
            textColor=c_accent,
            spaceAfter=4,
        ),
        'DocKicker': ParagraphStyle(
            'DocKicker',
            fontName='Helvetica-Bold',
            fontSize=8.5,
            leading=11,
            textColor=c_gold,
            spaceAfter=12,
            textTransform='uppercase',
        ),
        'Heading1': ParagraphStyle(
            'CustomH1',
            fontName='Helvetica-Bold',
            fontSize=13,
            leading=16,
            textColor=c_primary,
            spaceBefore=14,
            spaceAfter=7,
            keepWithNext=True,
        ),
        'Heading2': ParagraphStyle(
            'CustomH2',
            fontName='Helvetica-Bold',
            fontSize=10.5,
            leading=14,
            textColor=c_accent,
            spaceBefore=10,
            spaceAfter=5,
            keepWithNext=True,
        ),
        'Heading3': ParagraphStyle(
            'CustomH3',
            fontName='Helvetica-Bold',
            fontSize=9.5,
            leading=13,
            textColor=c_dark,
            spaceBefore=8,
            spaceAfter=4,
            keepWithNext=True,
        ),
        'Body': ParagraphStyle(
            'CustomBody',
            fontName='Helvetica',
            fontSize=9,
            leading=13,
            textColor=c_dark,
            spaceAfter=6,
        ),
        'Bullet': ParagraphStyle(
            'CustomBullet',
            fontName='Helvetica',
            fontSize=9,
            leading=12.5,
            textColor=c_dark,
            leftIndent=14,
            spaceAfter=3,
        ),
        'Callout': ParagraphStyle(
            'CustomCallout',
            fontName='Helvetica-Oblique',
            fontSize=8.5,
            leading=12,
            textColor=colors.HexColor("#334155"),
            leftIndent=12,
            rightIndent=12,
            spaceBefore=4,
            spaceAfter=6,
        ),
        'CodeBlock': ParagraphStyle(
            'CustomCode',
            fontName='Courier',
            fontSize=7.5,
            leading=10,
            textColor=colors.HexColor("#0F172A"),
            leftIndent=8,
            rightIndent=8,
            spaceBefore=3,
            spaceAfter=4,
        ),
        'TableHeader': ParagraphStyle(
            'TableHeader',
            fontName='Helvetica-Bold',
            fontSize=8,
            leading=10.5,
            textColor=colors.white,
            alignment=0,
        ),
        'TableCell': ParagraphStyle(
            'TableCell',
            fontName='Helvetica',
            fontSize=7.8,
            leading=10,
            textColor=c_dark,
        ),
        'TableCellBold': ParagraphStyle(
            'TableCellBold',
            fontName='Helvetica-Bold',
            fontSize=7.8,
            leading=10,
            textColor=c_primary,
        ),
    }
    return styles


def markdown_to_pdf(md_path, pdf_path):
    print(f"Compiling {md_path} -> {pdf_path}...")
    with open(md_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    doc = SimpleDocTemplate(
        pdf_path,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54,
    )
    
    styles = build_styles()
    story = []
    
    in_code_block = False
    code_lines = []
    in_table = False
    table_rows = []
    
    def format_inline(text):
        # bold **text**
        text = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', text)
        # italic *text*
        text = re.sub(r'\*(.+?)\*', r'<i>\1</i>', text)
        # inline code `code`
        text = re.sub(r'`(.+?)`', r'<font face="Courier" color="#0F2B26"><b>\1</b></font>', text)
        # clean brackets
        text = text.replace('&', '&amp;')
        # Restore XML entities
        text = text.replace('&amp;lt;', '&lt;').replace('&amp;gt;', '&gt;')
        return text

    i = 0
    total_lines = len(lines)
    while i < total_lines:
        line = lines[i].rstrip('\r\n')
        stripped = line.strip()

        # Code block toggle
        if stripped.startswith('```'):
            if in_code_block:
                in_code_block = False
                code_text = "<br/>".join([format_inline(cl.replace(' ', '&nbsp;')) for cl in code_lines])
                code_p = Paragraph(code_text, styles['CodeBlock'])
                t = Table([[code_p]], colWidths=[letter[0] - 108])
                t.setStyle(TableStyle([
                    ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F1F5F9")),
                    ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E1")),
                    ('LEFTPADDING', (0,0), (-1,-1), 8),
                    ('RIGHTPADDING', (0,0), (-1,-1), 8),
                    ('TOPPADDING', (0,0), (-1,-1), 6),
                    ('BOTTOMPADDING', (0,0), (-1,-1), 6),
                ]))
                story.append(t)
                story.append(Spacer(1, 6))
                code_lines = []
            else:
                in_code_block = True
                code_lines = []
            i += 1
            continue

        if in_code_block:
            code_lines.append(line)
            i += 1
            continue

        # Markdown Table Detection
        if stripped.startswith('|') and stripped.endswith('|'):
            # Table row
            cols = [c.strip() for c in stripped.strip('|').split('|')]
            # Check if separator row
            if all(re.match(r'^:?-+:?$', c) for c in cols):
                # separator row, skip
                i += 1
                continue
            table_rows.append(cols)
            # Look ahead if table continues
            if i + 1 < total_lines and lines[i+1].strip().startswith('|'):
                i += 1
                continue
            else:
                # End of table, render it
                num_cols = max(len(r) for r in table_rows) if table_rows else 1
                usable_width = letter[0] - 108
                
                # Column widths depending on col count
                if num_cols == 2:
                    col_widths = [usable_width * 0.30, usable_width * 0.70]
                elif num_cols == 3:
                    col_widths = [usable_width * 0.25, usable_width * 0.35, usable_width * 0.40]
                elif num_cols == 4:
                    col_widths = [usable_width * 0.22, usable_width * 0.25, usable_width * 0.28, usable_width * 0.25]
                else:
                    col_widths = [usable_width / num_cols] * num_cols

                formatted_table_data = []
                for row_idx, r in enumerate(table_rows):
                    row_cells = []
                    is_header = (row_idx == 0)
                    for col_idx, c in enumerate(r):
                        style = styles['TableHeader'] if is_header else (styles['TableCellBold'] if col_idx == 0 else styles['TableCell'])
                        p = Paragraph(format_inline(c), style)
                        row_cells.append(p)
                    # pad if fewer cols
                    while len(row_cells) < num_cols:
                        row_cells.append(Paragraph("", styles['TableCell']))
                    formatted_table_data.append(row_cells)

                tab = Table(formatted_table_data, colWidths=col_widths)
                tab.setStyle(TableStyle([
                    ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#0F2B26")),
                    ('BOTTOMPADDING', (0,0), (-1,0), 5),
                    ('TOPPADDING', (0,0), (-1,0), 5),
                    ('ALIGN', (0,0), (-1,-1), 'LEFT'),
                    ('VALIGN', (0,0), (-1,-1), 'TOP'),
                    ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
                    ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#F8FAFC")]),
                    ('LEFTPADDING', (0,0), (-1,-1), 5),
                    ('RIGHTPADDING', (0,0), (-1,-1), 5),
                    ('TOPPADDING', (0,1), (-1,-1), 4),
                    ('BOTTOMPADDING', (0,1), (-1,-1), 4),
                ]))
                story.append(tab)
                story.append(Spacer(1, 8))
                table_rows = []
                i += 1
                continue

        # Horizontal Rule
        if stripped == '---':
            story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#E2E8F0"), spaceBefore=8, spaceAfter=8))
            i += 1
            continue

        # Headings
        if stripped.startswith('# '):
            title_text = format_inline(stripped[2:])
            story.append(Paragraph(title_text, styles['DocTitle']))
            i += 1
            continue
        elif stripped.startswith('## '):
            subtitle_text = format_inline(stripped[3:])
            story.append(Paragraph(subtitle_text, styles['DocSubtitle']))
            i += 1
            continue
        elif stripped.startswith('### '):
            kicker_text = format_inline(stripped[4:])
            story.append(Paragraph(kicker_text, styles['DocKicker']))
            i += 1
            continue
        elif re.match(r'^\d+\.\s+', stripped) and not stripped.startswith(('1. ', '2. ', '3. ', '4. ', '5. ', '6. ', '7. ', '8. ', '9. ', '10. ', '11. ', '12. ', '13. ')):
            # Heading 1 with numbering (e.g., "## 1. INTRODUCCIÓN")
            pass

        # Check section headings like "1. INTRODUCCIÓN", "3. EL MODELO CANÓNICO"
        if re.match(r'^[0-9]+\.\s+[A-ZÁÉÍÓÚÑ\s]{4,}', stripped):
            story.append(Spacer(1, 4))
            story.append(Paragraph(format_inline(stripped), styles['Heading1']))
            story.append(HRFlowable(width="100%", thickness=0.8, color=colors.HexColor("#CBD5E1"), spaceBefore=2, spaceAfter=6))
            i += 1
            continue
            
        # Check subsection headings like "3.1 Unidades Estructurales"
        if re.match(r'^[0-9]+\.[0-9]+\s+', stripped):
            story.append(Spacer(1, 3))
            story.append(Paragraph(format_inline(stripped), styles['Heading2']))
            i += 1
            continue

        # Check sub-subsection headings like "A. Grupo de Negociación" or "6.1 Catálogo"
        if re.match(r'^[A-Z]\.\s+', stripped) or re.match(r'^[0-9]+\.[0-9]+\.[0-9]+\s+', stripped):
            story.append(Spacer(1, 2))
            story.append(Paragraph(format_inline(stripped), styles['Heading3']))
            i += 1
            continue

        # Bullet point
        if stripped.startswith('* ') or stripped.startswith('- '):
            bullet_text = format_inline(stripped[2:])
            story.append(Paragraph(f"•&nbsp;&nbsp;{bullet_text}", styles['Bullet']))
            i += 1
            continue

        # Numbered list item
        num_match = re.match(r'^(\d+)\.\s+(.*)$', stripped)
        if num_match:
            item_num = num_match.group(1)
            item_text = format_inline(num_match.group(2))
            story.append(Paragraph(f"<b>{item_num}.</b>&nbsp;&nbsp;{item_text}", styles['Bullet']))
            i += 1
            continue

        # Blockquote / Callout
        if stripped.startswith('> '):
            quote_text = format_inline(stripped[2:])
            callout_p = Paragraph(f"“{quote_text}”", styles['Callout'])
            t = Table([[callout_p]], colWidths=[letter[0] - 108])
            t.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F8FAFC")),
                ('LINEBEFORE', (0,0), (0,-1), 3, colors.HexColor("#1E6F5C")),
                ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
                ('LEFTPADDING', (0,0), (-1,-1), 10),
                ('RIGHTPADDING', (0,0), (-1,-1), 10),
                ('TOPPADDING', (0,0), (-1,-1), 6),
                ('BOTTOMPADDING', (0,0), (-1,-1), 6),
            ]))
            story.append(t)
            story.append(Spacer(1, 5))
            i += 1
            continue

        # Regular paragraph
        if stripped:
            story.append(Paragraph(format_inline(stripped), styles['Body']))
        else:
            story.append(Spacer(1, 4))
        
        i += 1

    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"SUCCESS: {pdf_path} generated successfully.")


if __name__ == "__main__":
    docs_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "docs"))
    
    # 1. Expedientes Report
    exp_md = os.path.join(docs_dir, "INFORME_PROCESAMIENTO_EXTRACCION_EXPEDIENTES.md")
    exp_pdf = os.path.join(docs_dir, "INFORME_PROCESAMIENTO_EXTRACCION_EXPEDIENTES.pdf")
    if os.path.exists(exp_md):
        markdown_to_pdf(exp_md, exp_pdf)
    else:
        print(f"Error: {exp_md} not found.")

    # 2. Comparator Report
    comp_md = os.path.join(docs_dir, "INFORME_COMPARADOR_DOCUMENTAL.md")
    comp_pdf = os.path.join(docs_dir, "INFORME_COMPARADOR_DOCUMENTAL.pdf")
    if os.path.exists(comp_md):
        markdown_to_pdf(comp_md, comp_pdf)
    else:
        print(f"Error: {comp_md} not found.")
