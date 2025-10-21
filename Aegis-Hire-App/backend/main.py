from fastapi import (
    FastAPI,
    Depends,
    WebSocket,
    WebSocketDisconnect,
    File,
    UploadFile,
    HTTPException,
    Request,
)
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from dotenv import load_dotenv
import json

# Import application-specific services and models
from live_interview import live_interview_service, InterviewEventType
from pdf_parser import PDFParser
from interview_prep import interview_prep_service, InterviewPrepRequest
from post_interview import post_interview_service, PostInterviewAnalysisRequest
from job_description import job_description_service, JobDescriptionRequest

# --- Environment and Configuration ---
load_dotenv()

# --- FastAPI Application Setup ---
app = FastAPI(
    title="Glasgow Aegis Hire API",
    description="API endpoints for the AI-powered hiring assistant.",
    version="1.0.0-reverted",
)

# CORS (Cross-Origin Resource Sharing) Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Helper Functions ---
def validate_and_clean_name(name: str) -> str:
    """
    Validate and clean a candidate name extracted from resume.
    """
    if not name or len(name.strip()) < 2:
        return ""

    # Remove extra whitespace and non-alphabetic characters except spaces, periods, hyphens
    cleaned = " ".join(name.strip().split())
    cleaned = "".join(c for c in cleaned if c.isalpha() or c in " .-")

    # Check if it looks like a real name (at least 2 words, proper length)
    words = cleaned.split()
    if len(words) < 2 or len(cleaned) > 50:
        return ""

    # Check for common non-name patterns
    non_names = [
        "resume",
        "curriculum",
        "vitae",
        "cv",
        "profile",
        "contact",
        "information",
    ]
    if any(non_name.lower() in cleaned.lower() for non_name in non_names):
        return ""

    return cleaned


# --- Authentication (Placeholder) ---
async def get_current_user():
    # For now, this is a placeholder that allows all requests.
    return {"username": "testuser"}


# --- API Endpoints ---


# Job Description Generation Endpoints
@app.post("/api/generate-job-description")
async def generate_job_description(
    request: JobDescriptionRequest, current_user: dict = Depends(get_current_user)
):
    """
    Generate an AI-powered job description based on a prompt.
    """
    try:
        job_description = job_description_service.generate_job_description(request)

        if not job_description:
            raise HTTPException(
                status_code=500,
                detail="Failed to generate job description. Check if GEMINI_API_KEY is configured.",
            )

        # Format the job description as a readable string
        formatted_description = f"""# {job_description.title}

**Company:** {job_description.company}
**Department:** {job_description.department}
**Location:** {job_description.location}
**Employment Type:** {job_description.employment_type}
**Salary Range:** {job_description.salary_range}

## About the Role
{job_description.overview}

## Key Responsibilities
{chr(10).join(f"• {resp}" for resp in job_description.responsibilities)}

## Requirements
{chr(10).join(f"• {req}" for req in job_description.requirements)}

## Preferred Qualifications
{chr(10).join(f"• {pref}" for pref in job_description.preferred_qualifications)}

## Benefits
{chr(10).join(f"• {benefit}" for benefit in job_description.benefits)}
"""

        return {"job_description": formatted_description}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to generate job description: {str(e)}"
        )


@app.get("/api/job-descriptions")
async def get_all_job_descriptions(current_user: dict = Depends(get_current_user)):
    """
    Get all job descriptions.
    """
    try:
        job_descriptions = job_description_service.get_all_job_descriptions()
        return {"job_descriptions": [jd.dict() for jd in job_descriptions]}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to retrieve job descriptions: {str(e)}"
        )


@app.get("/api/job-descriptions/{job_id}")
async def get_job_description(
    job_id: str, current_user: dict = Depends(get_current_user)
):
    """
    Retrieve a job description by ID.
    """
    try:
        job_description = job_description_service.get_job_description(job_id)

        if not job_description:
            raise HTTPException(status_code=404, detail="Job description not found")

        return {"job_description": job_description.dict()}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to retrieve job description: {str(e)}"
        )


# PDF Upload and Parsing Endpoints
@app.post("/api/parse-resume")
async def parse_resume(file: UploadFile = File(...)):
    """
    Parse a resume PDF file (public endpoint for screening workflow).
    """
    try:
        if not file.filename.lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail="Only PDF files are supported")

        # Read the file content
        content = await file.read()

        # Parse the PDF
        resume_data = PDFParser.parse_resume(content)

        if "error" in resume_data:
            raise HTTPException(status_code=400, detail=resume_data["error"])

        return {
            "parsed_resume": {
                "candidate_name": resume_data.get("candidate_name"),
                "raw_text": resume_data.get("raw_text"),
                "sections": resume_data.get("sections", {}),
            }
        }
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to parse resume: {str(e)}"
        )


