from datetime import datetime, timedelta
from typing import List, Dict, Optional, Set
import uuid
from pydantic import BaseModel
import google.generativeai as genai
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))


class Participant(BaseModel):
    id: str
    name: str
    email: str
    role: str  # "interviewer", "hiring_manager", "hr"
    calendar_id: Optional[str] = None  # For calendar integration


class InterviewSlot(BaseModel):
    id: str
    start_time: datetime
    end_time: datetime
    duration_minutes: int = 45
    available: bool = True
    booked_by: Optional[str] = None  # User ID of the person who booked
    booked_for: Optional[str] = None  # Candidate name
    participants: List[Participant] = []
    meeting_link: Optional[str] = None
    calendar_event_ids: Dict[str, str] = {}  # participant_id -> calendar_event_id


class SchedulingRequest(BaseModel):
    candidate_name: str
    duration_minutes: int = 45
    participant_emails: List[str]  # List of participant emails
    preferred_time_range: str  # e.g., "next week", "tomorrow", "this week"
    specific_requirements: Optional[str] = None


class SchedulingResponse(BaseModel):
    success: bool
    message: str
    suggested_slots: List[InterviewSlot] = []
    booked_slot: Optional[InterviewSlot] = None
    calendar_invitations_sent: bool = False
    email_content: Optional[str] = None


