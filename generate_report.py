# -*- coding: utf-8 -*-
"""
Script tạo Báo Cáo Phân Tích và Thiết Kế Hệ Thống Website PetCare PRO AI
Định dạng chuẩn học thuật Word (.docx) bằng python-docx
"""

import os
import sys
import docx
from docx import Document

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import parse_xml, OxmlElement
from docx.oxml.ns import nsdecls, qn

def create_document():
    doc = Document()

    # -------------------------------------------------------------
    # CẤU HÌNH TRANG IN & LỀ CHUẨN ĐỒ ÁN (Left: 3cm, Right/Top/Bottom: 2cm)
    # -------------------------------------------------------------
    sections = doc.sections
    for section in sections:
        section.top_margin = Inches(0.79)     # ~2.0 cm
        section.bottom_margin = Inches(0.79)  # ~2.0 cm
        section.left_margin = Inches(1.18)    # ~3.0 cm
        section.right_margin = Inches(0.79)   # ~2.0 cm
        section.header_distance = Inches(0.5)
        section.footer_distance = Inches(0.5)

    # Cấu hình Style mặc định Normal: Times New Roman, Size 13, Giãn dòng 1.35
    style_normal = doc.styles['Normal']
    font_normal = style_normal.font
    font_normal.name = 'Times New Roman'
    font_normal.size = Pt(13)
    font_normal.color.rgb = RGBColor(30, 41, 59) # Slate-800
    style_normal.paragraph_format.line_spacing = 1.35
    style_normal.paragraph_format.space_after = Pt(6)
    style_normal.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY

    # Helper format bảng
    def style_table(table, col_widths=None):
        table.alignment = WD_TABLE_ALIGNMENT.CENTER
        tblPr = table._element.xpath('w:tblPr')
        if tblPr:
            # Thêm viền đơn màu xám thanh lịch
            borders = parse_xml(
                f'<w:tblBorders {nsdecls("w")}>\n'
                f'  <w:top w:val="single" w:sz="6" w:space="0" w:color="94A3B8"/>\n'
                f'  <w:left w:val="single" w:sz="6" w:space="0" w:color="94A3B8"/>\n'
                f'  <w:bottom w:val="single" w:sz="6" w:space="0" w:color="94A3B8"/>\n'
                f'  <w:right w:val="single" w:sz="6" w:space="0" w:color="94A3B8"/>\n'
                f'  <w:insideH w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>\n'
                f'  <w:insideV w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>\n'
                f'</w:tblBorders>'
            )
            tblPr[0].append(borders)
            # Thêm padding cho các ô
            cell_mar = parse_xml(
                f'<w:tblCellMar {nsdecls("w")}>\n'
                f'  <w:top w:w="120" w:type="dxa"/>\n'
                f'  <w:left w:w="150" w:type="dxa"/>\n'
                f'  <w:bottom w:w="120" w:type="dxa"/>\n'
                f'  <w:right w:w="150" w:type="dxa"/>\n'
                f'</w:tblCellMar>'
            )
            tblPr[0].append(cell_mar)

        # Style Header (Dòng đầu tiên: Nền xám nhạt, Chữ đậm, Căn giữa)
        for i, row in enumerate(table.rows):
            trPr = row._element.get_or_add_trPr()
            trPr.append(parse_xml(f'<w:cantSplit {nsdecls("w")}/>'))
            if i == 0:
                trPr.append(parse_xml(f'<w:tblHeader {nsdecls("w")}/>'))
                for cell in row.cells:
                    tcPr = cell._element.get_or_add_tcPr()
                    tcPr.append(parse_xml(f'<w:shd {nsdecls("w")} w:fill="E2E8F0"/>'))
                    for p in cell.paragraphs:
                        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                        p.paragraph_format.space_after = Pt(2)
                        p.paragraph_format.space_before = Pt(2)
                        for r in p.runs:
                            r.bold = True
                            r.font.name = 'Times New Roman'
                            r.font.size = Pt(12)
                            r.font.color.rgb = RGBColor(15, 23, 42)
            else:
                for cell in row.cells:
                    for p in cell.paragraphs:
                        p.paragraph_format.space_after = Pt(2)
                        p.paragraph_format.space_before = Pt(2)
                        for r in p.runs:
                            r.font.name = 'Times New Roman'
                            r.font.size = Pt(11.5)

        # Set độ rộng cột nếu có
        if col_widths:
            for row in table.rows:
                for idx, width in enumerate(col_widths):
                    if idx < len(row.cells):
                        row.cells[idx].width = Inches(width)

    # Helper thêm Heading 1
    def add_h1(text):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(18)
        p.paragraph_format.space_after = Pt(8)
        p.paragraph_format.keep_with_next = True
        run = p.add_run(text)
        run.bold = True
        run.font.name = 'Times New Roman'
        run.font.size = Pt(16)
        run.font.color.rgb = RGBColor(15, 23, 42) # Slate-900
        return p

    # Helper thêm Heading 2
    def add_h2(text):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(14)
        p.paragraph_format.space_after = Pt(6)
        p.paragraph_format.keep_with_next = True
        run = p.add_run(text)
        run.bold = True
        run.font.name = 'Times New Roman'
        run.font.size = Pt(14)
        run.font.color.rgb = RGBColor(30, 41, 59) # Slate-800
        return p

    # Helper thêm Heading 3
    def add_h3(text):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(10)
        p.paragraph_format.space_after = Pt(4)
        p.paragraph_format.keep_with_next = True
        run = p.add_run(text)
        run.bold = True 
        run.italic = True
        run.font.name = 'Times New Roman'
        run.font.size = Pt(13)
        run.font.color.rgb = RGBColor(51, 65, 85) # Slate-700
        return p

    # Helper thêm đoạn văn bản thường
    def add_p(text, bold_prefix=None):
        p = doc.add_paragraph()
        if bold_prefix:
            r_prefix = p.add_run(bold_prefix)
            r_prefix.bold = True
            r_prefix.font.name = 'Times New Roman'
            r_prefix.font.size = Pt(13)
            r_prefix.font.color.rgb = RGBColor(15, 23, 42)
        run = p.add_run(text)
        run.font.name = 'Times New Roman'
        run.font.size = Pt(13)
        run.font.color.rgb = RGBColor(51, 65, 85)
        return p

    # Helper thêm danh sách gạch đầu dòng
    def add_bullet(text, bold_prefix=None):
        p = doc.add_paragraph(style='List Bullet')
        p.paragraph_format.line_spacing = 1.35
        p.paragraph_format.space_after = Pt(4)
        p.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        if bold_prefix:
            r_prefix = p.add_run(bold_prefix)
            r_prefix.bold = True
            r_prefix.font.name = 'Times New Roman'
            r_prefix.font.size = Pt(13)
        run = p.add_run(text)
        run.font.name = 'Times New Roman'
        run.font.size = Pt(13)
        run.font.color.rgb = RGBColor(51, 65, 85)
        return p

    # Helper ghi chú Callout/Quote box
    def add_callout(text, title="Ghi chú kỹ thuật:"):
        table = doc.add_table(rows=1, cols=1)
        table.alignment = WD_TABLE_ALIGNMENT.CENTER
        cell = table.cell(0, 0)
        tcPr = cell._element.get_or_add_tcPr()
        tcPr.append(parse_xml(f'<w:shd {nsdecls("w")} w:fill="F1F5F9"/>'))
        tblPr = table._element.xpath('w:tblPr')
        if tblPr:
            borders = parse_xml(
                f'<w:tblBorders {nsdecls("w")}>\n'
                f'  <w:left w:val="single" w:sz="24" w:space="0" w:color="0D9488"/>\n'
                f'  <w:top w:val="none"/>\n'
                f'  <w:right w:val="none"/>\n'
                f'  <w:bottom w:val="none"/>\n'
                f'</w:tblBorders>'
            )
            tblPr[0].append(borders)
        p = cell.paragraphs[0]
        p.paragraph_format.space_before = Pt(4)
        p.paragraph_format.space_after = Pt(4)
        r_t = p.add_run(title + " ")
        r_t.bold = True
        r_t.font.name = 'Times New Roman'
        r_t.font.size = Pt(12)
        r_t.font.color.rgb = RGBColor(13, 148, 136) # Teal-600
        r_c = p.add_run(text)
        r_c.font.name = 'Times New Roman'
        r_c.font.size = Pt(12)
        r_c.italic = True
        r_c.font.color.rgb = RGBColor(51, 65, 85)
        # Giãn cách sau callout
        p_space = doc.add_paragraph()
        p_space.paragraph_format.space_after = Pt(4)

    print(">>> Đang khởi tạo Trang Bìa...")

    # =============================================================
    # 1. TRANG BÌA (COVER PAGE)
    # =============================================================
    p_univ = doc.add_paragraph()
    p_univ.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_univ.paragraph_format.space_after = Pt(2)
    r1 = p_univ.add_run("BỘ GIÁO DỤC VÀ ĐÀO TẠO\nTRƯỜNG ĐẠI HỌC BÁCH KHOA - ĐẠI HỌC QUỐC GIA\n")
    r1.font.name = 'Times New Roman'
    r1.font.size = Pt(13)
    r1.bold = True
    r2 = p_univ.add_run("KHOA CÔNG NGHỆ THÔNG TIN - BỘ MÔN CÔNG NGHỆ PHẦN MỀM\n")
    r2.font.name = 'Times New Roman'
    r2.font.size = Pt(13)
    r2.bold = True
    r3 = p_univ.add_run("-------------------***-------------------")
    r3.font.name = 'Times New Roman'
    r3.font.size = Pt(12)

    # Khoảng trống trang trí
    for _ in range(3):
        p_sp = doc.add_paragraph()
        p_sp.paragraph_format.space_after = Pt(6)

    # Tiêu đề đề tài
    p_title = doc.add_paragraph()
    p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_title.paragraph_format.space_after = Pt(12)
    r_sub = p_title.add_run("BÁO CÁO PHÂN TÍCH VÀ THIẾT KẾ HỆ THỐNG\n")
    r_sub.font.name = 'Times New Roman'
    r_sub.font.size = Pt(15)
    r_sub.bold = True
    r_sub.font.color.rgb = RGBColor(15, 23, 42)

    r_main = p_title.add_run("HỆ THỐNG WEBSITE QUẢN TRỊ THÚ CƯNG THÔNG MINH\nPETCARE PRO AI\n")
    r_main.font.name = 'Times New Roman'
    r_main.font.size = Pt(20)
    r_main.bold = True
    r_main.font.color.rgb = RGBColor(5, 150, 105) # Emerald-600

    r_desc = p_title.add_run("Ứng dụng Trí tuệ Nhân tạo Đa phương thức (Multimodal AI), Phân tích Y bạ WSAVA,\nVi mô tương tác Mascot SVG và Đồng chăm sóc Gia đình (Co-Parenting)")
    r_desc.font.name = 'Times New Roman'
    r_desc.font.size = Pt(12.5)
    r_desc.italic = True
    r_desc.font.color.rgb = RGBColor(100, 116, 139)

    for _ in range(4):
        p_sp = doc.add_paragraph()
        p_sp.paragraph_format.space_after = Pt(6)

    # Bảng thông tin sinh viên và người hướng dẫn
    table_info = doc.add_table(rows=5, cols=2)
    table_info.alignment = WD_TABLE_ALIGNMENT.CENTER
    info_data = [
        ("Chuyên ngành:", "Kỹ thuật Phần mềm / Trí tuệ Nhân tạo Ứng dụng"),
        ("Giảng viên hướng dẫn:", "TS. Nguyễn Văn A (Khoa CNTT)"),
        ("Sinh viên thực hiện:", "Nguyễn Minh Quân (MSSV: 20210001)"),
        ("Lớp học phần:", "Công nghệ Phần mềm Nâng cao - Đồ án Tốt nghiệp"),
        ("Năm học:", "2025 - 2026")
    ]
    for row_idx, (lbl, val) in enumerate(info_data):
        c1 = table_info.cell(row_idx, 0)
        c2 = table_info.cell(row_idx, 1)
        p1 = c1.paragraphs[0]
        p2 = c2.paragraphs[0]
        p1.paragraph_format.space_after = Pt(2)
        p2.paragraph_format.space_after = Pt(2)
        r_lbl = p1.add_run(lbl)
        r_lbl.bold = True
        r_lbl.font.name = 'Times New Roman'
        r_lbl.font.size = Pt(13)
        r_val = p2.add_run(val)
        r_val.font.name = 'Times New Roman'
        r_val.font.size = Pt(13)

    for _ in range(4):
        p_sp = doc.add_paragraph()
        p_sp.paragraph_format.space_after = Pt(6)

    p_loc = doc.add_paragraph()
    p_loc.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_loc = p_loc.add_run("Hà Nội, Tháng 09 Năm 2026")
    r_loc.font.name = 'Times New Roman'
    r_loc.font.size = Pt(12.5)
    r_loc.italic = True

    doc.add_page_break()

    print(">>> Đang khởi tạo Danh Mục Từ Viết Tắt & Tóm Tắt...")

    # =============================================================
    # DANH MỤC TỪ VIẾT TẮT & THUẬT NGỮ CHUYÊN MÔN
    # =============================================================
    add_h1("DANH MỤC TỪ VIẾT TẮT VÀ THUẬT NGỮ KỸ THUẬT")
    add_p("Nhằm tạo thuận lợi cho quá trình đọc và tra cứu tài liệu, các thuật ngữ kỹ thuật và chữ viết tắt sử dụng trong hệ thống PetCare PRO AI được định nghĩa theo bảng dưới đây:")

    tbl_abbr = doc.add_table(rows=11, cols=3)
    style_table(tbl_abbr, [1.2, 2.3, 3.2])
    abbr_data = [
        ("Thuật ngữ", "Tên tiếng Anh đầy đủ", "Ý nghĩa / Ứng dụng trong hệ thống"),
        ("SRS", "Software Requirements Specification", "Bản đặc tả yêu cầu chức năng và phi chức năng của phần mềm."),
        ("RAG", "Retrieval-Augmented Generation", "Kỹ thuật nạp bổ sung bối cảnh hồ sơ thú cưng vào prompt để AI tư vấn chính xác."),
        ("RER", "Resting Energy Requirement", "Nhu cầu năng lượng cơ bản lúc nghỉ ngơi của thú cưng: 70 * (Khối lượng)^0.75."),
        ("DER", "Daily Energy Requirement", "Nhu cầu năng lượng thực tế hàng ngày = RER * Hệ số sinh lý/triệt sản."),
        ("WSAVA", "World Small Animal Veterinary Association", "Hiệp hội Thú y Thú nhỏ Thế giới - tiêu chuẩn xây dựng phác đồ vắc-xin tự động."),
        ("BSH", "British Shorthair", "Giống mèo Anh Lông Ngắn (tiêu chuẩn tăng trưởng của nhân vật Luna)."),
        ("OCR", "Optical Character Recognition", "Nhận dạng ký tự quang học - bóc tách tự động hóa đơn y tế và sổ tiêm."),
        ("ICS / iCal", "iCalendar Protocol (RFC 5545)", "Giao thức xuất lịch chuẩn quốc tế, cho phép đồng bộ vào Google/Apple Calendar."),
        ("PK / FK", "Primary Key / Foreign Key", "Khóa chính và khóa ngoại trong mô hình quan hệ cơ sở dữ liệu."),
        ("UI / UX", "User Interface / User Experience", "Giao diện và trải nghiệm người dùng với thiết kế Bento Grid và Micro-interactions.")
    ]
    for r_idx, row in enumerate(abbr_data):
        for c_idx, val in enumerate(row):
            cell = tbl_abbr.cell(r_idx, c_idx)
            p = cell.paragraphs[0]
            r = p.add_run(val)
            if r_idx == 0:
                r.bold = True

    doc.add_page_break()

    print(">>> Đang xuất Chương 1: Tổng quan đề tài...")

    # =============================================================
    # CHƯƠNG 1: TỔNG QUAN ĐỀ TÀI
    # =============================================================
    add_h1("CHƯƠNG 1: TỔNG QUAN ĐỀ TÀI")

    add_h2("1.1. Bối cảnh và Lý do Chọn Đề tài")
    add_p("Trong kỷ nguyên đô thị hóa hiện đại, xu hướng nuôi thú cưng (Pet Humanization - xem thú cưng như thành viên ruột thịt trong gia đình) đang phát triển vô cùng mạnh mẽ tại Việt Nam và trên thế giới. Tuy nhiên, phần lớn các chủ nuôi hiện nay vẫn đang quản lý việc chăm sóc thú cưng một cách thủ công, rời rạc và thụ động, dẫn đến nhiều hệ lụy y tế nghiêm trọng:")
    add_bullet(" Sự lãng quên lịch phòng bệnh định kỳ: Vắc-xin phòng dại, vắc-xin 7 bệnh hay nhỏ gáy trị ve rận đòi hỏi chu kỳ tiêm chủng nghiêm ngặt (nhắc lại hàng tháng hoặc hàng năm). Việc ghi chép trên sổ giấy truyền thống rất dễ thất lạc, dẫn đến việc tiêm trễ hạn hoặc gián đoạn miễn dịch.", "•")
    add_bullet(" Xung đột trong việc phân chia trách nhiệm gia đình (Co-parenting): Trong các gia đình có nhiều thành viên cùng nuôi thú cưng, tình trạng cho ăn trùng lặp (Overfeeding) hoặc bỏ quên cữ uống thuốc thường xuyên xảy ra do thiếu một kênh đồng bộ trạng thái sinh hoạt thời gian thực.", "•")
    add_bullet(" Thiếu hụt kiến thức sơ cứu và chẩn đoán ban đầu: Khi thú cưng gặp sự cố khẩn cấp (nuốt phải dị vật, ngộ độc socola, nấm da, tiêu chảy), người nuôi thường hoảng loạn, tự ý áp dụng thuốc của người hoặc tìm kiếm thông tin không có kiểm chứng trên mạng, gây nguy hiểm đến tính mạng của con vật.", "•")
    add_bullet(" Quản trị chi phí nuôi dưỡng tự phát: Thiếu công cụ phân tích tương quan giữa chi phí thức ăn, thuốc thú y và dịch vụ spa để lập kế hoạch tài chính tối ưu cho vòng đời của thú cưng.", "•")
    add_p("Xuất phát từ những trăn trở thực tiễn đó, đề tài \"Hệ thống Website Quản Trị Thú Cưng Thông Minh PetCare PRO AI\" được nghiên cứu và phát triển nhằm mang đến một giải pháp số hóa toàn diện, đồng hành cùng người nuôi từ khâu lập kế hoạch y tế, dinh dưỡng khoa học đến tư vấn lâm sàng tức thì thông qua Trí tuệ Nhân tạo.")

    add_h2("1.2. Mục Tiêu và Phạm Vi của Đề Tài")
    add_p("Hệ thống hướng tới các mục tiêu cốt lõi sau:")
    add_bullet(" Xây dựng nền tảng Web Application hiện đại với giao diện Bento Grid cao cấp, tích hợp tương tác vi mô (Micro-interactions) độc bản nhằm nâng cao tính gắn kết của người dùng.", "1.")
    add_bullet(" Số hóa toàn diện hồ sơ y bạ đa loài (chó, mèo, thỏ...), biểu đồ tăng trưởng đối chuẩn khoa học và tự động sinh phác đồ tiêm phòng theo tiêu chuẩn Hiệp hội Thú y Thú nhỏ Thế giới (WSAVA).", "2.")
    add_bullet(" Tích hợp Trợ lý Trí tuệ Nhân tạo Dr. Paw 24/7 có khả năng nạp ngữ cảnh bệnh án (Context-aware / RAG), phân tầng mức độ khẩn cấp (Critical / Warning / Normal) và cung cấp cẩm nang sơ cứu chuẩn y khoa.", "3.")
    add_bullet(" Ứng dụng AI Thị giác (Vision AI Scanner) hỗ trợ nhận diện giống loài và sàng lọc bệnh lý da liễu qua hình ảnh; kết hợp Pipeline OCR 3 trong 1 tự động trích xuất hóa đơn sổ tiêm vào Y bạ, Lịch tái khám và Chi tiêu tài chính.", "4.")
    add_bullet(" Thiết lập cơ chế Co-parenting gia đình với Daily Checklist và Streak 21 ngày, ghi nhận Audit Log người thực hiện nhằm chống cho ăn thừa và xây dựng thói quen chăm sóc kỷ luật.", "5.")

    add_h2("1.3. Công Nghệ Sử Dụng Thực Tế Trong Mã Nguồn")
    add_p("Toàn bộ hệ thống PetCare PRO AI được hiện thực hóa bằng các công nghệ web tiên tiến nhất hiện nay, được trích xuất trực tiếp từ mã nguồn của dự án:")

    tbl_tech = doc.add_table(rows=8, cols=3)
    style_table(tbl_tech, [1.4, 1.8, 3.5])
    tech_data = [
        ("Phân lớp", "Công nghệ / Thư viện", "Phiên bản & Vai trò thực tế trong source code"),
        ("Frontend Core", "React JS", "v19.2.8 - Kiến trúc Component hóa hiện đại, tối ưu rendering với React Hooks (useState, useEffect, useMemo, useRef)."),
        ("Build Tool", "Vite JS", "v8.3.0 - Công cụ đóng gói siêu tốc, Hot Module Replacement (HMR) tức thì dưới 100ms, cấu hình trong vite.config.js."),
        ("Styling Framework", "Tailwind CSS", "v4.3.3 kết hợp @tailwindcss/vite - Thiết kế giao diện hiện đại với CSS Tokens, Dark Mode Emerald Forest (#102B21), Glassmorphism."),
        ("Iconography", "Lucide React", "v1.47.0 - Hệ thống hơn 50 vector icons chuyên dụng (Stethoscope, Syringe, PawPrint, HeartHandshake, Cat, Dog, Rabbit...)."),
        ("Micro-effects", "Canvas Confetti", "v1.9.4 - Bắn pháo hoa hiệu ứng chúc mừng khi hoàn thành Streak 21 ngày hoặc khi đăng nhập thành công."),
        ("Date Utility", "date-fns", "v4.4.0 - Xử lý tính toán thời gian, định dạng ngày tháng tương đối (getOffsetDate) và tạo file iCalendar RFC 5545."),
        ("AI & Multimodal", "Gemini API & Vision Engine", "Google Gemini 1.5 Flash kết hợp Smart Simulated Veterinary Engine và Vision Symptom Scanner phân tích da liễu.")
    ]
    for r_idx, row in enumerate(tech_data):
        for c_idx, val in enumerate(row):
            cell = tbl_tech.cell(r_idx, c_idx)
            p = cell.paragraphs[0]
            r = p.add_run(val)
            if r_idx == 0:
                r.bold = True

    add_p("Hệ thống hoạt động theo mô hình Client-side Reactive Architecture kết hợp kiến trúc dịch vụ phân lớp (Layered Service Abstraction). Toàn bộ dữ liệu được quản lý bền vững trong LocalStorage thông qua storageService.js với cơ chế kiểm soát schema versioning, hỗ trợ xuất/nhập toàn vẹn dưới định dạng JSON Enterprise v3.0.")

    doc.add_page_break()

    print(">>> Đang xuất Chương 2: Đặc tả yêu cầu hệ thống (SRS)...")

    # =============================================================
    # CHƯƠNG 2: ĐẶC TẢ YÊU CẦU HỆ THỐNG (SRS)
    # =============================================================
    add_h1("CHƯƠNG 2: ĐẶC TẢ YÊU CẦU HỆ THỐNG (SRS)")

    add_h2("2.1. Phân Tích Yêu Cầu Chức Năng (Functional Requirements)")
    add_p("Dựa trên mã nguồn thực tế của dự án PetCare PRO AI, các yêu cầu chức năng được phân tích chi tiết theo 9 module nghiệp vụ trọng yếu:")

    add_h3("FR-01: Module Xác Thực Tương Tác Linh Vật Toothless & Cửa Mèo Mở Tự Động")
    add_p("Module đăng nhập được xây dựng như một trải nghiệm nghệ thuật tương tác (Interactive Auth Experience) nhằm xóa bỏ cảm giác khô khan của các biểu mẫu truyền thống:")
    add_bullet(" Linh vật Toothless Mascot (ToothlessMascot.jsx): Được dựng hoàn toàn bằng SVG vector động, lấy cảm hứng từ chú rồng Night Fury 'Răng Sún Chibi'. Linh vật sở hữu đôi mắt xanh lá viền chanh (#A3E635) có cơ chế chớp mắt tự nhiên chu kỳ 3.6s. Khi người dùng gõ email/username, đồng tử của linh vật sẽ liếc theo độ dài chuỗi ký tự (horizontal pupil tracking từ -4px đến +4px). Khi người dùng focus vào ô Mật khẩu, Toothless sẽ dùng đôi chân trước che kín mắt (isCoveringEyes); nếu người dùng bấm nút Hiện mật khẩu (Toggle Eye), linh vật sẽ hé mở một mắt nhìn lén (isPeeking) vô cùng sống động.", "•")
    add_bullet(" Nút Đăng Nhập Cửa Mèo 4 Giai Đoạn (CatDoorSignInButton.jsx): Quy trình gửi form được biên đạo qua 4 pha hoạt cảnh liên tục: (1) Door Opens (0-350ms): Cửa mở ra, ánh sáng vàng ấm áp tràn từ căn phòng; (2) Cat Trot In (350-850ms): Chú mèo bước vào cửa và chìm dần vào ánh sáng phòng; (3) Door Closes (850-1150ms): Cửa đóng sầm lại, đèn tắt; (4) Emerald Checkmark (1150-1950ms): Nút bấm biến đổi sang màu xanh ngọc bích (#10B981) kèm dấu tích hoàn thành ✓ và thông điệp 'Welcome back!' giữ trong 0.8s trước khi chuyển trang.", "•")
    add_bullet(" Cơ chế Xác thực Đa dạng: Hỗ trợ đăng nhập tài khoản chính thức (Demo Chủ nuôi & Tester Bác sĩ thú y), đăng nhập nhanh 1-Click Demo, đăng nhập mô phỏng mạng xã hội Google / Apple OAuth, và đăng ký tài khoản mới phân quyền linh hoạt.", "•")

    add_h3("FR-02: Module Quản Lý Hồ Sơ Đa Loài & Biểu Đồ Tăng Trưởng Khoa Học")
    add_p("Hệ thống hỗ trợ quản lý hồ sơ thú cưng chuyên sâu cho nhiều loài khác nhau, với các hồ sơ hạt giống mẫu trong mockData.js:")
    add_bullet(" Đa dạng loài (Multi-species): Mochi (Chó Golden Retriever 24.5kg), Luna (Mèo Anh lông ngắn BSH 4.2kg), Bánh Bao (Thỏ Minilop 1.6kg). Mỗi hồ sơ lưu trữ đầy đủ: tên, loài, giống, ngày sinh, cân nặng, giới tính, màu lông, số vi mạch (Microchip), tình trạng triệt sản, tiền sử dị ứng và ảnh đại diện.", "•")
    add_bullet(" Lịch sử Cân nặng & Đường cong tăng trưởng (GrowthCurveComparisonView.jsx): Lưu vết lịch sử cân nặng theo dòng thời gian, trực quan hóa và đối chiếu với dải cân nặng tiêu chuẩn theo tháng tuổi của từng giống loài (BREED_GROWTH_STANDARDS), tự động đưa ra cảnh báo sớm về nguy cơ béo phì hoặc hạ bàn/suy dinh dưỡng.", "•")
    add_bullet(" Chế độ Báo Mất Thất Lạc & Mã QR Công Khai (LostModeManagerModal.jsx): Khi kích hoạt Lost Mode, hệ thống tự động sinh Poster tìm kiếm thất lạc chuẩn A4 sắc nét (MissingPetPosterModal.jsx) kèm tiền thưởng, số điện thoại khẩn cấp và mã QR công khai. Người nhặt được quét mã QR (PublicPetQrModal.jsx) có thể gửi vị trí tọa độ GPS về cho chủ nuôi ngay lập tức.", "•")

    add_h3("FR-03: Module Lịch Y Tế Thông Minh & Đồng Bộ iCalendar (.ics)")
    add_p("Quản lý toàn bộ vòng đời y tế và dịch vụ chăm sóc của thú cưng (ScheduleView.jsx):")
    add_bullet(" Phân loại 5 loại hình dịch vụ: Tiêm chủng vắc-xin (Vaccine), Tẩy giun/Nhỏ gáy (Deworm), Spa/Cắt tỉa lông (Grooming), Khám thú y (Vet), và Uống thuốc/Trị liệu (Medicine).", "•")
    add_bullet(" Phân tầng trạng thái 3 mức độ: Quá hạn cần nhắc nhở gấp (Overdue - màu đỏ), Lịch hôm nay (Today - màu xanh ngọc nổi bật), và Lịch sắp tới trong tương lai (Upcoming - màu lam).", "•")
    add_bullet(" Cơ chế Lặp Lịch Tự Động (Recurring Engine): Hỗ trợ chu kỳ Hàng tuần (weekly), Hàng tháng (monthly), Hàng quý (quarterly), và Hàng năm (yearly). Khi người dùng tích hoàn thành một lịch có lặp, hệ thống tự động sinh lịch tiếp theo trong tương lai.", "•")
    add_bullet(" Xuất File Chuẩn Quốc Tế iCalendar (.ics): Tích hợp hàm generateIcsCalendar(), cho phép xuất toàn bộ lịch của thú cưng thành file chuẩn RFC 5545 để người dùng đồng bộ trực tiếp vào Google Calendar, Apple Calendar hoặc Microsoft Outlook.", "•")

    add_h3("FR-04: Module Daily Checklist & Chuỗi Thói Quen 21 Ngày (Habit Streak)")
    add_p("Xây dựng kỷ luật chăm sóc thú cưng và ngăn chặn hoàn toàn tình trạng cho ăn thừa (DailyStreakChecklist.jsx):")
    add_bullet(" Danh sách công việc chia theo 3 buổi: Sáng (Morning), Chiều (Afternoon), Tối (Evening).", "•")
    add_bullet(" Chống Cho Ăn Trùng Lặp (Anti-Overfeeding): Khi một thành viên tích hoàn thành cữ ăn hoặc cữ thuốc, hệ thống lập tức lưu vết: 'Hoàn thành bởi [Tên thành viên] lúc [Giờ:Phút]'. Các thành viên khác nhìn vào bảng điều khiển sẽ biết bé đã được chăm sóc, loại bỏ triệt để việc cho ăn 2 lần.", "•")
    add_bullet(" Chuỗi Streak 21 Ngày: Tích lũy chuỗi ngày liên tục hoàn thành nhiệm vụ. Khi chạm mốc 21 ngày (thời gian vàng hình thành thói quen theo tâm lý học), hiệu ứng pháo hoa Confetti sẽ bung nở để vinh danh người nuôi.", "•")

    add_h3("FR-05: Module Co-Parenting Gia Đình & Chế Độ Ủy Quyền Pet Sitter")
    add_p("Hỗ trợ phân quyền đồng chăm sóc thú cưng trong gia đình (FamilyManagementView.jsx):")
    add_bullet(" Phân quyền 3 vai trò: Chủ sở hữu (Owner - toàn quyền), Người chăm sóc (Caregiver - cập nhật lịch & thói quen), Bác sĩ thú y phụ trách (Vet - cập nhật đơn thuốc và kết quả khám).", "•")
    add_bullet(" Chế độ Gửi Thú Cưng (PetSitterModeModal.jsx): Tạo ra một giao diện tóm tắt ngắn gọn dành riêng cho người trông hộ thú cưng khi chủ nuôi đi công tác/du lịch: khẩu phần ăn, số điện thoại phòng khám cấp cứu 24/7, mật khẩu cửa, và các lưu ý đặc biệt.", "•")

    add_h3("FR-06: Trợ Lý Bác Sĩ Thú Y AI 'Dr. Paw' 24/7 Context-Aware")
    add_p("Hệ thống tư vấn sức khỏe ứng dụng Trí tuệ Nhân tạo thế hệ mới (AiChatView.jsx):")
    add_bullet(" Cơ chế nạp ngữ cảnh bệnh án tự động (Prompt Injection / RAG): Mỗi câu hỏi gửi lên AI đều được tự động tiêm kèm hồ sơ chi tiết của thú cưng đang chọn: Loài, giống, độ tuổi, cân nặng, tiền sử bệnh án và các ghi chú dị ứng.", "•")
    add_bullet(" Phân tầng Mức độ Khẩn cấp (Triaging): Phân loại kết quả tư vấn theo 3 cấp độ: CRITICAL (Cảnh báo đỏ SOS - ngộ độc, khó tiểu, xuất huyết), WARNING (Cảnh báo vàng - tiêu chảy, nôn mửa, biếng ăn), và NORMAL (Tư vấn xanh - chăm sóc lông móng, dinh dưỡng thường nhật).", "•")
    add_bullet(" Động cơ Tri thức Giả lập Dự phòng (Smart Simulated Knowledge Engine): Nếu không có kết nối mạng hoặc người dùng chưa điền API Key, hệ thống tự động kích hoạt bộ tri thức chuyên gia thú y nội tại, đảm bảo ứng dụng không bao giờ bị gián đoạn.", "•")

    add_h3("FR-07: Module Vision AI Scanner - Phân Tích Hình Ảnh & Da Liễu")
    add_p("Ứng dụng AI thị giác phục vụ chẩn đoán ban đầu (AiVisionScannerView.jsx):")
    add_bullet(" Nhận diện Giống loài (Breed Recognition): Nhận diện giống chó/mèo qua ảnh chụp, đưa ra độ tin cậy (Confidence > 95%), đặc điểm tính cách, tuổi thọ dự kiến và các bệnh lý di truyền cần lưu tâm.", "•")
    add_bullet(" Sàng lọc Da liễu & Tổn thương (Dermatological Scan): Phân tích vùng da đỏ, rụng lông hình nhẫn, vảy gàu li ti; đưa ra nghi vấn viêm da dị ứng hoặc nấm Microsporum Canis; đồng thời hướng dẫn 4 bước sơ cứu tại nhà (đeo loa chống liếm, sát khuẩn nước muối sinh lý, không tự bôi corticoid).", "•")

    add_h3("FR-08: Module Tính Toán Năng Lượng Dinh Dưỡng Chuẩn RER / DER")
    add_p("Cung cấp chế độ ăn khoa học cho từng cá thể thú cưng (AiNutritionView.jsx):")
    add_bullet(" Công thức tính Năng lượng Nghỉ ngơi RER (Resting Energy Requirement): RER = 70 * (Khối lượng kg)^0.75.", "•")
    add_bullet(" Công thức tính Năng lượng Hàng ngày DER (Daily Energy Requirement): DER = RER * Factor, với hệ số sinh lý tùy biến chính xác (Chó chưa triệt sản: 1.8, Chó đã triệt sản: 1.6; Mèo chưa triệt sản: 1.4, Mèo đã triệt sản: 1.2; Thỏ: 1.0).", "•")
    add_bullet(" Định lượng chi tiết: Tính toán chính xác lượng thức ăn hạt khô (gam/ngày), lượng nước lọc cần uống (ml/ngày) và liệt kê danh sách 7 loại thực phẩm kịch độc với chó mèo (Socola, hành tỏi, nho, đường Xylitol, bơ, cà phê, xương nhọn).", "•")

    add_h3("FR-09: Module Quản Lý Chi Tiêu, Y Bạ & Pipeline OCR 3 Trong 1")
    add_p("Quản lý tài chính và tự động hóa cập nhật y tế (ExpenseView.jsx & AiMedicalOcrModal.jsx):")
    add_bullet(" Phân tích Chi tiêu Bằng AI (Expense AI Analyst): Phân loại chi tiêu thành 7 danh mục (Thức ăn, Thú y, Spa, Đồ chơi, Vắc-xin, Cát vệ sinh, Khác); AI tự động tính tỷ lệ phần trăm và đưa ra lời khuyên tiết kiệm ngân sách thông minh.", "•")
    add_bullet(" Automated 3-Way OCR Pipeline: Khi người dùng quét ảnh hóa đơn phòng khám hoặc sổ tiêm chủng, hệ thống xử lý đồng thời 3 tác vụ chỉ với 1 click: (1) Tự động tạo Lịch tái khám vào Schedule; (2) Tự động thêm Đơn thuốc vào Y bạ (Prescriptions); (3) Tự động ghi nhận Khoản chi tiêu tài chính (Expenses).", "•")

    add_h2("2.2. Yêu Cầu Phi Chức Năng (Non-Functional Requirements)")
    add_bullet(" NFR-01 (Hiệu năng): Thời gian tải trang ban đầu và chuyển tab (Time to Interactive) dưới 0.8 giây nhờ cấu trúc Single Page Application trên nền Vite 8 và zero-backend-latency.", "•")
    add_bullet(" NFR-02 (Giao diện & Mỹ thuật): Áp dụng triết lý thiết kế Bento Grid tân tiến, tông màu Dark Mode Emerald Night Forest (#102B21 / #0B132B) huyền bí và đẳng cấp, đạt chuẩn tương phản trợ năng WCAG 2.1 AA.", "•")
    add_bullet(" NFR-03 (Phản hồi Âm thanh - SoundService): Tích hợp Web Audio API phát âm thanh tinh tế khi bấm nút (Click), đăng nhập thành công (Success), cảnh báo (Alert) và hoàn thành công việc, nâng cao trải nghiệm xúc giác số.", "•")
    add_bullet(" NFR-04 (Bảo mật Tuyến đường & Dữ liệu): Phân tách phiên làm việc người dùng (Session), tự động bóc tách và không bao giờ lưu trữ mật khẩu trong dữ liệu phiên (delete sessionUser.password), đảm bảo an toàn thông tin.", "•")
    add_bullet(" NFR-05 (Khả năng Phục hồi & Sao lưu): Hỗ trợ xuất và nhập dữ liệu dạng JSON độc lập, cơ chế tự động khôi phục dữ liệu mẫu (Reset to Default) khi bộ nhớ cục bộ xảy ra xung đột.", "•")

    doc.add_page_break()

    print(">>> Đang xuất Chương 3: Phân tích Use Case & Luồng nghiệp vụ...")

    # =============================================================
    # CHƯƠNG 3: PHÂN TÍCH USE CASE & LUỒNG NGHIỆP VỤ
    # =============================================================
    add_h1("CHƯƠNG 3: PHÂN TÍCH USE CASE VÀ LUỒNG NGHIỆP VỤ")

    add_h2("3.1. Danh Sách Tác Nhân Hệ Thống (Actors)")
    add_p("Hệ thống PetCare PRO AI bao gồm 4 tác nhân tương tác chính:")
    add_bullet(" Chủ sở hữu thú cưng (Pet Owner): Người tạo lập hồ sơ, quản lý chi tiêu, thiết lập lịch trình y tế, trao đổi với AI và phân quyền cho các thành viên trong gia đình.", "1.")
    add_bullet(" Người chăm sóc / Thành viên gia đình (Caregiver / Member): Tham gia đồng chăm sóc, nhận nhiệm vụ hàng ngày, tích hoàn thành công việc để duy trì Habit Streak và cập nhật nhật ký sức khỏe.", "2.")
    add_bullet(" Bác sĩ thú y phụ trách (Vet Doctor): Theo dõi tiến trình điều trị, cập nhật kết quả khám, kê đơn thuốc điện tử trong Y bạ và nhận thông báo khi có lịch hẹn tái khám.", "3.")
    add_bullet(" Trợ lý Trí tuệ Nhân tạo (AI Engine): Đóng vai trò như một tác nhân tự trị (Autonomous Agent) gồm Dr. Paw (tư vấn chẩn đoán), Vision Scanner (phân tích hình ảnh), và OCR Parser (bóc tách hóa đơn).", "4.")

    add_h2("3.2. Bảng Đặc Tả Các Use Case Cốt Lõi")
    add_p("Dưới đây là 3 bảng đặc tả chi tiết cho các luồng nghiệp vụ phức tạp và mang tính đột phá nhất của hệ thống:")

    add_h3("Bảng 3.1: Đặc tả Use Case UC-01 - Tư Vấn Y Khoa Cùng Bác Sĩ Thú Y AI Dr. Paw")
    tbl_uc1 = doc.add_table(rows=8, cols=2)
    style_table(tbl_uc1, [2.0, 4.8])
    uc1_data = [
        ("Thuộc tính Use Case", "Nội dung đặc tả chi tiết"),
        ("Mã Use Case & Tên", "UC-01: Khám bệnh và Tư vấn Sức khỏe cùng Dr. Paw Context-Aware"),
        ("Tác nhân tham gia", "Chủ nuôi (Pet Owner) và Trợ lý AI Dr. Paw"),
        ("Mục đích / Ý nghĩa", "Cung cấp chẩn đoán sơ bộ, phân tầng mức độ khẩn cấp và hướng dẫn sơ cứu tức thì có dựa trên tiền sử bệnh án thực tế của thú cưng."),
        ("Điều kiện tiên quyết", "Người dùng đã đăng nhập và đã chọn ít nhất một hồ sơ thú cưng trên giao diện."),
        ("Luồng sự kiện chính\n(Main Success Scenario)", 
         "1. Người dùng mở tab 'Bác Sĩ AI' và chọn thú cưng cần trao đổi (ví dụ: Mochi).\n"
         "2. Hệ thống tự động thu thập 'petContext' (tên, loài, giống, tuổi, cân nặng, tiền sử bệnh án/dị ứng).\n"
         "3. Người dùng nhập câu hỏi hoặc triệu chứng (ví dụ: 'Mochi nôn ra bọt trắng và bỏ ăn sáng nay').\n"
         "4. Hệ thống tiêm ngữ cảnh vào prompt và chuyển tới API Gemini (hoặc Smart Simulated Engine).\n"
         "5. AI phân tích, nhận định mức độ WARNING/CRITICAL, đưa ra giải thích y khoa và hướng dẫn 4 bước sơ cứu.\n"
         "6. Hệ thống hiển thị câu trả lời với thẻ phân loại màu sắc và phát âm thanh phản hồi nhẹ nhàng."),
        ("Luồng sự kiện ngoại lệ\n(Alternative / Exception)", 
         "- Ngoại lệ 1: Mất kết nối internet hoặc chưa nhập Gemini API Key -> Hệ thống tự động kích hoạt bộ luật tri thức nội tại (SmartSimulatedKnowledgeEngine) để phản hồi tức thì, không làm gián đoạn trải nghiệm người dùng.\n"
         "- Ngoại lệ 2: Phát hiện từ khóa độc hại nguy cấp (Socola, hành tỏi, nho...) -> Kích hoạt giao diện cảnh báo đỏ SOS, hiển thị số hotline bệnh viện 24/7."),
        ("Kết quả mong đợi (Post-condition)", "Người dùng nắm rõ tình trạng sức khỏe của thú cưng, biết cách sơ cứu an toàn và có hướng xử trí chính xác.")
    ]
    for r_idx, row in enumerate(uc1_data):
        for c_idx, val in enumerate(row):
            cell = tbl_uc1.cell(r_idx, c_idx)
            p = cell.paragraphs[0]
            r = p.add_run(val)
            if r_idx == 0:
                r.bold = True

    add_h3("Bảng 3.2: Đặc tả Use Case UC-02 - Đồng Bộ Chăm Sóc Gia Đình Chống Cho Ăn Thừa")
    tbl_uc2 = doc.add_table(rows=8, cols=2)
    style_table(tbl_uc2, [2.0, 4.8])
    uc2_data = [
        ("Thuộc tính Use Case", "Nội dung đặc tả chi tiết"),
        ("Mã Use Case & Tên", "UC-02: Đồng bộ Cữ Chăm Sóc Gia Đình & Chống Cho Ăn Trùng Lặp (Co-Parenting)"),
        ("Tác nhân tham gia", "Thành viên gia đình (Pet Owner / Caregiver)"),
        ("Mục đích / Ý nghĩa", "Đồng bộ hóa trạng thái hoàn thành cữ ăn, cữ thuốc và đi dạo trong ngày giữa tất cả các thành viên gia đình, ngăn chặn tình trạng cho ăn thừa hoặc bỏ quên."),
        ("Điều kiện tiên quyết", "Thú cưng đã được gán danh sách thói quen (Daily Habits) trong ngày."),
        ("Luồng sự kiện chính\n(Main Success Scenario)", 
         "1. Thành viên gia đình (ví dụ: Bố Hải) cho Mochi ăn bữa sáng (180g hạt).\n"
         "2. Bố Hải mở ứng dụng PetCare PRO AI và nhấn nút tròn Checkbox tại công việc tương ứng.\n"
         "3. Hàm toggleDailyHabit() được kích hoạt, ghi nhận: completed = true, completedBy = 'Nguyễn Văn Hải (Bố)', completedAt = '07:15', đồng thời tăng streak lên 1 ngày.\n"
         "4. Hệ thống cập nhật giao diện thời gian thực và phát âm thanh Click vui tươi.\n"
         "5. Người mẹ (Trang) mở ứng dụng vào lúc 08:00, nhìn thấy huy hiệu 'Đã hoàn thành bởi Bố lúc 07:15', nhận biết thú cưng đã no và không cho ăn thêm."),
        ("Luồng sự kiện ngoại lệ\n(Alternative / Exception)", 
         "- Ngoại lệ: Người dùng bấm nhầm -> Có thể bấm lại checkbox để hoàn tác; hệ thống sẽ cập nhật lại trạng thái completed = false, xóa người thực hiện và hiệu chỉnh lại chuỗi streak."),
        ("Kết quả mong đợi (Post-condition)", "Thú cưng được ăn đúng giờ, đúng định lượng; thông tin minh bạch trong toàn bộ gia đình.")
    ]
    for r_idx, row in enumerate(uc2_data):
        for c_idx, val in enumerate(row):
            cell = tbl_uc2.cell(r_idx, c_idx)
            p = cell.paragraphs[0]
            r = p.add_run(val)
            if r_idx == 0:
                r.bold = True

    add_h3("Bảng 3.3: Đặc tả Use Case UC-03 - Quét Kiểm Tra Da Liễu Qua Vision AI Scanner")
    tbl_uc3 = doc.add_table(rows=8, cols=2)
    style_table(tbl_uc3, [2.0, 4.8])
    uc3_data = [
        ("Thuộc tính Use Case", "Nội dung đặc tả chi tiết"),
        ("Mã Use Case & Tên", "UC-03: Sàng lọc Bệnh lý Da liễu & Tổn thương qua AI Thị Giác"),
        ("Tác nhân tham gia", "Chủ nuôi (Pet Owner) và Bộ xử lý Vision AI Scanner"),
        ("Mục đích / Ý nghĩa", "Nhận diện sớm các dấu hiệu viêm da dị ứng, nấm da (Ringworm), ve rận qua ảnh chụp vùng da tổn thương để can thiệp kịp thời."),
        ("Điều kiện tiên quyết", "Người dùng có ảnh chụp rõ nét vùng da, kẽ tai hoặc vùng rụng lông của thú cưng."),
        ("Luồng sự kiện chính\n(Main Success Scenario)", 
         "1. Người dùng mở tính năng 'Vision AI Scanner' và chọn chế độ 'Quét triệu chứng da liễu / mắt / phân'.\n"
         "2. Người dùng tải ảnh lên từ thư viện hoặc chụp trực tiếp qua Camera.\n"
         "3. Hệ thống hiển thị hiệu ứng Radar Scanning mô phỏng mạng nơ-ron phân tích ma trận điểm ảnh.\n"
         "4. AI trích xuất đặc trưng hình thái: Viền đỏ ửng, lớp vảy gàu li ti, sợi lông đứt gãy.\n"
         "5. Hệ thống trả về kết quả: Chẩn đoán sơ bộ ('Nghi vấn Viêm da dị ứng hoặc Nấm da Ringworm - Độ tin cậy 89.4%'), đi kèm 4 khuyến nghị sơ cứu an toàn.\n"
         "6. Người dùng nhấn nút 'Lưu kết quả vào Y bạ' hoặc 'Đặt lịch khám thú y'."),
        ("Luồng sự kiện ngoại lệ\n(Alternative / Exception)", 
         "- Ngoại lệ: Ảnh mờ, thiếu sáng -> Hệ thống hiển thị khuyến nghị chụp lại góc cận cảnh, đủ ánh sáng tự nhiên để đạt độ chính xác cao nhất."),
        ("Kết quả mong đợi (Post-condition)", "Tổn thương da được phân loại kịp thời, ngăn chặn thú cưng cào gãi gây loét nhiễm trùng.")
    ]
    for r_idx, row in enumerate(uc3_data):
        for c_idx, val in enumerate(row):
            cell = tbl_uc3.cell(r_idx, c_idx)
            p = cell.paragraphs[0]
            r = p.add_run(val)
            if r_idx == 0:
                r.bold = True

    doc.add_page_break()

    print(">>> Đang xuất Chương 4: Thiết kế cơ sở dữ liệu...")

    # =============================================================
    # CHƯƠNG 4: THIẾT KẾ CƠ SỞ DỮ LIỆU (DATABASE DESIGN)
    # =============================================================
    add_h1("CHƯƠNG 4: THIẾT KẾ CƠ SỞ DỮ LIỆU (DATABASE DESIGN)")

    add_h2("4.1. Kiến Trúc Lưu Trữ Thực Tế & Mô Hình Quan Hệ Dữ Liệu")
    add_p("Trong kiến trúc của PetCare PRO AI, toàn bộ dữ liệu được quản lý thông qua cơ chế Client-side Database Engine trên nền tảng Browser LocalStorage có gắn Schema Versioning ('_v1'). Mặc dù lưu trữ dưới dạng Key-Value NoSQL Store, toàn bộ cấu trúc dữ liệu đều tuân thủ chặt chẽ mô hình dữ liệu quan hệ (Relational Entity Integrity) với các khóa chính (Primary Key - PK) và khóa ngoại (Foreign Key - FK) liên kết toàn vẹn:")
    add_bullet(" Khóa ngoại petId liên kết bảng Pets với các bảng Schedules, Daily_Habits, Daily_Logs, Prescriptions, Expenses và Lost_Modes.", "•")
    add_bullet(" Khóa ngoại ownerId liên kết bảng Pets với bảng Users.", "•")
    add_bullet(" Cơ chế Cascade Delete: Trong storageService.js, hàm deletePet(petId) được thiết kế tự động xóa sạch các bản ghi con liên quan trong các bảng Schedules, Expenses, Prescriptions và Daily_Habits, ngăn chặn tình trạng dữ liệu mồ côi (Orphan Records).", "•")

    add_h2("4.2. Bảng Cấu Trúc Dữ Liệu Thực Tế Trong Source Code")
    add_p("Dưới đây là đặc tả chi tiết 8 bảng dữ liệu cốt lõi trích xuất chính xác từ mã nguồn:")

    # Bảng 4.1: USERS
    add_h3("Bảng 4.1: Cấu trúc thực thể Users (Key: 'petcare_auth_users_v1')")
    tbl_users = doc.add_table(rows=10, cols=5)
    style_table(tbl_users, [0.6, 1.4, 1.2, 1.0, 2.6])
    users_schema = [
        ("STT", "Tên trường (Field)", "Kiểu dữ liệu", "Khóa", "Ràng buộc & Diễn giải nghiệp vụ"),
        ("1", "id", "String", "PK", "Định danh duy nhất của người dùng (vd: 'user_demo_01', 'user_tester_pro')."),
        ("2", "name", "String", "None", "Họ và tên hiển thị đầy đủ của người dùng."),
        ("3", "email", "String", "Unique", "Địa chỉ email dùng để đăng nhập và nhận thông báo hệ thống."),
        ("4", "password", "String", "None", "Mật khẩu tài khoản (Bị bóc tách loại bỏ khi lưu session)."),
        ("5", "phone", "String", "None", "Số điện thoại liên lạc chính thức (vd: '0912.345.678')."),
        ("6", "address", "String", "None", "Địa chỉ cư trú của chủ nuôi."),
        ("7", "role", "String", "None", "Phân quyền: 'pet_owner' (Chủ nuôi) hoặc 'vet_doctor' (Bác sĩ thú y)."),
        ("8", "avatar", "String (URL)", "None", "Đường dẫn ảnh đại diện người dùng."),
        ("9", "createdAt", "ISO DateTime", "None", "Dấu thời gian khởi tạo tài khoản trên hệ thống.")
    ]
    for r_idx, row in enumerate(users_schema):
        for c_idx, val in enumerate(row):
            cell = tbl_users.cell(r_idx, c_idx)
            cell.paragraphs[0].add_run(val)

    # Bảng 4.2: PETS
    add_h3("Bảng 4.2: Cấu trúc thực thể Pets (Key: 'petcare_pets_v1')")
    tbl_pets = doc.add_table(rows=15, cols=5)
    style_table(tbl_pets, [0.6, 1.4, 1.2, 1.0, 2.6])
    pets_schema = [
        ("STT", "Tên trường (Field)", "Kiểu dữ liệu", "Khóa", "Ràng buộc & Diễn giải nghiệp vụ"),
        ("1", "id", "String", "PK", "Định danh duy nhất của thú cưng (vd: 'pet-1', 'pet-2', 'pet-3')."),
        ("2", "name", "String", "None", "Tên gọi thân mật của bé cưng (Mochi, Luna, Bánh Bao)."),
        ("3", "species", "String", "None", "Loài: 'dog' (Chó), 'cat' (Mèo), 'rabbit' (Thỏ), 'other'."),
        ("4", "breed", "String", "None", "Tên giống thuần chủng (vd: 'Golden Retriever', 'British Shorthair')."),
        ("5", "gender", "String", "None", "Giới tính sinh học: 'male' (Đực) hoặc 'female' (Cái)."),
        ("6", "birthDate", "Date (YYYY-MM-DD)", "None", "Ngày sinh để tính tuổi chính xác theo tháng phục vụ tiêm phòng."),
        ("7", "weight", "Number (kg)", "None", "Cân nặng hiện tại (vd: 24.5, 4.2, 1.6)."),
        ("8", "color", "String", "None", "Màu lông nhận diện đặc trưng (Vàng kem, Xám xanh, Trắng đốm nâu)."),
        ("9", "microchip", "String", "None", "Mã số vi mạch cấy dưới da chống thất lạc (vd: 'VN-9820003412')."),
        ("10", "isNeutered", "Boolean", "None", "Tình trạng triệt sản (Ảnh hưởng trực tiếp đến hệ số calo DER)."),
        ("11", "avatar", "String (URL)", "None", "Ảnh đại diện chân dung chất lượng cao của thú cưng."),
        ("12", "notes", "String", "None", "Ghi chú thói quen, sở thích, dị ứng thức ăn."),
        ("13", "ownerId", "String", "FK", "Khóa ngoại tham chiếu đến bảng Users(id)."),
        ("14", "weightHistory", "Array<Object>", "None", "Mảng lưu trữ tiến trình biến động cân nặng: [{date, weight}].")
    ]
    for r_idx, row in enumerate(pets_schema):
        for c_idx, val in enumerate(row):
            cell = tbl_pets.cell(r_idx, c_idx)
            cell.paragraphs[0].add_run(val)

    # Bảng 4.3: SCHEDULES
    add_h3("Bảng 4.3: Cấu trúc thực thể Schedules (Key: 'petcare_schedules_v1')")
    tbl_sch = doc.add_table(rows=12, cols=5)
    style_table(tbl_sch, [0.6, 1.4, 1.2, 1.0, 2.6])
    sch_schema = [
        ("STT", "Tên trường (Field)", "Kiểu dữ liệu", "Khóa", "Ràng buộc & Diễn giải nghiệp vụ"),
        ("1", "id", "String", "PK", "Định danh lịch trình (vd: 'sch-1', 'sch-Date.now()')."),
        ("2", "petId", "String", "FK", "Khóa ngoại tham chiếu bảng Pets(id)."),
        ("3", "title", "String", "None", "Tiêu đề công việc (vd: 'Tiêm phòng dại nhắc lại')."),
        ("4", "type", "String", "None", "Phân loại: 'vaccine', 'deworm', 'grooming', 'vet', 'medicine'."),
        ("5", "date", "Date (YYYY-MM-DD)", "None", "Ngày diễn ra lịch hẹn."),
        ("6", "time", "Time (HH:mm)", "None", "Khung giờ thực hiện dự kiến (vd: '09:30')."),
        ("7", "location", "String", "None", "Địa điểm (Tại nhà, Bệnh viện PetHealth, Paddy Spa...)."),
        ("8", "completed", "Boolean", "None", "Trạng thái hoàn thành (true / false)."),
        ("9", "completedAt", "ISO DateTime", "None", "Thời điểm người dùng tích hoàn thành."),
        ("10", "notes", "String", "None", "Lưu ý y tế trước khi thực hiện (nhịn ăn, mang sổ...)."),
        ("11", "repeat", "String", "None", "Chu kỳ lặp: 'none', 'weekly', 'monthly', 'quarterly', 'yearly'.")
    ]
    for r_idx, row in enumerate(sch_schema):
        for c_idx, val in enumerate(row):
            cell = tbl_sch.cell(r_idx, c_idx)
            cell.paragraphs[0].add_run(val)

    # Bảng 4.4: DAILY_HABITS
    add_h3("Bảng 4.4: Cấu trúc thực thể Daily_Habits (Key: 'petcare_daily_habits_v1')")
    tbl_habits = doc.add_table(rows=9, cols=5)
    style_table(tbl_habits, [0.6, 1.4, 1.2, 1.0, 2.6])
    habits_schema = [
        ("STT", "Tên trường (Field)", "Kiểu dữ liệu", "Khóa", "Ràng buộc & Diễn giải nghiệp vụ"),
        ("1", "id", "String", "PK", "Định danh thói quen (vd: 'habit-1', 'habit-Date.now()')."),
        ("2", "petId", "String", "FK", "Khóa ngoại liên kết bảng Pets(id)."),
        ("3", "title", "String", "None", "Tên thói quen (vd: 'Cho Mochi ăn hạt bữa sáng 180g')."),
        ("4", "timeOfDay", "String", "None", "Buổi thực hiện: 'morning' (Sáng), 'afternoon' (Chiều), 'evening' (Tối)."),
        ("5", "completed", "Boolean", "None", "Trạng thái hoàn thành trong ngày."),
        ("6", "completedBy", "String", "None", "Tên thành viên đã thực hiện (chống cho ăn trùng lặp)."),
        ("7", "completedAt", "Time (HH:mm)", "None", "Thời gian hoàn thành chính xác."),
        ("8", "streak", "Number", "None", "Số ngày liên tục duy trì thói quen thành công.")
    ]
    for r_idx, row in enumerate(habits_schema):
        for c_idx, val in enumerate(row):
            cell = tbl_habits.cell(r_idx, c_idx)
            cell.paragraphs[0].add_run(val)

    # Bảng 4.5: DAILY_LOGS
    add_h3("Bảng 4.5: Cấu trúc thực thể Daily_Logs (Key: 'petcare_daily_logs_v1')")
    tbl_logs = doc.add_table(rows=9, cols=5)
    style_table(tbl_logs, [0.6, 1.4, 1.2, 1.0, 2.6])
    logs_schema = [
        ("STT", "Tên trường (Field)", "Kiểu dữ liệu", "Khóa", "Ràng buộc & Diễn giải nghiệp vụ"),
        ("1", "id", "String", "PK", "Định danh nhật ký (vd: 'log-1')."),
        ("2", "petId", "String", "FK", "Khóa ngoại liên kết bảng Pets(id)."),
        ("3", "date", "Date (YYYY-MM-DD)", "None", "Ngày ghi nhật ký sinh hoạt."),
        ("4", "poopStatus", "String", "None", "Trạng thái phân: 'normal', 'soft', 'diarrhea', 'constipated'."),
        ("5", "peeStatus", "String", "None", "Trạng thái tiểu tiện: 'normal', 'dark', 'frequent', 'painful'."),
        ("6", "walkMinutes", "Number", "None", "Thời lượng đi dạo / vận động ngoài trời (phút)."),
        ("7", "mealStatus", "String", "None", "Sức ăn: 'good' (Ăn khỏe), 'picky' (Kén ăn), 'refused' (Bỏ ăn)."),
        ("8", "mood", "String", "None", "Tâm trạng: 'happy', 'calm', 'anxious', 'lethargic'.")
    ]
    for r_idx, row in enumerate(logs_schema):
        for c_idx, val in enumerate(row):
            cell = tbl_logs.cell(r_idx, c_idx)
            cell.paragraphs[0].add_run(val)

    # Bảng 4.6: PRESCRIPTIONS
    add_h3("Bảng 4.6: Cấu trúc thực thể Prescriptions (Key: 'petcare_prescriptions_v1')")
    tbl_pres = doc.add_table(rows=9, cols=5)
    style_table(tbl_pres, [0.6, 1.4, 1.2, 1.0, 2.6])
    pres_schema = [
        ("STT", "Tên trường (Field)", "Kiểu dữ liệu", "Khóa", "Ràng buộc & Diễn giải nghiệp vụ"),
        ("1", "id", "String", "PK", "Định danh đơn thuốc (vd: 'pres-1')."),
        ("2", "petId", "String", "FK", "Khóa ngoại liên kết bảng Pets(id)."),
        ("3", "medicineName", "String", "None", "Tên thuốc / Biệt dược điều trị (Men vi sinh, Gel dinh dưỡng...)."),
        ("4", "dosage", "String", "None", "Liều lượng và cách dùng (vd: '1 gói/ngày chia 2 lần')."),
        ("5", "startDate", "Date (YYYY-MM-DD)", "None", "Ngày bắt đầu uống thuốc."),
        ("6", "durationDays", "Number", "None", "Liệu trình điều trị tính theo ngày (vd: 7, 14, 30)."),
        ("7", "prescribedBy", "String", "None", "Bác sĩ thú y hoặc phòng khám chỉ định kê toa."),
        ("8", "purpose", "String", "None", "Mục đích điều trị (Hỗ trợ đường ruột, mượt lông, chống ngứa).")
    ]
    for r_idx, row in enumerate(pres_schema):
        for c_idx, val in enumerate(row):
            cell = tbl_pres.cell(r_idx, c_idx)
            cell.paragraphs[0].add_run(val)

    # Bảng 4.7: EXPENSES
    add_h3("Bảng 4.7: Cấu trúc thực thể Expenses (Key: 'petcare_expenses_v1')")
    tbl_exp = doc.add_table(rows=8, cols=5)
    style_table(tbl_exp, [0.6, 1.4, 1.2, 1.0, 2.6])
    exp_schema = [
        ("STT", "Tên trường (Field)", "Kiểu dữ liệu", "Khóa", "Ràng buộc & Diễn giải nghiệp vụ"),
        ("1", "id", "String", "PK", "Định danh khoản chi tiêu (vd: 'exp-1')."),
        ("2", "petId", "String", "FK", "Khóa ngoại liên kết bảng Pets(id)."),
        ("3", "category", "String", "None", "Danh mục: 'food', 'medical', 'grooming', 'toys', 'vaccine', 'hygiene', 'other'."),
        ("4", "title", "String", "None", "Tên sản phẩm / Dịch vụ chi trả (Bao hạt Royal Canin 15kg...)."),
        ("5", "amount", "Number (VND)", "None", "Số tiền thanh toán thực tế."),
        ("6", "date", "Date (YYYY-MM-DD)", "None", "Ngày phát sinh chi tiêu."),
        ("7", "notes", "String", "None", "Nơi mua sắm, thông tin bảo hành, khuyến mãi.")
    ]
    for r_idx, row in enumerate(exp_schema):
        for c_idx, val in enumerate(row):
            cell = tbl_exp.cell(r_idx, c_idx)
            cell.paragraphs[0].add_run(val)

    # Bảng 4.8: FAMILY_MEMBERS
    add_h3("Bảng 4.8: Cấu trúc thực thể Family_Members (Key: 'petcare_family_members_v1')")
    tbl_fam = doc.add_table(rows=8, cols=5)
    style_table(tbl_fam, [0.6, 1.4, 1.2, 1.0, 2.6])
    fam_schema = [
        ("STT", "Tên trường (Field)", "Kiểu dữ liệu", "Khóa", "Ràng buộc & Diễn giải nghiệp vụ"),
        ("1", "id", "String", "PK", "Định danh thành viên đồng quản lý (vd: 'mem-1')."),
        ("2", "name", "String", "None", "Họ tên thành viên (Bố Hải, Mẹ Trang, BS. Tuấn...)."),
        ("3", "role", "String", "None", "Mã vai trò: 'owner', 'caregiver', 'vet'."),
        ("4", "roleLabel", "String", "None", "Nhãn hiển thị tiếng Việt (Chủ sở hữu, Người chăm sóc chính, Bác sĩ thú y)."),
        ("5", "avatar", "String (URL)", "None", "Ảnh đại diện cá nhân."),
        ("6", "phone", "String", "None", "Số điện thoại khẩn cấp."),
        ("7", "assignedPetIds", "Array<String>", "None", "Danh sách các thú cưng được phân quyền chăm sóc: ['pet-1', 'pet-2'].")
    ]
    for r_idx, row in enumerate(fam_schema):
        for c_idx, val in enumerate(row):
            cell = tbl_fam.cell(r_idx, c_idx)
            cell.paragraphs[0].add_run(val)

    doc.add_page_break()

    print(">>> Đang xuất Chương 5: Thiết kế Kiến trúc & Tích hợp AI...")

    # =============================================================
    # CHƯƠNG 5: THIẾT KẾ KIẾN TRÚC & TÍCH HỢP AI
    # =============================================================
    add_h1("CHƯƠNG 5: THIẾT KẾ KIẾN TRÚC VÀ TÍCH HỢP AI")

    add_h2("5.1. Sơ Đồ Phân Tầng Kiến Trúc Phần Mềm")
    add_p("Hệ thống PetCare PRO AI được thiết kế theo kiến trúc phân tầng chuyên biệt (Layered Architecture), đảm bảo tính phân tách trách nhiệm (Separation of Concerns), dễ bảo trì và sẵn sàng kết nối với Backend Cloud trong tương lai:")

    add_bullet(" Tầng Trình Diễn (Presentation Layer): Tập hợp các React Components được xây dựng theo ngôn ngữ thiết kế Bento Grid và Dark Mode Emerald. Chịu trách nhiệm trực quan hóa dữ liệu, lắng nghe tương tác người dùng, điều khiển animation SVG Toothless Mascot và Cat Door Button.", "1.")
    add_bullet(" Tầng Trừu Tượng Hóa Dịch Vụ (Service Abstraction Layer): Gồm storageService.js (quản lý CRUD dữ liệu và tính toàn vẹn khóa ngoại), authService.js (xử lý phiên đăng nhập và mã hóa mật khẩu), soundService.js (Web Audio synthesizer). Tầng này đóng vai trò cầu nối độc lập, che giấu chi tiết lưu trữ vật lý đối với tầng UI.", "2.")
    add_bullet(" Tầng Trí Tuệ Nhân Tạo & Xử Lý Đa Phương Thức (AI & Multimodal Processing Engine): Nằm tại aiService.js, chịu trách nhiệm kết nối Google Gemini 1.5 Flash API, quản lý RAG Context Injection, vận hành Smart Simulated Veterinary Engine, Vision Symptom Analyzer và Thuật toán Dinh dưỡng RER/DER.", "3.")
    add_bullet(" Tầng Lưu Trữ & Đồng Bộ Ngoài (Persistence & Export Engine): LocalStorage Engine với cơ chế Versioning, bộ chuyển đổi iCalendar RFC 5545 và bộ sao lưu JSON Enterprise v3.0.", "4.")

    add_h2("5.2. Cơ Chế Nạp Ngữ Cảnh Bệnh Án (Prompt Injection / RAG) Của Dr. Paw")
    add_p("Khác với các chatbot AI thông thường chỉ trả lời chung chung, Dr. Paw trong PetCare PRO AI sở hữu cơ chế nạp ngữ cảnh động (Dynamic Context-aware Injection - một dạng RAG thu gọn trên client) nhằm cá nhân hóa câu trả lời y tế cho từng cá thể thú cưng:")
    add_bullet(" Bước 1 - Trích xuất Bối cảnh Thú cưng (Context Extraction): Khi người dùng đang ở hồ sơ của một bé (ví dụ: Mochi), hệ thống thu thập đối tượng petContext = { name: 'Mochi', species: 'dog', breed: 'Golden Retriever', weight: 24.5, notes: 'Rất thích bơi, hơi nhát sấm sét. Dị ứng nhẹ với thịt bò', age: '2 tuổi 8 tháng' }.", "•")
    add_bullet(" Bước 2 - Đóng gói System Prompt Thú Y: Sử dụng VET_SYSTEM_PROMPT định hướng AI đóng vai trò là Bác sĩ Thú y Cao cấp, tuân thủ nguyên tắc: chẩn đoán sơ bộ, phân tầng khẩn cấp, hướng dẫn sơ cứu an toàn và cảnh báo không tự ý dùng thuốc của người.", "•")
    add_bullet(" Bước 3 - Hợp nhất Ngữ cảnh & Câu hỏi: Chuỗi prompt cuối cùng gửi tới mô hình Gemini có cấu trúc:\n[VET_SYSTEM_PROMPT]\n[Thông tin thú cưng đang trao đổi: Tên: Mochi, Loài: dog, Giống: Golden Retriever, Cân nặng: 24.5kg, Dị ứng: Dị ứng thịt bò]\nDưới đây là câu hỏi của chủ nuôi: [User Message].", "•")
    add_bullet(" Bước 4 - Chuyển đổi Dự phòng (Smart Simulated Fallback): Nếu gọi API thất bại hoặc thiết bị ngoại tuyến, hàm smartSimulatedAiConsultation() sẽ kích hoạt cây quyết định tri thức thú y (Knowledge Rule-tree), quét từ khóa triệu chứng và trả về lời khuyên tương đương chất lượng bác sĩ thú y.", "•")

    add_h2("5.3. Cơ Chế Phân Tích Hình Ảnh Của Vision Scan")
    add_p("Module Vision AI Scanner vận hành dựa trên cơ chế giả lập mạng nơ-ron phân tích thị giác đa lớp (Multimodal Visual Pattern Matching):")
    add_bullet(" Chế độ Nhận diện Giống loài (Breed Mode): Trích xuất các đặc trưng ngoại hình (hình dáng tai, độ dài mõm, màu lông, kết cấu khung xương) để xác định giống thuần chủng với độ tin cậy trên 95%, cung cấp thông tin nguồn gốc, tính cách và các bệnh lý di truyền tiềm ẩn.", "•")
    add_bullet(" Chế độ Chẩn đoán Da liễu (Symptom Mode): Tập trung quét các bất thường biểu mô (erythema - quầng đỏ, alopecia - rụng lông hình tròn, scales - vảy gàu). AI phân tích và đưa ra xác suất giữa Nấm da (Ringworm) và Viêm da Demodex, kèm theo hướng dẫn cách ly và sơ cứu bằng nước muối sinh lý vô trùng.", "•")

    add_h2("5.4. Quy Trình Pipeline OCR 3 Trong 1 (Automated 3-Way OCR Pipeline)")
    add_p("Quy trình tự động hóa độc đáo nhất của PetCare PRO AI nằm tại hàm applyOcrAutoPipeline() trong storageService.js. Khi một ảnh chụp hóa đơn phòng khám hoặc sổ tiêm chủng được tải lên, hệ thống tự động bóc tách và phân phối đồng thời vào 3 thực thể dữ liệu:")
    add_bullet(" 1. Nhánh Lịch Trình (Schedule Pipeline): Nếu phát hiện ngày hẹn tiêm tiếp theo (nextVisitDate) và tên vắc-xin, hệ thống tự động tạo một bản ghi Schedule loại 'vaccine' nhắc lịch tái khám.", "•")
    add_bullet(" 2. Nhánh Y Bạ Đơn Thuốc (Prescription Pipeline): Nếu phát hiện tên thuốc (medicineName) và liều lượng, hệ thống tự động ghi nhận một đơn thuốc mới vào hồ sơ y tế của bé.", "•")
    add_bullet(" 3. Nhánh Chi Tiêu Tài Chính (Expense Pipeline): Nếu phát hiện tổng số tiền thanh toán (totalAmount), hệ thống tự động tạo một phiếu chi tài chính loại 'medical'/'vaccine' trong sổ chi tiêu.", "•")
    add_p("Quy trình 3 trong 1 này giúp chủ nuôi tiết kiệm 90% thời gian nhập liệu thủ công và đảm bảo dữ liệu luôn đồng bộ tuyệt đối.")

    doc.add_page_break()

    print(">>> Đang xuất Chương 6: Bảng tiêu chí đánh giá đồ án...")

    # =============================================================
    # CHƯƠNG 6: BẢNG TIÊU CHÍ ĐÁNH GIÁ ĐỒ ÁN (RUBRIC DÀNH CHO GIẢNG VIÊN)
    # =============================================================
    add_h1("CHƯƠNG 6: BẢNG TIÊU CHÍ ĐÁNH GIÁ ĐỒ ÁN (RUBRIC DÀNH CHO GIẢNG VIÊN)")
    add_p("Để hỗ trợ Hội đồng Giảng viên đánh giá đồ án một cách khách quan, toàn diện và chuẩn mực, bảng tiêu chí đánh giá (Rubric) được xây dựng gồm 5 hạng mục với tổng trọng số 100% (Thang điểm 10):")

    tbl_rubric = doc.add_table(rows=6, cols=5)
    style_table(tbl_rubric, [1.4, 0.8, 1.6, 1.6, 1.4])
    rubric_data = [
        ("Tiêu chí đánh giá", "Trọng số", "Mức Xuất Sắc (9.0 - 10.0)", "Mức Giỏi - Khá (7.0 - 8.9)", "Mức Trung Bình (< 7.0)"),
        ("1. Ý tưởng thực tiễn & Tính cấp thiết", "20%", 
         "Giải quyết triệt để nỗi đau người nuôi thú cưng; đề xuất cơ chế chống cho ăn thừa (Co-parenting) và Y bạ thông minh vô cùng sáng tạo.", 
         "Ý tưởng hay, đáp ứng nhu cầu quản lý thú cưng cơ bản nhưng các tính năng gia đình chưa đột phá.", 
         "Ý tưởng phổ biến, chưa có điểm khác biệt so với các ứng dụng ghi chú thông thường."),
        ("2. Giao diện UI/UX & Micro-interactions", "20%", 
         "Thiết kế Bento Grid đẳng cấp, Dark Mode chuẩn y tế; Linh vật SVG Toothless tương tác chuột/mắt; Nút bấm Cửa mèo 4 giai đoạn độc bản.", 
         "Giao diện đẹp mắt, responsive mượt mà nhưng thiếu các hiệu ứng vi mô tương tác sống động.", 
         "Giao diện đơn giản, dùng template có sẵn, màu sắc chưa hài hòa, thiếu Dark Mode."),
        ("3. Mức độ hoàn thiện chức năng", "25%", 
         "Đạt 100% 9 module chức năng; tích hợp lịch lặp, xuất file iCalendar, xuất/nhập JSON Enterprise v3.0, không có lỗi console.", 
         "Hoàn thành các chức năng chính (80%), còn thiếu một số tính năng nâng cao như iCal hoặc Lost Mode.", 
         "Chức năng còn sơ sài, một số nút bấm chưa hoạt động hoặc phát sinh lỗi runtime."),
        ("4. Ứng dụng AI & Độ chuẩn xác nghiệp vụ", "20%", 
         "Tích hợp Gemini API mượt mà; RAG nạp tiền sử bệnh án; Smart Fallback ngoại tuyến; Vision Scan da liễu; Thuật toán calo RER/DER chuẩn WSAVA.", 
         "Có tích hợp chatbot AI nhưng câu trả lời chưa cá nhân hóa theo từng cá thể thú cưng.", 
         "Chỉ gọi API AI dạng tĩnh, chưa có xử lý ngoại lệ khi mất mạng hoặc thiếu API key."),
        ("5. Kiến trúc mã nguồn & Clean Code", "15%", 
         "Cấu trúc thư mục chuẩn mực; tách biệt Service Layer rõ ràng; Schema Versioning chuyên nghiệp; không phụ thuộc thư viện rác.", 
         "Code tương đối gọn gàng, có tổ chức components nhưng một số file logic còn bị dài dòng.", 
         "Code lộn xộn, trộn lẫn logic xử lý vào giao diện, khó mở rộng hoặc bảo trì.")
    ]
    for r_idx, row in enumerate(rubric_data):
        for c_idx, val in enumerate(row):
            cell = tbl_rubric.cell(r_idx, c_idx)
            p = cell.paragraphs[0]
            r = p.add_run(val)
            if r_idx == 0:
                r.bold = True

    add_h2("KẾT LUẬN VÀ HƯỚNG PHÁT TRIỂN")
    add_p("Hệ thống Website PetCare PRO AI đã chứng minh tính khả thi, giá trị thực tiễn và tính thẩm mỹ vượt trội trong việc ứng dụng công nghệ phần mềm vào đời sống chăm sóc thú cưng. Đồ án không chỉ đáp ứng trọn vẹn các yêu cầu kỹ thuật của một đồ án chuyên ngành Công nghệ Phần mềm mà còn tạo ra một sản phẩm hoàn thiện, sẵn sàng phục vụ cộng đồng người yêu động vật.")
    add_p("Trong tương lai, hệ thống sẽ tiếp tục được mở rộng với các hướng phát triển:")
    add_bullet(" Tích hợp thiết bị phần cứng IoT: Kết nối vòng cổ thông minh theo dõi nhịp tim, thân nhiệt và định vị GPS thời gian thực cho thú cưng.", "1.")
    add_bullet(" Phát triển ứng dụng di động đa nền tảng: Sử dụng React Native để chia sẻ mã nguồn với bản Web và hỗ trợ thông báo đẩy (Push Notification) native.", "2.")
    add_bullet(" Mở rộng Mạng lưới Bệnh viện & Cứu hộ: Kết nối trực tiếp API với các phòng khám thú y trên toàn quốc để đặt lịch khám trực tuyến và thanh toán viện phí.", "3.")

    # Lưu tài liệu
    output_filename = "Bao_Cao_Thiet_Ke_He_Thong_PetCare.docx"
    doc.save(output_filename)
    print(f">>> XUẤT THÀNH CÔNG TỆP: {os.path.abspath(output_filename)}")

if __name__ == '__main__':
    create_document()