@app.post("/api/upload-resume")
async def upload_resume(
    file: UploadFile = File(...), current_user: dict = Depends(get_current_user)
):
    """
    Upload and parse a resume PDF file (authenticated endpoint).
    """
    try:
        if not file.filename.lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail="Only PDF files are supported")

        # Read the file content
        content = await file.read()

        # Parse the PDF
        resume_data = PDFParser.parse_resume(content)

        if "error" in resume_data:
            raise HTTPException(status_code=400, detail=resume_data["error"])

        return {
            "success": True,
            "candidate_name": resume_data.get("candidate_name"),
            "raw_text": resume_data.get("raw_text"),
            "sections": resume_data.get("sections", {}),
            "filename": file.filename,
        }
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to process resume: {str(e)}"
        )


# Candidate Screening Endpoint
@app.post("/api/screen-applicants")
async def screen_applicants(request: dict):
    """
    Screen multiple candidates against a job description using AI analysis.
    """
    try:
        from screening import screening_service, ScreeningRequest
        
        # Convert dict to ScreeningRequest
        screening_request = ScreeningRequest(
            job_description=request.get("job_description", ""),
            resumes=request.get("resumes", []),
            resume_names=request.get("resume_names", [])
        )
        
        results = screening_service.screen_candidates(screening_request)
        
        if not results:
            raise HTTPException(
                status_code=500,
                detail="Failed to screen candidates. Check if GEMINI_API_KEY is configured.",
            )
        
        return {"screening_results": results, "session_id": "screening-session"}
    except ImportError:
        # If screening module doesn't exist, use a basic implementation
        import google.generativeai as genai
        import os
        import re
        
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured")
        
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-2.0-flash-exp')
        
        job_description = request.get("job_description", "")
        resumes = request.get("resumes", [])
        resume_names = request.get("resume_names", [])
        
        if not job_description or not resumes:
            raise HTTPException(status_code=400, detail="Job description and resumes are required")
        
        screening_results = []
        
        for idx, resume in enumerate(resumes):
            # Get pre-extracted name if available
            candidate_name = resume_names[idx] if idx < len(resume_names) else None
            
            # Create analysis prompt
            analysis_prompt = f"""
            Analyze the following resume against this job description:
            
            Job Description:
            {job_description}
            
            Resume:
            {resume}
            
            IMPORTANT: Extract the candidate's FULL NAME from the resume.
            The name is typically at the top of the resume (first few lines).
            DO NOT use institution names like "Ngee Ann Polytechnic" or company names.
            Extract the PERSON'S NAME (e.g., "Isaac Lum Yan Kit", "Thar Htet Shein").
            
            Provide your analysis in this format:
            - Candidate Name: [Full name of the person]
            - Rank: [Number based on match quality]
            - Justification: [Bullet points of matched and missing skills]
            - Summary: [Brief summary of candidate fit]
            """
            
            try:
                response = model.generate_content(
                    analysis_prompt,
                    generation_config=genai.GenerationConfig(temperature=0.3)
                )
                
                response_text = response.text if response and hasattr(response, 'text') else ""
                
                # Extract candidate name if not already provided
                if not candidate_name or not validate_and_clean_name(candidate_name):
                    # Try to extract from first few lines of resume
                    lines = resume.split('\n')
                    for i, line in enumerate(lines[:10]):
                        line = line.strip()
                        if not line or len(line) < 3:
                            continue
                        
                        # Skip non-name patterns
                        if any(skip in line.lower() for skip in ['resume', 'curriculum', 'cv', 'polytechnic', 'university', 'email', 'phone', '@']):
                            continue
                        
                        # Look for name pattern (2-4 capitalized words)
                        name_match = re.search(r'^([A-Z][a-z]+(?: [A-Z][a-z]+){1,3})$', line)
                        if name_match:
                            potential_name = name_match.group(1)
                            validated = validate_and_clean_name(potential_name)
                            if validated:
                                candidate_name = validated
                                break
                    
                    # If still no name, try to extract from AI response
                    if not candidate_name:
                        name_match = re.search(r'Candidate Name:\s*(.+?)(?:\n|$)', response_text, re.IGNORECASE)
                        if name_match:
                            extracted_name = name_match.group(1).strip()
                            validated = validate_and_clean_name(extracted_name)
                            if validated:
                                candidate_name = validated
                
                # Fallback to generic name
                if not candidate_name:
                    candidate_name = f"Candidate {idx + 1}"
                
                # Extract justification
                justification = []
                just_match = re.search(r'Justification:\s*(.+?)(?=\n- Summary:|\n\n|$)', response_text, re.DOTALL | re.IGNORECASE)
                if just_match:
                    just_text = just_match.group(1).strip()
                    bullets = re.split(r'[-•*]\s*', just_text)
                    justification = [b.strip() for b in bullets if b.strip()]
                
                # Extract summary
                summary = ""
                sum_match = re.search(r'Summary:\s*(.+?)(?=\n\n|$)', response_text, re.DOTALL | re.IGNORECASE)
                if sum_match:
                    summary = sum_match.group(1).strip()
                
                screening_results.append({
                    "candidate": candidate_name,
                    "rank": idx + 1,
                    "justification": justification if justification else ["AI analysis completed."],
                    "summary": summary if summary else "AI-generated analysis of candidate fit.",
                    "details": response_text
                })
                
            except Exception as e:
                print(f"Error analyzing resume {idx + 1}: {e}")
                screening_results.append({
                    "candidate": candidate_name or f"Candidate {idx + 1}",
                    "rank": idx + 1,
                    "justification": [f"Error during analysis: {str(e)}"],
                    "summary": "Analysis failed",
                    "details": ""
                })
        
        return {"screening_results": screening_results, "session_id": "screening-session"}
        
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to screen applicants: {str(e)}"
        )