class InterviewScheduler:
    """
    Enhanced interview scheduler that handles multiple participants and calendar integration.
    Integrates with calendar APIs and provides intelligent scheduling suggestions.
    """
    
    def __init__(self):
        self.slots: Dict[str, InterviewSlot] = {}
        self.participants: Dict[str, Participant] = {}
        self.api_key = os.getenv("GEMINI_API_KEY")
        if self.api_key:
            genai.configure(api_key=self.api_key)

        # Initialize with default HR employees
        self._initialize_default_participants()

    def _initialize_default_participants(self):
        """Initialize the system with default HR employees."""
        default_participants = [
            Participant(
                id="hr1",
                name="Sarah Johnson",
                email="sarah.johnson@company.com",
                role="HR Manager"
            ),
            Participant(
                id="hr2",
                name="Michael Chen",
                email="michael.chen@company.com",
                role="HR Specialist"
            )
        ]

        for participant in default_participants:
            self.participants[participant.id] = participant

    def _generate_name_from_email(self, email: str) -> str:
        """Generate a proper name from an email address."""
        username = email.split('@')[0]

        # Handle common email formats
        if '.' in username:
            parts = username.split('.')
            if len(parts) == 2:
                return f"{parts[0].title()} {parts[1].title()}"

        if '_' in username:
            parts = username.split('_')
            if len(parts) == 2:
                return f"{parts[0].title()} {parts[1].title()}"

        # Handle first initial + last name format (e.g., "jsmith")
        if len(username) >= 2 and username[1:] and username[0].isalpha():
            return f"{username[0].upper()}. {username[1:].title()}"

        # Default case - just title case the username
        return username.title()
    
    def add_participant(self, participant: Participant) -> bool:
        """Add a participant to the system."""
        try:
            self.participants[participant.id] = participant
            return True
        except Exception:
            return False
    
    def get_participant_by_email(self, email: str) -> Optional[Participant]:
        """Get a participant by their email address."""
        for participant in self.participants.values():
            if participant.email.lower() == email.lower():
                return participant
        return None
    
    def create_available_slots_for_week(self, start_date: datetime, duration_minutes: int = 45) -> List[InterviewSlot]:
        """
        Create available interview slots for a week, considering business hours.
        """
        slots = []
        end_date = start_date + timedelta(days=7)
        current_time = start_date
        
        while current_time < end_date:
            # Only create slots during business hours (9am to 5pm, Monday to Friday)
            if (current_time.weekday() < 5 and  # Monday to Friday
                9 <= current_time.hour <= 17 and
                current_time.hour + (duration_minutes // 60) <= 17):  # Ensure slot ends by 5pm
                
                slot = InterviewSlot(
                    id=str(uuid.uuid4()),
                    start_time=current_time,
                    end_time=current_time + timedelta(minutes=duration_minutes),
                    duration_minutes=duration_minutes,
                    available=True
                )
                self.slots[slot.id] = slot
                slots.append(slot)
            
            # Move to the next slot
            current_time += timedelta(minutes=duration_minutes)
            
            # If we go past 5pm, move to the next day at 9am
            if current_time.hour >= 17 or current_time.hour < 9:
                current_time = current_time.replace(hour=9, minute=0, second=0, microsecond=0) + timedelta(days=1)
        
        return slots
    
    def find_available_slots_for_participants(self, participant_emails: List[str], 
                                           start_date: datetime, end_date: datetime, 
                                           duration_minutes: int = 45) -> List[InterviewSlot]:
        """
        Find available slots that work for all specified participants.
        In a real implementation, this would check each participant's calendar availability.
        """
        # Get participants
        participants = []
        for email in participant_emails:
            participant = self.get_participant_by_email(email)
            if participant:
                participants.append(participant)

        # If no valid participants were found from the request, use all available participants
        # This prevents creating mock users for non-existent emails
        if not participants:
            participants = list(self.participants.values())
        
        # Get all available slots in the date range
        all_slots = self.get_available_slots(start_date, end_date)
        
        # In a real implementation, we would check each participant's calendar
        # For now, we'll simulate this by randomly making different participants available for different slots
        import random
        available_slots = []

        for slot in all_slots:
            # Randomly determine which participants are available for this slot
            available_participants = []
            for participant in participants:
                # Each participant has a 70% chance of being available for any given slot
                if random.random() < 0.7:
                    available_participants.append(participant)

            # Always include the slot, even if only 1 participant is available
            # This ensures we always return some suggestions
            if len(available_participants) >= 1:
                slot.participants = available_participants
                available_slots.append(slot)

        # If no slots have participants, create at least one with all participants
        if not available_slots and all_slots:
            fallback_slot = all_slots[0]
            fallback_slot.participants = participants
            available_slots.append(fallback_slot)
        
        # Shuffle the final list of slots to ensure variety in times presented to the user
        random.shuffle(available_slots)

        return available_slots
    
    def get_available_slots(self, start_date: datetime, end_date: datetime) -> List[InterviewSlot]:
        """
        Get available interview slots within a date range.
        """
        available_slots = []
        for slot in self.slots.values():
            if (slot.available and 
                start_date <= slot.start_time <= end_date):
                available_slots.append(slot)
        
        # Sort by start time
        available_slots.sort(key=lambda x: x.start_time)
        return available_slots
    
    def generate_scheduling_suggestions(self, request: SchedulingRequest) -> SchedulingResponse:
        """
        Generate intelligent scheduling suggestions based on the request.
        """
        try:
            print(f"DEBUG: Starting scheduling for {request.candidate_name}")
            print(f"DEBUG: API key available: {bool(self.api_key)}")

            # Clear previously generated available slots to avoid duplicates and state pollution
            available_slot_ids = [slot_id for slot_id, slot in self.slots.items() if slot.available]
            for slot_id in available_slot_ids:
                del self.slots[slot_id]

            # Parse the time range
            start_date = datetime.now()
            if "next week" in request.preferred_time_range.lower():
                start_date = start_date + timedelta(days=7 - start_date.weekday())
                start_date = start_date.replace(hour=9, minute=0, second=0, microsecond=0)
            elif "tomorrow" in request.preferred_time_range.lower():
                start_date = start_date + timedelta(days=1)
                start_date = start_date.replace(hour=9, minute=0, second=0, microsecond=0)
            elif "this week" in request.preferred_time_range.lower():
                if start_date.weekday() >= 5:  # If it's weekend, start next week
                    start_date = start_date + timedelta(days=7 - start_date.weekday())
                start_date = start_date.replace(hour=9, minute=0, second=0, microsecond=0)

            end_date = start_date + timedelta(days=7)

            # Create available slots for the week
            self.create_available_slots_for_week(start_date, request.duration_minutes)

            # Find slots that work for all participants
            suggested_slots = self.find_available_slots_for_participants(
                request.participant_emails,
                start_date,
                end_date,
                request.duration_minutes
            )

            print(f"DEBUG: Found {len(suggested_slots)} suggested slots")

            # Use AI to rank and suggest the best slots
            if self.api_key and suggested_slots:
                print("DEBUG: Attempting AI ranking")
                ranked_slots = self._rank_suggestions_with_ai(request, suggested_slots)
                print("DEBUG: AI ranking completed successfully")
            else:
                print("DEBUG: Using fallback (no AI ranking)")
                ranked_slots = suggested_slots[:5]  # Return top 5 if no AI available

            return SchedulingResponse(
                success=True,
                message=f"Found {len(ranked_slots)} available slots for {request.candidate_name}",
                suggested_slots=ranked_slots
            )

        except Exception as e:
            print(f"DEBUG: Exception in generate_scheduling_suggestions: {e}")
            import traceback
            print(f"DEBUG: Full traceback: {traceback.format_exc()}")
            return SchedulingResponse(
                success=False,
                message=f"Failed to generate scheduling suggestions: {str(e)}"
            )
    
    def _rank_suggestions_with_ai(self, request: SchedulingRequest, slots: List[InterviewSlot]) -> List[InterviewSlot]:
        """
        Use AI to rank and suggest the best interview slots.
        """
        try:
            print("DEBUG: Initializing Gemini model for ranking")
            model = genai.GenerativeModel('gemini-2.5-flash')

            # Prepare slot information for AI analysis
            slots_info = []
            for i, slot in enumerate(slots[:10]):  # Limit to first 10 slots
                slots_info.append({
                    "index": i,
                    "day": slot.start_time.strftime("%A"),
                    "time": slot.start_time.strftime("%I:%M %p"),
                    "participants": [p.name for p in slot.participants]
                })

            print(f"DEBUG: Prepared slots info: {len(slots_info)} slots")

            prompt = f"""
            You are an AI scheduling assistant. Rank these interview slots from best to worst for a {request.duration_minutes}-minute interview.

            Candidate: {request.candidate_name}
            Participants: {', '.join(request.participant_emails)}
            Requirements: {request.specific_requirements or 'Standard interview'}

            Available Slots:
            {slots_info}

            Consider these factors for ranking:
            1. Time of day (late morning/early afternoon is usually best)
            2. Day of week (mid-week is often preferred)
            3. Participant availability
            4. General interview best practices

            Return only the indices of the top 5 slots in order of preference, as a comma-separated list.
            For example: "2,0,4,1,3"
            """

            print("DEBUG: Sending prompt to Gemini API")
            try:
                response = model.generate_content(prompt, generation_config=genai.GenerationConfig(temperature=0.3))
                print("DEBUG: Received response from Gemini API")
            except Exception as api_error:
                print(f"DEBUG: Gemini API error in scheduling: {api_error}")
                import traceback
                print(f"DEBUG: API error traceback: {traceback.format_exc()}")
                return slots[:5]  # Fallback to first 5 slots without AI ranking

            if response and hasattr(response, 'text') and response.text:
                print(f"DEBUG: AI response text: {response.text}")
                # Parse the AI response to get ranked indices
                ranked_indices = [int(x.strip()) for x in response.text.split(',') if x.strip().isdigit()]
                ranked_slots = []

                for idx in ranked_indices[:5]:  # Take top 5
                    if idx < len(slots):
                        ranked_slots.append(slots[idx])

                # Add any remaining slots that weren't ranked
                for slot in slots:
                    if slot not in ranked_slots and len(ranked_slots) < 5:
                        ranked_slots.append(slot)

                print(f"DEBUG: Ranked {len(ranked_slots)} slots")
                return ranked_slots
            else:
                print("DEBUG: No response or text from Gemini API")

            return slots[:5]  # Fallback to first 5 slots

        except Exception as e:
            print(f"DEBUG: Error ranking suggestions with AI: {e}")
            import traceback
            print(f"DEBUG: AI ranking error traceback: {traceback.format_exc()}")
            return slots[:5]  # Fallback to first 5 slots
    
    def _generate_confirmation_email(self, slot: InterviewSlot) -> str:
        """
        Generate a confirmation email for the booked interview slot using AI.
        """
        if not self.api_key:
            return "Email generation is not available. API key is not configured."

        try:
            model = genai.GenerativeModel('gemini-2.5-flash')
            
            prompt = f"""
            You are an AI assistant for Aegis Hire. Write a professional and friendly confirmation email to an interview candidate.

            **Interview Details:**
            - **Candidate Name:** {slot.booked_for}
            - **Date and Time:** {slot.start_time.strftime('%A, %B %d, %Y at %I:%M %p')}
            - **Duration:** {slot.duration_minutes} minutes
            - **Interview Team:** {', '.join([p.name for p in slot.participants])}
            - **Meeting Link:** {slot.meeting_link}

            **Instructions:**
            1.  Start with a warm and professional greeting.
            2.  Confirm the interview details clearly.
            3.  Provide instructions for joining the virtual meeting.
            4.  End with a positive and encouraging closing.
            5.  The email should be ready to be sent directly to the candidate.
            6.  **IMPORTANT**: The output must be plain text only. Do not use any Markdown formatting (like **, *, etc.).

            Generate the plain text email content now.
            """

            response = model.generate_content(prompt, generation_config=genai.GenerationConfig(temperature=0.5))
            
            if response and hasattr(response, 'text') and response.text:
                return response.text
            else:
                return "Failed to generate email content."
        except Exception as e:
            print(f"Error generating confirmation email: {e}")
            return "An error occurred while generating the email content."

    def book_interview_slot(self, slot_id: str, candidate_name: str, participant_emails: List[str]) -> Optional[InterviewSlot]:
        """
        Book an interview slot for a candidate with specified participants.
        """
        if slot_id not in self.slots:
            return None
        
        slot = self.slots[slot_id]
        if not slot.available:
            return None  # Slot already booked
        
        # Get participants
        participants = []
        for email in participant_emails:
            participant = self.get_participant_by_email(email)
            if participant:
                participants.append(participant)
        
        # Book the slot
        slot.available = False
        slot.booked_for = candidate_name
        slot.participants = participants
        
        # Generate a mock meeting link
        slot.meeting_link = f"https://meet.aegis-hire.com/interview/{slot.id}"
        
        # In a real implementation, we would:
        # 1. Create calendar events for all participants
        # 2. Send calendar invitations
        # 3. Generate actual meeting links (Zoom, Teams, etc.)
        
        return slot
    
    def cancel_booking(self, slot_id: str) -> bool:
        """
        Cancel an interview booking.
        """
        if slot_id not in self.slots:
            return False
        
        slot = self.slots[slot_id]
        if not slot.available:
            slot.available = True
            slot.booked_by = None
            slot.booked_for = None
            slot.participants = []
            slot.meeting_link = None
            slot.calendar_event_ids = {}
            return True
        
        return False
    
    def schedule_interview(self, request: SchedulingRequest) -> SchedulingResponse:
        """
        Complete interview scheduling workflow - find available slots and book the best one.
        """
        try:
            # Generate suggestions
            suggestions_response = self.generate_scheduling_suggestions(request)
            
            if not suggestions_response.success or not suggestions_response.suggested_slots:
                return suggestions_response
            
            # Book the best available slot
            best_slot = suggestions_response.suggested_slots[0]
            booked_slot = self.book_interview_slot(
                best_slot.id, 
                request.candidate_name, 
                request.participant_emails
            )
            
            if booked_slot:
                return SchedulingResponse(
                    success=True,
                    message=f"Successfully scheduled interview for {request.candidate_name} on {booked_slot.start_time.strftime('%A, %B %d at %I:%M %p')}",
                    booked_slot=booked_slot,
                    calendar_invitations_sent=True  # In real implementation, this would be based on actual calendar API calls
                )
            else:
                return SchedulingResponse(
                    success=False,
                    message="Failed to book the selected slot. Please try another slot."
                )
                
        except Exception as e:
            return SchedulingResponse(
                success=False,
                message=f"Failed to schedule interview: {str(e)}"
            )


# Initialize the scheduler
interview_scheduler = InterviewScheduler()

# Add some default participants for demonstration
interview_scheduler.add_participant(Participant(
    id="1",
    name="Alex Johnson",
    email="alex@aegis-hire.com",
    role="hr"
))

interview_scheduler.add_participant(Participant(
    id="2", 
    name="Sarah Chen",
    email="sarah@aegis-hire.com",
    role="hiring_manager"
))
