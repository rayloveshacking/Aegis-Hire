# Aegis Hire Backend

This is the backend service for Aegis Hire, an AI-powered recruitment and onboarding assistant that streamlines the entire hiring workflow.

## Features

- **Job Description Generation**: AI-powered creation of inclusive, professional job descriptions
- **Candidate Screening**: Automated analysis of resumes against job descriptions with transparent, explainable AI decisions
- **Interview Scheduling**: Calendar integration for seamless interview coordination
- **Interview Preparation**: AI-generated guides for both interviewers and candidates
- **Live Interview Assistance**: Real-time support during interviews with bias detection and talking point reminders
- **Post-Interview Analysis**: Comprehensive evaluation with structured feedback
- **Onboarding Plans**: Personalized onboarding workflows for new hires

## Tech Stack

- **FastAPI**: Modern, fast web framework for building APIs with Python
- **Google Generative AI (Gemini)**: Powerful language model for AI capabilities
- **LangChain**: Framework for developing applications powered by language models
- **Supabase**: Open-source Firebase alternative for database and authentication
- **Pydantic**: Data validation and settings management using Python type annotations

## Setup

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Create a `.env` file in the backend directory with your API keys:
   ```env
   GEMINI_API_KEY=your_gemini_api_key
   SUPABASE_URL=your_supabase_url
   SUPABASE_KEY=your_supabase_key
   ```

3. Run the development server:
   ```bash
   uvicorn main:app --reload
   ```

## API Endpoints

### Job Description Generation
- `POST /api/generate-job-description`: Generate a job description based on a prompt

### Candidate Screening
- `POST /api/screen-applicants`: Analyze resumes against a job description

### Authentication
- `POST /api/auth/register`: Register a new user
- `POST /api/auth/login`: Authenticate a user
- `POST /api/auth/logout`: Logout the current user

### Interview Scheduling
- `GET /api/interview-slots`: Get available interview slots
- `POST /api/interview-slots/book`: Book an interview slot
- `POST /api/interview-slots/cancel`: Cancel an interview booking

### Interview Preparation
- `POST /api/interview-prep/generate-guide`: Generate an interview preparation guide
- `GET /api/interview-prep/guide/{guide_id}`: Retrieve a specific interview preparation guide

### Live Interview Assistance
- `POST /api/live-interview/process-transcript`: Process interview transcript chunks
- `GET /api/live-interview/events/{interview_session_id}`: Get interview events
- `GET /api/live-interview/transcript/{interview_session_id}`: Get full interview transcript

### Post-Interview Analysis
- `POST /api/post-interview-analysis/generate`: Generate post-interview analysis
- `GET /api/post-interview-analysis/{analysis_id}`: Retrieve specific analysis
- `GET /api/post-interview-analyses/candidate/{candidate_name}`: Get analyses for candidate

### Onboarding Plans
- `POST /api/onboarding-plan/generate`: Generate onboarding plan
- `GET /api/onboarding-plan/{plan_id}`: Retrieve specific onboarding plan
- `GET /api/onboarding-plans/candidate/{candidate_name}`: Get plans for candidate

### Data Retrieval
- `GET /api/job-descriptions`: Get all job descriptions
- `GET /api/job-descriptions/{job_id}`: Get specific job description
- `GET /api/screening-sessions`: Get all screening sessions
- `GET /api/screening-sessions/{session_id}`: Get specific screening session
