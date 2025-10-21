from pydantic import BaseModel
from typing import List, Dict, Optional
import uuid
from datetime import datetime
import google.generativeai as genai
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure the Gemini API key
api_key = os.getenv("GEMINI_API_KEY")
if api_key:
    genai.configure(api_key=api_key)


class JobDescriptionRequest(BaseModel):
    prompt: str


class JobDescription(BaseModel):
    id: str
    title: str
    company: str
    department: str
    location: str
    employment_type: str
    salary_range: str
    overview: str
    responsibilities: List[str]
    requirements: List[str]
    preferred_qualifications: List[str]
    benefits: List[str]
    created_at: datetime


class JobDescriptionResponse(BaseModel):
    success: bool
    job_description: Optional[JobDescription] = None
    error: Optional[str] = None


class JobDescriptionService:
    """
    Service for generating AI-powered job descriptions.
    """

    def __init__(self):
        self.job_descriptions: Dict[str, JobDescription] = {}

    def generate_job_description(
        self, request: JobDescriptionRequest
    ) -> Optional[JobDescription]:
        """
        Generate a job description based on a prompt using AI.
        """
        if not api_key:
            print("DEBUG: No GEMINI_API_KEY found - cannot generate job description")
            return None

        try:
            model = genai.GenerativeModel("gemini-2.5-flash")

            system_prompt = """
            You are an expert HR professional specializing in creating inclusive, professional job descriptions.
            Generate a comprehensive job description based on the provided prompt.

            Requirements:
            - Use inclusive language that welcomes diverse candidates
            - Include clear responsibilities and requirements
            - Specify employment type, location, and other key details
            - Include competitive benefits and company culture elements
            - Avoid discriminatory language or unnecessary barriers
            - Make requirements realistic and achievable

            Format your response as JSON with the following structure:
            {
                "title": "Job Title",
                "company": "Company Name",
                "department": "Department",
                "location": "Location",
                "employment_type": "Full-time/Part-time/Contract",
                "salary_range": "Salary range or 'Competitive'",
                "overview": "Brief company/role overview paragraph",
                "responsibilities": ["Responsibility 1", "Responsibility 2", ...],
                "requirements": ["Requirement 1", "Requirement 2", ...],
                "preferred_qualifications": ["Preferred 1", "Preferred 2", ...],
                "benefits": ["Benefit 1", "Benefit 2", ...]
            }
            """

            user_prompt = f"""
            Create a job description based on this prompt:
            {request.prompt}

            Please provide a complete, professional job description following the JSON format specified in the system instructions.
            """

            response = model.generate_content([system_prompt, user_prompt])

            if not response or not response.text:
                print("DEBUG: Empty response from Gemini API")
                return None

            # Try to parse the JSON response
            import json

            try:
                # Extract JSON from response (in case there's extra text)
                response_text = response.text.strip()
                if response_text.startswith("```json"):
                    response_text = response_text[7:]
                if response_text.endswith("```"):
                    response_text = response_text[:-3]

                job_data = json.loads(response_text.strip())

                # Create JobDescription object
                job_description = JobDescription(
                    id=str(uuid.uuid4()),
                    title=job_data.get("title", ""),
                    company=job_data.get("company", ""),
                    department=job_data.get("department", ""),
                    location=job_data.get("location", ""),
                    employment_type=job_data.get("employment_type", ""),
                    salary_range=job_data.get("salary_range", ""),
                    overview=job_data.get("overview", ""),
                    responsibilities=job_data.get("responsibilities", []),
                    requirements=job_data.get("requirements", []),
                    preferred_qualifications=job_data.get(
                        "preferred_qualifications", []
                    ),
                    benefits=job_data.get("benefits", []),
                    created_at=datetime.now(),
                )

                # Store the job description
                self.job_descriptions[job_description.id] = job_description

                return job_description

            except json.JSONDecodeError as e:
                print(f"DEBUG: Failed to parse JSON response: {e}")
                print(f"DEBUG: Raw response: {response.text}")
                return None

        except Exception as e:
            print(f"DEBUG: Error generating job description: {e}")
            return None

    def get_job_description(self, job_id: str) -> Optional[JobDescription]:
        """
        Retrieve a job description by ID.
        """
        return self.job_descriptions.get(job_id)

    def get_all_job_descriptions(self) -> List[JobDescription]:
        """
        Get all stored job descriptions.
        """
        return list(self.job_descriptions.values())


# Global service instance
job_description_service = JobDescriptionService()
