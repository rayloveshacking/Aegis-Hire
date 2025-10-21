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


class InterviewPrepRequest(BaseModel):
    job_title: str
    job_description: str
    candidate_name: str
    candidate_resume: str
    interviewer_name: str


class InterviewGuide(BaseModel):
    id: str
    job_title: str
    candidate_name: str
    key_objectives: List[str]
    structured_questions: List[str]
    legal_guardrails: List[str]
    created_at: datetime


class InterviewPrepService:
    """
    Service for preparing interview guides and materials.
    """

    def __init__(self):
        self.prep_guides: Dict[str, InterviewGuide] = {}

    def generate_interview_guide(
        self, prep_request: InterviewPrepRequest
    ) -> Optional[InterviewGuide]:
        """
        Generate an interview guide based on job description, candidate info, and other factors.
        """
        if not api_key:
            return None

        try:
            model = genai.GenerativeModel("gemini-2.5-flash")

            # Create a prompt to generate the interview guide
            prep_prompt = f"""
            Generate a comprehensive interview preparation guide for the role of {prep_request.job_title}.
            The guide is for the interviewer: {prep_request.interviewer_name}.
            The candidate is: {prep_request.candidate_name}.

            Here is the job description:
            --- JOB DESCRIPTION START ---
            {prep_request.job_description}
            --- JOB DESCRIPTION END ---

            Here is the candidate's resume:
            --- RESUME START ---
            {prep_request.candidate_resume}
            --- RESUME END ---

            Please generate the guide with the following sections. Use the exact headers and formatting.
            Do not include any other text before or after the sections.

            ### KEY OBJECTIVES ###
            - [Objective 1]
            - [Objective 2]
            - [Objective 3]
            - [Objective 4]

            ### STRUCTURED QUESTIONS ###
            - [Question 1]
            - [Question 2]
            - [Question 3]

            ### LEGAL GUARDRAILS ###
            - [Guardrail 1]
            - [Guardrail 2]
            - [Guardrail 3]
            """

            response = model.generate_content(
                prep_prompt,
                generation_config=genai.GenerationConfig(
                    temperature=0.5,  # Balanced temperature for useful preparation
                ),
            )

            if not response or not hasattr(response, "text") or not response.text:
                return None

            guide_text = response.text

            # Helper function for parsing
            def parse_section(text, header):
                try:
                    section_content = (
                        text.split(f"### {header} ###")[1].split("###")[0].strip()
                    )
                    items = [
                        item.strip().lstrip("- ").rstrip()
                        for item in section_content.split("\n")
                        if item.strip()
                    ]
                    return items
                except IndexError:
                    return []

            key_objectives = parse_section(guide_text, "KEY OBJECTIVES")
            structured_questions = parse_section(guide_text, "STRUCTURED QUESTIONS")
            legal_guardrails = parse_section(guide_text, "LEGAL GUARDRAILS")

            if not all([key_objectives, structured_questions, legal_guardrails]):
                print("Failed to parse one or more sections from the generated guide.")
                return None

            guide = InterviewGuide(
                id=str(uuid.uuid4()),
                job_title=prep_request.job_title,
                candidate_name=prep_request.candidate_name,
                key_objectives=key_objectives,
                structured_questions=structured_questions,
                legal_guardrails=legal_guardrails,
                created_at=datetime.now(),
            )

            # Store the guide
            self.prep_guides[guide.id] = guide
            return guide

        except Exception as e:
            print(f"Error generating interview guide: {e}")
            return None

    def get_interview_guide(self, guide_id: str) -> Optional[InterviewGuide]:
        """
        Retrieve an interview guide by ID.
        """
        return self.prep_guides.get(guide_id)


# Initialize the interview prep service
interview_prep_service = InterviewPrepService()
