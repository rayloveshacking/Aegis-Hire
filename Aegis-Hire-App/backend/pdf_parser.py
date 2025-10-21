import PyPDF2
from typing import Optional, Dict, Any
import io
import re

class PDFParser:
    @staticmethod
    def extract_text_from_pdf(pdf_file) -> Optional[str]:
        """
        Extract text content from a PDF file.
        
        Args:
            pdf_file: File object or bytes containing PDF data
            
        Returns:
            str: Extracted text content or None if extraction fails
        """
        try:
            # Handle both file objects and bytes
            if hasattr(pdf_file, 'read'):
                pdf_reader = PyPDF2.PdfReader(pdf_file)
            else:
                pdf_reader = PyPDF2.PdfReader(io.BytesIO(pdf_file))
            
            text_content = ""
            for page_num in range(len(pdf_reader.pages)):
                page = pdf_reader.pages[page_num]
                text_content += page.extract_text() + "\n"
            
            return text_content.strip()
            
        except Exception as e:
            print(f"Error extracting text from PDF: {str(e)}")
            return None

    @staticmethod
    def extract_name_from_resume(text: str) -> Optional[str]:
        """
        Extract candidate name from resume text using various patterns.
        
        Args:
            text: Extracted text from resume
            
        Returns:
            str: Extracted name or None if not found
        """
        lines = text.split('\n')
        
        # Common name patterns - look at the first few lines where names typically appear
        name_patterns = [
            # First Middle Last (3+ words)
            r'^([A-Z][a-z]+ [A-Z][a-z]+ [A-Z][a-z]+(?: [A-Z][a-z]+)?)',
            # First Last (capitalized words)
            r'^([A-Z][a-z]+ [A-Z][a-z]+(?:-[A-Z][a-z]+)?)',
            # First Middle Last
            r'^([A-Z][a-z]+ [A-Z]\.?[A-Z]? [A-Z][a-z]+)',
            # First M. Last
            r'^([A-Z][a-z]+ [A-Z]\. [A-Z][a-z]+)',
            # Last, First
            r'^([A-Z][a-z]+, [A-Z][a-z]+)',
            # First Last with possible titles
            r'^(?:Mr|Mrs|Ms|Dr|Prof)\.?\s*([A-Z][a-z]+ [A-Z][a-z]+(?:-[A-Z][a-z]+)?)',
            # Email pattern to extract name before @
            r'([a-zA-Z]+(?:\.[a-zA-Z]+)?)@[a-zA-Z]+\.[a-zA-Z]{2,}'
        ]
        
        # Check first 10 lines for name patterns
        for i, line in enumerate(lines[:10]):
            line = line.strip()
            if not line or len(line) < 3:
                continue
                
            # Skip lines that are likely not names
            skip_patterns = [
                r'^\d{4}',  # Years
                r'^[A-Z]{2,}$',  # Acronyms
                r'^[A-Z][a-z]+ \d{4}',  # Month Year
                r'^[A-Z][a-z]+, [A-Z]{2}',  # City, State
                r'^(?:Phone|Email|Address|LinkedIn|GitHub)',  # Contact headers
                r'^http',  # URLs
                r'^\+\d',  # Phone numbers
                r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'  # Full email
            ]
            
            if any(re.match(pattern, line, re.IGNORECASE) for pattern in skip_patterns):
                continue
                
            # Try to extract name using patterns
            for pattern in name_patterns:
                match = re.search(pattern, line)
                if match:
                    potential_name = match.group(1)
                    # Clean up the name
                    potential_name = re.sub(r'[^a-zA-Z\s\.-]', '', potential_name).strip()
                    
                    # Import the validation function from main
                    import sys
                    import os
                    sys.path.append(os.path.dirname(__file__))
                    from main import validate_and_clean_name
                    
                    # Use the comprehensive validation function
                    validated_name = validate_and_clean_name(potential_name)
                    if validated_name:
                        return validated_name
        
        # If no name found in first lines, try to extract from email
        for line in lines:
            email_match = re.search(r'([a-zA-Z]+(?:\.[a-zA-Z]+)?)@[a-zA-Z]+\.[a-zA-Z]{2,}', line)
            if email_match:
                email_name = email_match.group(1)
                # Convert email name to proper case
                name_parts = email_name.split('.')
                if len(name_parts) >= 2:
                    proper_name = ' '.join(part.capitalize() for part in name_parts)
                    return proper_name
        
        return None

    @staticmethod
    def parse_resume(pdf_file) -> dict:
        """
        Parse resume PDF and return structured data.
        This is a basic implementation - can be enhanced with NLP for better parsing.
        
        Args:
            pdf_file: File object or bytes containing PDF data
            
        Returns:
            dict: Structured resume data
        """
        text = PDFParser.extract_text_from_pdf(pdf_file)
        if not text:
            return {"error": "Failed to extract text from PDF"}
        
        # Extract name from resume
        candidate_name = PDFParser.extract_name_from_resume(text)
        
        # Basic parsing - can be enhanced based on resume format
        resume_data = {
            "raw_text": text,
            "candidate_name": candidate_name,
            "sections": {},
            "contact_info": {},
            "skills": [],
            "experience": [],
            "education": []
        }
        
        # Simple section extraction (can be improved)
        lines = text.split('\n')
        current_section = "general"
        
        for line in lines:
            line_lower = line.lower().strip()
            if any(keyword in line_lower for keyword in ["experience", "work history", "employment"]):
                current_section = "experience"
            elif any(keyword in line_lower for keyword in ["education", "academic"]):
                current_section = "education"
            elif any(keyword in line_lower for keyword in ["skills", "technical skills", "competencies"]):
                current_section = "skills"
            elif any(keyword in line_lower for keyword in ["contact", "phone", "email", "address"]):
                current_section = "contact_info"
            
            if current_section not in resume_data["sections"]:
                resume_data["sections"][current_section] = []
            resume_data["sections"][current_section].append(line)
        
        return resume_data
