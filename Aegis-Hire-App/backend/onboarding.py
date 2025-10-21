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


class OnboardingPlanRequest(BaseModel):
    candidate_name: str
    job_title: str
    start_date: str  # Format: YYYY-MM-DD
    manager_name: str
    team_members: List[str]
    job_description: str
    interview_feedback: Optional[str] = ""


class OnboardingTask(BaseModel):
    id: str
    title: str
    description: str
    due_date: str  # Format: YYYY-MM-DD
    assigned_to: str
    status: str = "pending"  # pending, in_progress, completed


class OnboardingResource(BaseModel):
    id: str
    title: str
    url: str
    description: str
    category: str  # documents, training, tools, policies


class OnboardingPlan(BaseModel):
    id: str
    candidate_name: str
    job_title: str
    start_date: str
    manager_name: str
    team_members: List[str]
    welcome_message: str
    first_day_schedule: str
    first_week_goals: List[str]
    first_month_goals: List[str]
    tasks: List[OnboardingTask]
    resources: List[OnboardingResource]
    created_at: datetime


class OnboardingPlanService:
    """
    Service for generating personalized onboarding plans for new hires.
    """
    
    def __init__(self):
        self.plans: Dict[str, OnboardingPlan] = {}
    
    def generate_onboarding_plan(self, plan_request: OnboardingPlanRequest) -> Optional[OnboardingPlan]:
        """
        Generate a personalized onboarding plan based on candidate and job information.
        """
        if not api_key:
            return None
        
        try:
            model = genai.GenerativeModel('gemini-2.5-flash')
            
            # Create a prompt to generate the onboarding plan
            plan_prompt = f"""
            Create a comprehensive onboarding plan for a new hire based on the following information:
            
            Candidate Name: {plan_request.candidate_name}
            Job Title: {plan_request.job_title}
            Start Date: {plan_request.start_date}
            Manager Name: {plan_request.manager_name}
            Team Members: {', '.join(plan_request.team_members)}
            
            Job Description:
            {plan_request.job_description}
            
            Interview Feedback:
            {plan_request.interview_feedback}
            
            Provide your onboarding plan in the following format:
            
            1. Welcome Message: A personalized welcome message for the new hire
            
            2. First Day Schedule: A detailed schedule for the new hire's first day
            
            3. First Week Goals: 3-5 key goals for the new hire's first week
            
            4. First Month Goals: 3-5 key goals for the new hire's first month
            
            5. Onboarding Tasks: Create 10-15 specific tasks with:
               - Title
               - Description
               - Due date (relative to start date)
               - Assigned to (manager, team member, or self)
            
            6. Resources: Recommend 8-12 key resources organized by category:
               - Documents (policies, procedures, handbooks)
               - Training (courses, workshops, tutorials)
               - Tools (software, hardware, accounts to set up)
               - Policies (HR, IT, security guidelines)
            
            Make the plan comprehensive, personalized, and focused on helping the new hire succeed.
            """
            
            response = model.generate_content(
                plan_prompt,
                generation_config=genai.GenerationConfig(
                    temperature=0.6,  # Moderate temperature for balanced creativity
                )
            )
            
            if not response or not hasattr(response, 'text') or not response.text:
                return None
            
            # In a real implementation, we would parse the AI response to extract structured data
            # For now, we'll create a mock plan with the response text
            plan = OnboardingPlan(
                id=str(uuid.uuid4()),
                candidate_name=plan_request.candidate_name,
                job_title=plan_request.job_title,
                start_date=plan_request.start_date,
                manager_name=plan_request.manager_name,
                team_members=plan_request.team_members,
                welcome_message=f"Welcome {plan_request.candidate_name} to the team!",
                first_day_schedule="Morning: Meet with manager, afternoon: Tour office and meet team",
                first_week_goals=[
                    "Complete HR paperwork and benefits enrollment",
                    "Set up development environment and tools",
                    "Review project documentation and team processes",
                    "Attend team standup and weekly planning meeting"
                ],
                first_month_goals=[
                    "Deliver first small feature or bug fix",
                    "Participate in at least 2 team code reviews",
                    "Complete mandatory security and compliance training",
                    "Schedule 1:1 meetings with all direct team members"
                ],
                tasks=[
                    OnboardingTask(
                        id=str(uuid.uuid4()),
                        title="Complete HR paperwork",
                        description="Fill out new hire forms and submit to HR",
                        due_date=plan_request.start_date,
                        assigned_to="HR Department"
                    ),
                    OnboardingTask(
                        id=str(uuid.uuid4()),
                        title="Set up development environment",
                        description="Install required software and configure accounts",
                        due_date=plan_request.start_date,
                        assigned_to=plan_request.candidate_name
                    )
                ],
                resources=[
                    OnboardingResource(
                        id=str(uuid.uuid4()),
                        title="Employee Handbook",
                        url="https://company.com/handbook",
                        description="Company policies and procedures",
                        category="documents"
                    ),
                    OnboardingResource(
                        id=str(uuid.uuid4()),
                        title="Security Training",
                        url="https://training.company.com/security",
                        description="Mandatory security awareness course",
                        category="training"
                    )
                ],
                created_at=datetime.now()
            )
            
            # Store the plan
            self.plans[plan.id] = plan
            return plan
            
        except Exception as e:
            print(f"Error generating onboarding plan: {e}")
            return None
    
    def get_onboarding_plan(self, plan_id: str) -> Optional[OnboardingPlan]:
        """
        Retrieve an onboarding plan by ID.
        """
        return self.plans.get(plan_id)
    
    def get_plans_for_candidate(self, candidate_name: str) -> List[OnboardingPlan]:
        """
        Retrieve all onboarding plans for a specific candidate.
        """
        return [plan for plan in self.plans.values() if plan.candidate_name == candidate_name]


# Initialize the onboarding plan service
onboarding_service = OnboardingPlanService()
