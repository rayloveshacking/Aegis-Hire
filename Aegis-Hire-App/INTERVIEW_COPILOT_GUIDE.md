# Interview Copilot - User Guide

## Overview

The **Interview Copilot** is a groundbreaking AI-powered assistant that transforms the hiring process by providing real-time guidance, ensuring fairness, and generating comprehensive analysis throughout the interview lifecycle.

## Features

The Interview Copilot consists of three integrated phases:

### Phase 1: Pre-Interview Briefing

Generate a comprehensive interview guide before the interview begins.

**Features:**
- **Key Objectives**: AI-identified core competencies to assess
- **Structured Questions**: Standardized question bank for consistent evaluation
- **Legal Guardrails**: Quick reminders of topics to avoid
- **Email Delivery**: Send the guide to any interviewer's email

**How to Use:**
1. Navigate to the "Interview Copilot" tab in the main application
2. Click "Open Interview Prep Tool"
3. Fill in:
   - Job Title
   - Job Description
   - Candidate Name
   - Candidate Resume Summary
   - Interviewer Name
4. Click "Generate Interview Guide"
5. Review the generated guide
6. Enter an email address and click "Send Guide" to share

### Phase 2: Live Interview Moderator 🎙️

**The Star Feature** - A real-time AI assistant that runs during live interviews.

**Features:**
- **Voice Recording**: Uses Web Speech Recognition API (Chrome/Edge)
- **Live Transcription**: Real-time conversion of speech to text
- **AI Nudges**: Private alerts only visible to the interviewer
  - 🗣️ **Talk Ratio Monitor**: Alerts when interviewer speaks too much
  - 📋 **Topic Tracker**: Reminds about uncovered job requirements
  - ⚠️ **Bias Interrupter**: Warns about potentially biased questions
- **Automatic Scribe**: Full transcript saved for post-interview analysis

**How to Use:**
1. Navigate to the "Interview Copilot" tab
2. Click "Open Live Moderator"
3. Enter the job description for context
4. Click "Start Interview Session"
5. A **pop-up modal** will appear (this is private to you!)
6. Click "🎤 Start Recording" to begin voice capture
7. Conduct the interview normally
8. Watch for AI nudges in the red panel on the right
9. Click "⏹️ Stop Recording" when done
10. Close the modal to end the session

**Browser Requirements:**
- Google Chrome (recommended)
- Microsoft Edge
- Microphone access required

**Privacy Note:**
The live moderator modal is only visible to you, not the candidate. All nudges and alerts are completely private.

### Phase 3: Post-Interview Analysis

Generate evidence-based reports after the interview concludes.

**Features:**
- **Overall Rating**: 1-5 scale assessment
- **Competency Breakdown**: Detailed evaluation of each skill
- **Strengths & Development Areas**: Balanced candidate profile
- **Hiring Recommendation**: Clear "Strong Hire," "Consider," or "Reject"
- **Diversity Insights**: Objective contribution analysis
- **Email Delivery**: Send analysis to hiring managers

**How to Use:**
1. Navigate to the "Interview Copilot" tab
2. Click "Open Post-Interview Analysis"
3. Fill in:
   - Full Interview Transcript (from Phase 2 or manual entry)
   - Job Title
   - Job Description
   - Candidate Name
4. Click "Generate Analysis"
5. Review the comprehensive report
6. Enter an email address and click "Send Analysis" to share

## Technical Setup

### Backend Setup

1. Ensure your backend server is running:
```bash
cd backend
uvicorn main:app --reload
```

2. Required environment variables in `.env`:
```
GEMINI_API_KEY=your_api_key_here
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password
```

### Frontend Setup

1. Ensure your frontend is running:
```bash
cd frontend
npm run dev
```

2. Access the application at `http://localhost:3000`

### CORS Configuration

The backend is configured to accept requests from:
- `http://localhost:3000`
- `http://127.0.0.1:3000`

## API Endpoints

### Interview Preparation
- `POST /api/interview-prep/generate-guide` - Generate interview guide
- `GET /api/interview-prep/guide/{guide_id}` - Retrieve guide by ID
- `POST /api/interview-prep/send-guide` - Email guide to recipient

### Live Interview
- `WS /ws/interview/{session_id}` - WebSocket for real-time moderation
- `POST /api/live-interview/process-transcript` - Process transcript chunk
- `GET /api/live-interview/events/{session_id}` - Get all nudges/events
- `GET /api/live-interview/transcript/{session_id}` - Get full transcript

### Post-Interview Analysis
- `POST /api/post-interview/generate-analysis` - Generate analysis report
- `GET /api/post-interview/analysis/{analysis_id}` - Retrieve analysis by ID
- `POST /api/post-interview/send-analysis` - Email analysis to recipient

## Responsible AI Design Principles

The Interview Copilot is built on three core principles:

1. **Transparency**: Every AI decision is explainable and evidence-based
2. **Fairness**: The system actively detects and prevents bias
3. **Human-in-the-Loop**: AI augments, never replaces, human judgment

## Troubleshooting

### "Failed to fetch" error
- **Cause**: CORS issue or backend not running
- **Solution**: Ensure backend is running on port 8000 and CORS is configured

### Microphone not working
- **Cause**: Browser permissions or unsupported browser
- **Solution**: Use Chrome/Edge and grant microphone permissions

### Speech recognition not starting
- **Cause**: Web Speech API not available
- **Solution**: Use Google Chrome (recommended) or Microsoft Edge

### WebSocket connection fails
- **Cause**: Backend WebSocket endpoint not accessible
- **Solution**: Check backend logs and ensure `/ws/interview/{session_id}` is accessible

### Email not sending
- **Cause**: SMTP credentials not configured
- **Solution**: Add SMTP settings to `.env` file in backend

## Demo Workflow

**Complete Interview Workflow Example:**

1. **Before the Interview** (Phase 1)
   - Generate interview guide for "Priya Sharma - Senior Cloud Engineer"
   - Send guide to interviewer's email
   - Interviewer reviews objectives and questions

2. **During the Interview** (Phase 2)
   - Start live moderator session
   - Begin voice recording
   - Conduct interview
   - AI provides nudges: "Consider allowing candidate more time to speak"
   - AI alerts: "Potential bias detected: Avoid questions about family"
   - Full transcript captured automatically

3. **After the Interview** (Phase 3)
   - Copy transcript from Phase 2
   - Generate comprehensive analysis
   - Review competency assessments
   - Send analysis to hiring manager
   - Make data-driven hiring decision

## Best Practices

1. **Pre-Interview**: Always generate and review the guide 15 minutes before the interview
2. **Live Interview**: Keep the moderator modal in a corner of your screen, don't stare at it
3. **Post-Interview**: Generate the analysis immediately while details are fresh
4. **Team Collaboration**: Share guides and analyses via email for consistency
5. **Continuous Improvement**: Review nudges after interviews to improve your technique

## Security & Privacy

- All data is processed server-side
- Transcripts are ephemeral (stored only during session)
- Email delivery uses secure SMTP
- No data is shared with third parties
- Complies with GDPR and employment law

## Support

For issues or questions:
- Check the troubleshooting section above
- Review backend logs: `backend/` directory
- Review frontend console: Browser DevTools
- Contact: aegis-hire-support@example.com

---

**Built with ❤️ for Glasgow Hackathon 2025**

*Making hiring fair, transparent, and effective through Responsible AI.*