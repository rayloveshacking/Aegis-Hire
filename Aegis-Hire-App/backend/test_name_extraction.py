from pdf_parser import PDFParser
import sys
import os

# Test the PDF parser with the sample resume
pdf_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'sample_resume.pdf')
with open(pdf_path, 'rb') as f:
    result = PDFParser.parse_resume(f)
    if 'error' in result:
        print(f'Error: {result["error"]}')
    else:
        print(f'Raw text (first 200 chars): {result["raw_text"][:200]}...')
        print(f'Extracted name: {result.get("candidate_name", "Not found")}')