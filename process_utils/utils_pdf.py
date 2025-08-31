import PyPDF2
from pdf2image import convert_from_path
import pytesseract
from PIL import Image

def extract_pdf_text_with_ocr(pdf_path):
    text = ""
    try:
        with open(pdf_path, "rb") as f:
            reader = PyPDF2.PdfReader(f)
            for page in reader.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text
    except Exception:
        pass

    return text