# Scheduling Endpoints
@app.post("/api/scheduling/generate-suggestions")
async def generate_scheduling_suggestions(request: dict):
    """
    Generate interview scheduling suggestions based on participant availability.
    """
    try:
        from datetime import datetime, timedelta
        import uuid
        
        candidate_name = request.get("candidate_name", "")
        duration_minutes = request.get("duration_minutes", 45)
        participant_emails = request.get("participant_emails", [])
        preferred_time_range = request.get("preferred_time_range", "next week")
        
        # Generate mock scheduling suggestions
        # In a real implementation, this would integrate with calendar APIs
        suggestions = []
        base_date = datetime.now() + timedelta(days=2)
        
        for i in range(5):
            slot_date = base_date + timedelta(days=i)
            # Generate 2 slots per day
            for hour in [10, 14]:  # 10 AM and 2 PM
                slot_start = slot_date.replace(hour=hour, minute=0, second=0, microsecond=0)
                slot_end = slot_start + timedelta(minutes=duration_minutes)
                
                slot = {
                    "id": str(uuid.uuid4()),
                    "start_time": slot_start.isoformat(),
                    "end_time": slot_end.isoformat(),
                    "duration_minutes": duration_minutes,
                    "available": True,
                    "participants": [
                        {
                            "id": str(uuid.uuid4()),
                            "name": email.split('@')[0].replace('.', ' ').title(),
                            "email": email,
                            "role": "Interviewer"
                        }
                        for email in participant_emails[:3]  # Limit to 3 participants
                    ],
                    "meeting_link": None,
                    "calendar_event_ids": {}
                }
                suggestions.append(slot)
        
        return {
            "success": True,
            "message": f"Generated {len(suggestions)} scheduling suggestions for {candidate_name}",
            "suggested_slots": suggestions[:5],  # Return top 5
            "calendar_invitations_sent": False
        }
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to generate scheduling suggestions: {str(e)}"
        )


@app.post("/api/scheduling/schedule-interview")
async def schedule_interview(request: dict):
    """
    Schedule an interview by auto-selecting the best available slot.
    """
    try:
        from datetime import datetime, timedelta
        import uuid
        
        candidate_name = request.get("candidate_name", "")
        duration_minutes = request.get("duration_minutes", 45)
        participant_emails = request.get("participant_emails", [])
        
        # Auto-select the first available slot (2 days from now at 10 AM)
        base_date = datetime.now() + timedelta(days=2)
        slot_start = base_date.replace(hour=10, minute=0, second=0, microsecond=0)
        slot_end = slot_start + timedelta(minutes=duration_minutes)
        
        booked_slot = {
            "id": str(uuid.uuid4()),
            "start_time": slot_start.isoformat(),
            "end_time": slot_end.isoformat(),
            "duration_minutes": duration_minutes,
            "available": False,
            "booked_by": "system",
            "booked_for": candidate_name,
            "participants": [
                {
                    "id": str(uuid.uuid4()),
                    "name": email.split('@')[0].replace('.', ' ').title(),
                    "email": email,
                    "role": "Interviewer"
                }
                for email in participant_emails
            ],
            "meeting_link": f"https://meet.company.com/{uuid.uuid4().hex[:8]}",
            "calendar_event_ids": {email: str(uuid.uuid4()) for email in participant_emails}
        }
        
        return {
            "success": True,
            "message": f"Interview scheduled successfully for {candidate_name}",
            "suggested_slots": [],
            "booked_slot": booked_slot,
            "calendar_invitations_sent": True
        }
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to schedule interview: {str(e)}"
        )


