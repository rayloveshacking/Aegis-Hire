from pydantic import BaseModel
from typing import List, Dict, Optional
import uuid
from datetime import datetime
import google.generativeai as genai
import os
from dotenv import load_dotenv
import asyncio
import json
from enum import Enum
from interview_moderator import InterviewModerator


# Load environment variables
load_dotenv()

# Configure the Gemini API key
api_key = os.getenv("GOOGLE_API_KEY")
if api_key:
    genai.configure(api_key=api_key)


class InterviewEventType(str, Enum):
    TALK_RATIO_MONITOR = "talk_ratio_monitor"
    TOPIC_TRACKER = "topic_tracker"
    BIAS_INTERRUPTER = "bias_interrupter"
    AUTOMATIC_SCRIBE = "automatic_scribe"
    INTERVIEW_MODERATOR = "interview_moderator"


class InterviewEvent(BaseModel):
    id: str
    interview_session_id: str
    event_type: InterviewEventType
    message: str
    timestamp: datetime
    metadata: Optional[Dict] = {}


class LiveInterviewService:
    """
    Service for providing live interview assistance features.
    This includes talk ratio monitoring, topic tracking, bias interruption,
    and automatic scribing capabilities.
    """

    def __init__(self):
        self.active_sessions: Dict[str, List[InterviewEvent]] = {}
        self.transcript_parts: Dict[str, List[str]] = {}
        # Track analysis triggers to avoid excessive API calls
        self.analysis_triggers: Dict[str, Dict[str, int]] = {}
        self.moderator = InterviewModerator()

    async def process_transcript_chunk(
        self, interview_session_id: str, transcript_chunk: str, job_description: str
    ) -> List[InterviewEvent]:
        """
        Process a chunk of transcript and generate relevant interview assistance events.
        """
        print(f"\n--- DEBUG: Processing chunk for session {interview_session_id} ---")
        print(f'Chunk: "{transcript_chunk[:100]}..."')
        print(f"API Key available: {api_key is not None}")
        events = []

        # The frontend now sends the full transcript in each "chunk".
        # We will treat the incoming chunk as the full, authoritative transcript.
        full_transcript = transcript_chunk

        # Initialize triggers for a new session
        if interview_session_id not in self.analysis_triggers:
            self.analysis_triggers[interview_session_id] = {
                "talk_ratio": 0,
                "topic_coverage": 0,
                "bias_detection": 0,
            }

        # Store the full transcript for the get_full_transcript method.
        # Storing it in a list to maintain compatibility with that method's join logic.
        self.transcript_parts[interview_session_id] = [full_transcript]

        # Generate assistance events based on the transcript
        events.extend(
            await self._analyze_talk_ratio(interview_session_id, full_transcript)
        )
        events.extend(
            await self._check_topic_coverage(
                interview_session_id, full_transcript, job_description
            )
        )
        events.extend(
            await self._detect_potential_bias(interview_session_id, full_transcript)
        )

        events.extend(
            await self._get_moderator_feedback(interview_session_id, full_transcript)
        )

        # The AUTOMATIC_SCRIBE event is removed to avoid sending the entire (and growing)
        # transcript back to the frontend with every message. The frontend
        # was ignoring this event anyway.

        # Store events
        if interview_session_id not in self.active_sessions:
            self.active_sessions[interview_session_id] = []
        self.active_sessions[interview_session_id].extend(events)

        print(
            f"DEBUG: Generated {len(events)} events for session {interview_session_id}"
        )
        for event in events:
            print(f"  - {event.event_type}: {event.message[:50]}...")

        return events

    async def _get_moderator_feedback(
        self, interview_session_id: str, transcript: str
    ) -> List[InterviewEvent]:
        """
        Generate feedback from the interview moderator.
        """
        events = []
        feedback = self.moderator.generate_feedback(transcript)
        if feedback:
            feedback_event = InterviewEvent(
                id=str(uuid.uuid4()),
                interview_session_id=interview_session_id,
                event_type=InterviewEventType.INTERVIEW_MODERATOR,
                message=feedback,
                timestamp=datetime.now(),
                metadata={"source": "InterviewModerator"},
            )
            events.append(feedback_event)
        return events

    async def _analyze_talk_ratio(
        self, interview_session_id: str, transcript: str
    ) -> List[InterviewEvent]:
        """
        Analyze the talk ratio between interviewer and interviewee.
        This is a simplified analysis without speaker diarization.
        It triggers if the transcript grows significantly without a pause,
        suggesting one person is talking too much.
        """
        events = []

        triggers = self.analysis_triggers.get(interview_session_id, {})
        last_check_length = triggers.get("talk_ratio", 0)
        current_length = len(transcript.split())

        print(
            f"DEBUG: Talk Ratio check. Growth: {current_length - last_check_length} words. (Threshold: >150)"
        )
        # If transcript has grown by over 150 words since last check, trigger a nudge.
        if current_length - last_check_length > 150:
            print("DEBUG: ---> TALK RATIO NUDGE TRIGGERED <---")
            ratio_event = InterviewEvent(
                id=str(uuid.uuid4()),
                interview_session_id=interview_session_id,
                event_type=InterviewEventType.TALK_RATIO_MONITOR,
                message="Consider allowing the candidate more time to speak.",
                timestamp=datetime.now(),
                metadata={
                    "note": "This is a simulated event based on continuous speech."
                },
            )
            events.append(ratio_event)
            # Update the length for the next check
            if interview_session_id in self.analysis_triggers:
                self.analysis_triggers[interview_session_id]["talk_ratio"] = (
                    current_length
                )

        return events

    async def _check_topic_coverage(
        self, interview_session_id: str, transcript: str, job_description: str
    ) -> List[InterviewEvent]:
        """
        Check if key topics from the job description are covered in the interview.
        """
        triggers = self.analysis_triggers.get(interview_session_id, {})
        last_check_length = triggers.get("topic_coverage", 0)
        current_length = len(transcript.split())

        # Trigger analysis every ~50 words (lowered for faster dev feedback).
        # Increase this back to ~250 for production to reduce API calls.
        if current_length - last_check_length < 50:
            return []

        # Update the trigger length before making the API call
        if interview_session_id in self.analysis_triggers:
            self.analysis_triggers[interview_session_id]["topic_coverage"] = (
                current_length
            )

        events = []
        print("DEBUG: ---> TOPIC COVERAGE ANALYSIS TRIGGERED <---")

        if not api_key:
            print("DEBUG: No API key - using fallback topic coverage check")
            # Fallback: Check if Kubernetes is mentioned (from job description)
            if "kubernetes" not in transcript.lower() and current_length > 100:
                topic_event = InterviewEvent(
                    id=str(uuid.uuid4()),
                    interview_session_id=interview_session_id,
                    event_type=InterviewEventType.TOPIC_TRACKER,
                    message="Consider asking about Kubernetes experience, which is mentioned in the job requirements.",
                    timestamp=datetime.now(),
                    metadata={"fallback": True},
                )
                events.append(topic_event)
            return events

        try:
            model = genai.GenerativeModel("gemini-2.5-flash")

            # Create a prompt to analyze topic coverage
            coverage_prompt = f"""
            Analyze the following interview transcript and check if it covers the key requirements from the job description.

            Job Description:
            {job_description}

            Interview Transcript:
            {transcript}

            Identify if any key competencies or requirements from the job description are missing from the conversation.
            If so, suggest what topics should be covered.
            """

            response = model.generate_content(
                coverage_prompt,
                generation_config=genai.GenerationConfig(
                    temperature=0.3,  # Low temperature for consistent analysis
                ),
            )

            if response and hasattr(response, "text") and response.text:
                # In a real implementation, we would parse the response to extract structured data
                # For now, we'll just create an event if the response contains suggestions
                if (
                    "missing" in response.text.lower()
                    or "should" in response.text.lower()
                ):
                    print("DEBUG: ---> Topic nudge condition MET. Creating event. <---")
                    topic_event = InterviewEvent(
                        id=str(uuid.uuid4()),
                        interview_session_id=interview_session_id,
                        event_type=InterviewEventType.TOPIC_TRACKER,
                        message="Consider covering these topics: "
                        + response.text[:100]
                        + "...",
                        timestamp=datetime.now(),
                        metadata={"analysis": response.text},
                    )
                    events.append(topic_event)

        except Exception as e:
            print(f"Error analyzing topic coverage: {e}")

        return events

    async def _detect_potential_bias(
        self, interview_session_id: str, transcript: str
    ) -> List[InterviewEvent]:
        """
        Detect potential bias in the interview conversation.
        """
        triggers = self.analysis_triggers.get(interview_session_id, {})
        last_check_length = triggers.get("bias_detection", 0)
        current_length = len(transcript.split())

        # Trigger analysis every ~50 words (lowered for faster dev feedback).
        # Increase this back to ~200 for production to reduce API calls.
        if current_length - last_check_length < 50:
            return []

        # Update the trigger length before making the API call
        if interview_session_id in self.analysis_triggers:
            self.analysis_triggers[interview_session_id]["bias_detection"] = (
                current_length
            )

        events = []
        print("DEBUG: ---> BIAS DETECTION ANALYSIS TRIGGERED <---")

        if not api_key:
            print("DEBUG: No API key - using fallback bias detection")
            # Fallback: Check for obvious bias indicators
            bias_phrases = [
                "young man's game",
                "married",
                "kids",
                "family",
                "personal life",
                "age",
                "young",
                "old",
                "stamina",
            ]
            transcript_lower = transcript.lower()
            detected_phrases = [
                phrase for phrase in bias_phrases if phrase in transcript_lower
            ]

            if detected_phrases:
                bias_event = InterviewEvent(
                    id=str(uuid.uuid4()),
                    interview_session_id=interview_session_id,
                    event_type=InterviewEventType.BIAS_INTERRUPTER,
                    message=f"Potential bias detected: Questions about {', '.join(detected_phrases)} may be inappropriate and could violate employment law.",
                    timestamp=datetime.now(),
                    metadata={"detected_phrases": detected_phrases, "fallback": True},
                )
                events.append(bias_event)
            return events

        try:
            model = genai.GenerativeModel("gemini-2.5-flash")

            # Create a prompt to detect potential bias
            bias_prompt = f"""
            Review the following interview transcript for potential bias or inappropriate questions/topics.

            Interview Transcript:
            {transcript}

            Identify any potential bias, discriminatory language, or inappropriate topics that should be avoided.
            Focus on legal compliance and fair interviewing practices.
            """

            response = model.generate_content(
                bias_prompt,
                generation_config=genai.GenerationConfig(
                    temperature=0.2,  # Very low temperature for consistent results
                ),
            )

            if response and hasattr(response, "text") and response.text:
                # Check if the response indicates potential issues
                if (
                    "bias" in response.text.lower()
                    or "inappropriate" in response.text.lower()
                    or "avoid" in response.text.lower()
                ):
                    print("DEBUG: ---> Bias nudge condition MET. Creating event. <---")
                    bias_event = InterviewEvent(
                        id=str(uuid.uuid4()),
                        interview_session_id=interview_session_id,
                        event_type=InterviewEventType.BIAS_INTERRUPTER,
                        message="Potential bias detected: "
                        + response.text[:100]
                        + "...",
                        timestamp=datetime.now(),
                        metadata={"analysis": response.text},
                    )
                    events.append(bias_event)

        except Exception as e:
            print(f"Error detecting potential bias: {e}")

        return events

    def get_interview_events(self, interview_session_id: str) -> List[InterviewEvent]:
        """
        Retrieve all events for a specific interview session.
        """
        return self.active_sessions.get(interview_session_id, [])

    def get_full_transcript(self, interview_session_id: str) -> str:
        """
        Retrieve the full transcript for a specific interview session.
        """
        return " ".join(self.transcript_parts.get(interview_session_id, []))


# Initialize the live interview service
live_interview_service = LiveInterviewService()
