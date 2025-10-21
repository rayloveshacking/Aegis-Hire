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


class PostInterviewAnalysisRequest(BaseModel):
    interview_session_id: str
    job_title: str
    job_description: str
    candidate_name: str
    interview_transcript: str
    interviewer_notes: Optional[str] = ""


class CompetencyAssessment(BaseModel):
    competency: str
    rating: int  # 1-5 scale
    evidence: str
    recommendation: str


class PostInterviewAnalysis(BaseModel):
    id: str
    interview_session_id: str
    candidate_name: str
    overall_rating: int  # 1-5 scale
    competencies_assessed: List[CompetencyAssessment]
    strengths: List[str]
    areas_for_development: List[str]
    hiring_recommendation: str
    diversity_insights: str
    created_at: datetime


class PostInterviewAnalysisService:
    """
    Service for conducting post-interview analysis.
    """

    def __init__(self):
        self.analyses: Dict[str, PostInterviewAnalysis] = {}

    def generate_analysis(
        self, analysis_request: PostInterviewAnalysisRequest
    ) -> Optional[PostInterviewAnalysis]:
        """
        Generate a post-interview analysis based on the interview transcript and job description.
        """
        if not api_key:
            return None

        try:
            model = genai.GenerativeModel("gemini-2.5-flash")

            # Create a prompt to generate the post-interview analysis
            analysis_prompt = f"""
            Conduct a comprehensive, evidence-based post-interview analysis for the position of {analysis_request.job_title}.
            Base the analysis on the provided job description, interview transcript, and interviewer notes.

            - **Candidate Name:** {analysis_request.candidate_name}
            - **Job Description:** {analysis_request.job_description}
            - **Interview Transcript:** {analysis_request.interview_transcript}
            - **Interviewer Notes:** {analysis_request.interviewer_notes}

            Please generate the analysis using the exact following format. Do not add any extra text before or after these sections.

            ### OVERALL RATING ###
            [A single integer from 1 to 5]

            ### COMPETENCIES ASSESSED ###
            - Competency: [Competency Name 1] | Rating: [1-5] | Evidence: [Quote or summary from transcript] | Recommendation: [Brief recommendation]
            - Competency: [Competency Name 2] | Rating: [1-5] | Evidence: [Quote or summary from transcript] | Recommendation: [Brief recommendation]
            - Competency: [Competency Name 3] | Rating: [1-5] | Evidence: [Quote or summary from transcript] | Recommendation: [Brief recommendation]

            ### STRENGTHS ###
            - [Strength 1]
            - [Strength 2]
            - [Strength 3]

            ### AREAS FOR DEVELOPMENT ###
            - [Area 1]
            - [Area 2]
            - [Area 3]

            ### HIRING RECOMMENDATION ###
            [A single phrase: Strong Hire, Consider, or Reject]

            ### DIVERSITY INSIGHTS ###
            [A brief, objective comment on the candidate's potential contribution to a diverse and inclusive workplace]
            """

            response = model.generate_content(
                analysis_prompt,
                generation_config=genai.GenerationConfig(
                    temperature=0.4,  # Moderate temperature for balanced analysis
                ),
            )

            if not response or not hasattr(response, "text") or not response.text:
                return None

            analysis_text = response.text

            # Helper function for parsing sections
            def parse_section(text, header):
                try:
                    content = text.split(f"### {header} ###")[1].split("###")[0].strip()
                    if header in ["STRENGTHS", "AREAS FOR DEVELOPMENT"]:
                        return [
                            line.strip().lstrip("- ")
                            for line in content.split("\n")
                            if line.strip()
                        ]
                    return content
                except IndexError:
                    return (
                        ""
                        if header not in ["STRENGTHS", "AREAS FOR DEVELOPMENT"]
                        else []
                    )

            # Parse competencies
            competencies_assessed = []
            competencies_text = parse_section(analysis_text, "COMPETENCIES ASSESSED")
            for line in competencies_text.split("\n"):
                if not line.strip():
                    continue
                parts = [p.strip() for p in line.lstrip("- ").split("|")]
                try:
                    competency_data = {
                        item.split(":")[0].strip(): item.split(":", 1)[1].strip()
                        for item in parts
                    }
                    competencies_assessed.append(
                        CompetencyAssessment(
                            competency=competency_data.get("Competency", ""),
                            rating=int(competency_data.get("Rating", 0)),
                            evidence=competency_data.get("Evidence", ""),
                            recommendation=competency_data.get("Recommendation", ""),
                        )
                    )
                except (IndexError, ValueError) as e:
                    print(f"Could not parse competency line: {line}. Error: {e}")

            overall_rating_str = parse_section(analysis_text, "OVERALL RATING")

            analysis = PostInterviewAnalysis(
                id=str(uuid.uuid4()),
                interview_session_id=analysis_request.interview_session_id,
                candidate_name=analysis_request.candidate_name,
                overall_rating=(
                    int(overall_rating_str) if overall_rating_str.isdigit() else 0
                ),
                competencies_assessed=competencies_assessed,
                strengths=parse_section(analysis_text, "STRENGTHS"),
                areas_for_development=parse_section(
                    analysis_text, "AREAS FOR DEVELOPMENT"
                ),
                hiring_recommendation=parse_section(
                    analysis_text, "HIRING RECOMMENDATION"
                ),
                diversity_insights=parse_section(analysis_text, "DIVERSITY INSIGHTS"),
                created_at=datetime.now(),
            )

            # Store the analysis
            self.analyses[analysis.id] = analysis
            return analysis

        except Exception as e:
            print(f"Error generating post-interview analysis: {e}")
            return None

    def get_analysis(self, analysis_id: str) -> Optional[PostInterviewAnalysis]:
        """
        Retrieve a post-interview analysis by ID.
        """
        return self.analyses.get(analysis_id)

    def get_analyses_for_candidate(
        self, candidate_name: str
    ) -> List[PostInterviewAnalysis]:
        """
        Retrieve all analyses for a specific candidate.
        """
        return [
            analysis
            for analysis in self.analyses.values()
            if analysis.candidate_name == candidate_name
        ]


# Initialize the post-interview analysis service
post_interview_service = PostInterviewAnalysisService()