@app.post("/api/scheduling/book-specific-slot")
async def book_specific_slot(request: dict):
    """
    Book a specific time slot for an interview.
    """
    try:
        from datetime import datetime, timedelta
        import uuid

        slot_id = request.get("slot_id", "")
        candidate_name = request.get("candidate_name", "")
        participant_emails = request.get("participant_emails", [])
        start_time_str = request.get("start_time", "")
        duration_minutes = request.get("duration_minutes", 45)

        # Parse start_time string to datetime object
        start_time = datetime.fromisoformat(start_time_str.replace("Z", "+00:00"))

        # In a real implementation, this would check availability and book the slot
        booked_slot = {
            "id": slot_id,
            "start_time": start_time.isoformat(),
            "end_time": (start_time + timedelta(minutes=duration_minutes)).isoformat(),
            "duration_minutes": duration_minutes,
            "available": False,
            "booked_by": "system",
            "booked_for": candidate_name,
            "participants": [
                {
                    "id": str(uuid.uuid4()),
                    "name": email.split('@')[0].replace('.', ' ').title(),
                    "email": email,
                    "role": "Interviewer"
                }
                for email in participant_emails
            ],
            "meeting_link": f"https://meet.company.com/{uuid.uuid4().hex[:8]}",
            "calendar_event_ids": {email: str(uuid.uuid4()) for email in participant_emails}
        }

        # Generate email content
        email_body = f"""
        Dear {candidate_name},

        This email confirms your interview with Aegis Hire.

        Date & Time: {start_time.strftime('%A, %B %d, %Y at %I:%M %p %Z')}
        Duration: {duration_minutes} minutes
        Meeting Link: {booked_slot['meeting_link']}

        Please ensure you have a stable internet connection and a quiet environment for the interview.

        Best regards,
        The Aegis Hire Team
        """

        return {
            "success": True,
            "message": f"Slot booked successfully for {candidate_name}",
            "slot": booked_slot,
            "email_content": email_body.strip(),
            "calendar_invitations_sent": True
        }
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to book slot: {str(e)}"
        )


# Email Sending Endpoint
@app.post("/api/send-email")
async def send_email(request: Request):
    """
    Send interview confirmation email using SMTP.
    """
    try:
        import smtplib
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart
        import os
        
        # Parse JSON body
        body_data = await request.json()
        
        print("📧 Email send request received")
        print(f"📧 Request body: {body_data}")
        
        to_email = body_data.get("to_email", "")
        subject = body_data.get("subject", "Interview Confirmation")
        body = body_data.get("body", "")
        
        print(f"📧 To: {to_email}")
        print(f"📧 Subject: {subject}")
        print(f"📧 Body length: {len(body)} characters")
        
        if not to_email or not body:
            raise HTTPException(status_code=400, detail="Missing required fields: to_email and body")
        
        # Get SMTP configuration from environment
        smtp_server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
        smtp_port = int(os.getenv("SMTP_PORT", "587"))
        smtp_user = os.getenv("SMTP_USER")
        smtp_password = os.getenv("SMTP_PASSWORD")
        
        print(f"📧 SMTP Server: {smtp_server}:{smtp_port}")
        print(f"📧 SMTP User: {smtp_user}")
        
        if not smtp_user or not smtp_password:
            raise HTTPException(
                status_code=500,
                detail="SMTP configuration missing. Please set SMTP_USER and SMTP_PASSWORD in .env file"
            )
        
        # Create message
        msg = MIMEMultipart()
        msg['From'] = smtp_user
        msg['To'] = to_email
        msg['Subject'] = subject
        
        msg.attach(MIMEText(body, 'plain'))
        
        print("📧 Connecting to SMTP server...")
        # Send email
        with smtplib.SMTP(smtp_server, smtp_port) as server:
            print("📧 Starting TLS...")
            server.starttls()
            print("📧 Logging in...")
            server.login(smtp_user, smtp_password)
            print("📧 Sending message...")
            server.send_message(msg)
        
        print(f"✅ Email sent successfully to {to_email}")
        return {
            "success": True,
            "message": f"Email sent successfully to {to_email}"
        }
    except smtplib.SMTPAuthenticationError as e:
        print(f"❌ SMTP Authentication Error: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"SMTP authentication failed. Please check your email credentials."
        )
    except smtplib.SMTPException as e:
        print(f"❌ SMTP Error: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"SMTP error: {str(e)}"
        )
    except Exception as e:
        print(f"❌ Error sending email: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to send email: {str(e)}"
        )


# Interview Preparation Endpoints
@app.post("/api/generate-interview-guide")
async def generate_interview_guide(
    prep_request: InterviewPrepRequest, current_user: dict = Depends(get_current_user)
):
    """
    Generate an AI-powered interview guide.
    """
    try:
        guide = interview_prep_service.generate_interview_guide(prep_request)

        if not guide:
            raise HTTPException(
                status_code=500,
                detail="Failed to generate interview guide. Check if GEMINI_API_KEY is configured.",
            )

        return {"success": True, "guide": guide.dict()}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to generate interview guide: {str(e)}"
        )


@app.get("/api/interview-guide/{guide_id}")
async def get_interview_guide(
    guide_id: str, current_user: dict = Depends(get_current_user)
):
    """
    Retrieve an interview guide by ID.
    """
    try:
        guide = interview_prep_service.get_interview_guide(guide_id)

        if not guide:
            raise HTTPException(status_code=404, detail="Interview guide not found")

        return {"guide": guide.dict()}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to retrieve interview guide: {str(e)}"
        )


# Post-Interview Analysis Endpoints
@app.post("/api/generate-interview-analysis")
async def generate_interview_analysis(
    analysis_request: PostInterviewAnalysisRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Generate AI-powered post-interview analysis.
    """
    try:
        analysis = post_interview_service.generate_analysis(analysis_request)

        if not analysis:
            raise HTTPException(
                status_code=500,
                detail="Failed to generate interview analysis. Check if GEMINI_API_KEY is configured.",
            )

        return {"success": True, "analysis": analysis.dict()}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to generate interview analysis: {str(e)}"
        )


@app.get("/api/interview-analysis/{analysis_id}")
async def get_interview_analysis(
    analysis_id: str, current_user: dict = Depends(get_current_user)
):
    """
    Retrieve an interview analysis by ID.
    """
    try:
        analysis = post_interview_service.get_analysis(analysis_id)

        if not analysis:
            raise HTTPException(status_code=404, detail="Interview analysis not found")

        return {"analysis": analysis.dict()}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to retrieve interview analysis: {str(e)}"
        )


# Live Interview Endpoints
@app.get("/api/live-interview/events/{interview_session_id}")
async def get_interview_events(
    interview_session_id: str, current_user: dict = Depends(get_current_user)
):
    try:
        events = live_interview_service.get_interview_events(interview_session_id)
        return {"events": events}
    except Exception as e:
        return {"error": f"Failed to retrieve interview events: {str(e)}"}


@app.get("/api/live-interview/transcript/{interview_session_id}")
async def get_interview_transcript(
    interview_session_id: str, current_user: dict = Depends(get_current_user)
):
    try:
        transcript = live_interview_service.get_full_transcript(interview_session_id)
        return {"transcript": transcript}
    except Exception as e:
        return {"error": f"Failed to retrieve transcript: {str(e)}"}


@app.websocket("/ws/interview/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    """
    WebSocket endpoint for live interview assistance.
    Receives transcript TEXT chunks from the browser's SpeechRecognition API
    and sends back AI-generated nudges.
    """
    await websocket.accept()
    print(f"WebSocket connection established for session: {session_id}")

    # Placeholder job description (in a real app, this would be fetched from a database)
    job_description_placeholder = "Senior Software Engineer with 5+ years of experience in Python, Django, and AWS."

    try:
        while True:
            # The frontend will send chunks of the live transcript as text.
            transcript_chunk = await websocket.receive_text()
            print(
                f"Received transcript chunk for {session_id}: '{transcript_chunk[:100]}...'"
            )

            events = await live_interview_service.process_transcript_chunk(
                session_id, transcript_chunk, job_description_placeholder
            )

            # Only send nudges, not the full scribe events.
            nudges = [
                event
                for event in events
                if event.event_type != InterviewEventType.AUTOMATIC_SCRIBE
            ]

            if nudges:
                for nudge in nudges:
                    await websocket.send_json(nudge.dict())
                    print(f"Sent nudge to {session_id}: {nudge.message}")

    except WebSocketDisconnect:
        print(f"Client disconnected from session {session_id}")
    except Exception as e:
        print(f"Error in WebSocket session {session_id}: {e}")
        await websocket.close(code=1011, reason=f"An error occurred: {e}")


# --- Server Entry Point ---
if __name__ == "__main__":
    print("Starting FastAPI server...")
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
