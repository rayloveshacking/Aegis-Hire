"use client";

import React, { ChangeEvent, useState } from "react";
import ReactMarkdown from "react-markdown";

type ParsedResume = {
  raw_text: string;
  [key: string]: unknown;
};

type ParsedResumeByFile = Record<string, ParsedResume>;

type ScreeningResult = {
  candidate: string;
  rank: number;
  score?: number;
  justification: string[];
  summary: string;
  details?: string;
  [key: string]: unknown;
};

type JobDescriptionResponse = {
  job_description: string;
  error?: string;
};

type ParseResumeResponse = {
  parsed_resume: ParsedResume;
  error?: string;
};

type ScreenApplicantsResponse = {
  screening_results: ScreeningResult[];
  error?: string;
};

type Participant = {
  id: string;
  name: string;
  email: string;
  role: string;
  calendar_id?: string;
};

type InterviewSlot = {
  id: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  available: boolean;
  booked_by?: string;
  booked_for?: string;
  participants: Participant[];
  meeting_link?: string;
  calendar_event_ids: Record<string, string>;
};

type SchedulingRequest = {
  candidate_name: string;
  duration_minutes: number;
  participant_emails: string[];
  preferred_time_range: string;
  specific_requirements?: string;
};

type SchedulingResponse = {
  success: boolean;
  message: string;
  suggested_slots: InterviewSlot[];
  booked_slot?: InterviewSlot;
  calendar_invitations_sent: boolean;
};

type OnboardingPlan = {
  candidate_name?: string;
  start_date?: string;
  job_title?: string;
  welcome_message?: string;
  first_day_schedule?: string;
  first_week_goals?: string[];
  first_month_goals?: string[];
  tasks?: {
    id: string;
    title: string;
    description?: string;
    due_date?: string;
    assigned_to?: string;
  }[];
  resources?: {
    id: string;
    title: string;
    url?: string;
    category?: string;
    description?: string;
  }[];
  manager_name?: string;
};

const BACKEND_INFO = {
  baseUrl: "http://127.0.0.1:8000",
  startCommand: "uvicorn main:app --reload",
};

const buildErrorMessage = (error: unknown, prefix: string) => {
  if (error instanceof Error) {
    if (/failed to fetch/i.test(error.message) || error.name === "TypeError") {
      return `${prefix}: Unable to reach the backend service. Ensure the FastAPI server is running at ${BACKEND_INFO.baseUrl} (for example, run \`${BACKEND_INFO.startCommand}\` from the backend folder).`;
    }

    return `${prefix}: ${error.message}`;
  }

  return `${prefix}: Unknown error`;
};

export default function Home() {
  // Debug: Log component mount
  console.log("Home component mounted");
  console.log("Resume upload workflow initialized");

  // Job description generation state
  const [jobPrompt, setJobPrompt] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [jobLoading, setJobLoading] = useState(false);

  // Candidate screening state
  const [screeningJobDescription, setScreeningJobDescription] = useState("");
  const [resumeFiles, setResumeFiles] = useState<File[]>([]);
  const [parsedResumes, setParsedResumes] = useState<ParsedResumeByFile>({});
  const [screeningResults, setScreeningResults] = useState<ScreeningResult[]>(
    [],
  );
  const [screeningLoading, setScreeningLoading] = useState(false);
  const [parsing, setParsing] = useState(false);

  // Scheduling state
  const [schedulingCandidateName, setSchedulingCandidateName] =
    useState("Dennis");
  const [schedulingParticipantEmails, setSchedulingParticipantEmails] =
    useState(
      "sarah.johnson@company.com, michael.chen@company.com, alex@aegis-hire.com, sarah@aegis-hire.com",
    );
  const [schedulingTimeRange, setSchedulingTimeRange] = useState("next week");
  const [schedulingRequirements, setSchedulingRequirements] = useState("");
  const [schedulingLoading, setSchedulingLoading] = useState(false);
  const [schedulingSuggestions, setSchedulingSuggestions] = useState<
    InterviewSlot[]
  >([]);
  const [scheduledInterview, setScheduledInterview] =
    useState<InterviewSlot | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [emailContent, setEmailContent] = useState("");
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [intervieweeEmail, setIntervieweeEmail] = useState("");
  const [emailSending, setEmailSending] = useState(false);

  // General state
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [activeTab, setActiveTab] = useState("job-description"); // "job-description", "screening", or "scheduling"

  // Onboarding state (Phase 4)
  const [onboardingCandidateName, setOnboardingCandidateName] = useState("");
  const [onboardingJobTitle, setOnboardingJobTitle] = useState("");
  const [onboardingStartDate, setOnboardingStartDate] = useState("");
  const [onboardingManagerName, setOnboardingManagerName] = useState("");
  const [onboardingTeamMembers, setOnboardingTeamMembers] = useState("");
  const [onboardingJobDescription, setOnboardingJobDescription] = useState("");
  const [onboardingInterviewFeedback, setOnboardingInterviewFeedback] =
    useState("");
  const [generatedOnboardingPlan, setGeneratedOnboardingPlan] =
    useState<OnboardingPlan | null>(null);
  const [onboardingEmail, setOnboardingEmail] = useState("");
  const [onboardingLoading, setOnboardingLoading] = useState(false);
  const [onboardingStatus, setOnboardingStatus] = useState("");

  const handleGenerateDescription = async () => {
    if (!jobPrompt) {
      setError("Please enter a prompt for the job description.");
      return;
    }
    setJobLoading(true);
    setError("");
    setJobDescription("");

    try {
      const response = await fetch(
        `${BACKEND_INFO.baseUrl}/api/generate-job-description`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ prompt: jobPrompt }),
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: JobDescriptionResponse = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setJobDescription(data.job_description);
    } catch (caughtError: unknown) {
      setError(
        buildErrorMessage(caughtError, "Failed to generate job description"),
      );
    } finally {
      setJobLoading(false);
    }
  };

  const parseResumeFile = async (file: File): Promise<ParsedResume> => {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      throw new Error("Only PDF files are supported.");
    }

    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${BACKEND_INFO.baseUrl}/api/parse-resume`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: ParseResumeResponse = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    return data.parsed_resume;
  };

  const handleParseResumes = async () => {
    if (resumeFiles.length === 0) {
      setError("Please select at least one PDF file to upload.");
      return;
    }

    setParsing(true);
    setError("");

    try {
      const parsedDataByFile: ParsedResumeByFile = {};

      for (const file of resumeFiles) {
        if (parsedResumes[file.name]) {
          parsedDataByFile[file.name] = parsedResumes[file.name];
          continue;
        }

        const parsedData = await parseResumeFile(file);
        parsedDataByFile[file.name] = parsedData;
      }

      setParsedResumes((prev) => ({ ...prev, ...parsedDataByFile }));
      setScreeningResults([]);
    } catch (caughtError: unknown) {
      setError(buildErrorMessage(caughtError, "Failed to parse resume"));
    } finally {
      setParsing(false);
    }
  };

  const handleResumeSelection = (event: ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(event.target.files ?? []);

    if (newFiles.some((file) => !file.name.toLowerCase().endsWith(".pdf"))) {
      setError("Only PDF files are supported.");
      event.target.value = "";
      return;
    }

    // Check for duplicate files by name
    const duplicateFiles = newFiles.filter((newFile) =>
      resumeFiles.some((existingFile) => existingFile.name === newFile.name),
    );

    if (duplicateFiles.length > 0) {
      setError(
        `Duplicate files detected: ${duplicateFiles.map((f) => f.name).join(", ")}. These files were not added again.`,
      );
      // Filter out duplicates from new files
      const uniqueNewFiles = newFiles.filter(
        (newFile) =>
          !resumeFiles.some(
            (existingFile) => existingFile.name === newFile.name,
          ),
      );

      if (uniqueNewFiles.length === 0) {
        event.target.value = "";
        return;
      }

      setError("");
      setResumeFiles((prev) => [...prev, ...uniqueNewFiles]);
    } else {
      setError("");
      setResumeFiles((prev) => [...prev, ...newFiles]);
    }

    // Only reset screening results since we're adding new files
    setScreeningResults([]);
    event.target.value = "";
  };

  const handleRemoveResume = (fileName: string) => {
    setResumeFiles((prev) => prev.filter((file) => file.name !== fileName));
    setParsedResumes((prev) => {
      const newParsed = { ...prev };
      delete newParsed[fileName];
      return newParsed;
    });
    setScreeningResults([]);
  };

  const handleClearAllResumes = () => {
    setResumeFiles([]);
    setParsedResumes({});
    setScreeningResults([]);
  };

  const handleScreenApplicants = async () => {
    if (!screeningJobDescription) {
      setError("Please provide a job description.");
      return;
    }

    if (resumeFiles.length === 0) {
      setError("Please upload at least one resume PDF before screening.");
      return;
    }

    setScreeningLoading(true);
    setError("");
    setScreeningResults([]);

    try {
      const newlyParsed: ParsedResumeByFile = {};

      for (const file of resumeFiles) {
        if (!parsedResumes[file.name]) {
          newlyParsed[file.name] = await parseResumeFile(file);
        }
      }

      if (Object.keys(newlyParsed).length > 0) {
        setParsedResumes((prev) => ({ ...prev, ...newlyParsed }));
      }

      const resolvedParsedResumes = { ...parsedResumes, ...newlyParsed };

      const resumeTexts = resumeFiles
        .map((file) => resolvedParsedResumes[file.name]?.raw_text)
        .filter((text): text is string => Boolean(text));

      // Extract names from parsed resumes
      const resumeNames = resumeFiles
        .map((file) => resolvedParsedResumes[file.name]?.candidate_name)
        .filter((name): name is string => Boolean(name));

      const response = await fetch(
        `${BACKEND_INFO.baseUrl}/api/screen-applicants`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            job_description: screeningJobDescription,
            resumes: resumeTexts,
            resume_names: resumeNames,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: ScreenApplicantsResponse = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setScreeningResults(data.screening_results);
    } catch (caughtError: unknown) {
      setError(buildErrorMessage(caughtError, "Failed to screen applicants"));
    } finally {
      setScreeningLoading(false);
    }
  };

  // Scheduling handlers
  const handleGenerateSchedulingSuggestions = async () => {
    if (!schedulingCandidateName) {
      setError("Please enter the candidate name.");
      return;
    }

    if (!schedulingParticipantEmails) {
      setError("Please enter participant email addresses.");
      return;
    }

    setSchedulingLoading(true);
    setError("");
    setSchedulingSuggestions([]);
    setScheduledInterview(null);

    try {
      const participantEmails = schedulingParticipantEmails
        .split(",")
        .map((email) => email.trim())
        .filter((email) => email);

      const request: SchedulingRequest = {
        candidate_name: schedulingCandidateName,
        duration_minutes: 45,
        participant_emails: participantEmails,
        preferred_time_range: schedulingTimeRange,
        specific_requirements: schedulingRequirements || undefined,
      };

      console.log("Making scheduling request:", request);
      const response = await fetch(
        `${BACKEND_INFO.baseUrl}/api/scheduling/generate-suggestions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(request),
        },
      );

      console.log("Response status:", response.status);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: SchedulingResponse = await response.json();
      console.log("Response data:", data);

      if (!data.success) {
        throw new Error(data.message);
      }

      setSchedulingSuggestions(data.suggested_slots);
      console.log("Set suggestions:", data.suggested_slots);
    } catch (caughtError: unknown) {
      console.error("Scheduling error:", caughtError);
      setError(
        buildErrorMessage(
          caughtError,
          "Failed to generate scheduling suggestions",
        ),
      );
    } finally {
      setSchedulingLoading(false);
    }
  };

  const handleScheduleInterview = async () => {
    if (!schedulingCandidateName) {
      setError("Please enter the candidate name.");
      return;
    }

    if (!schedulingParticipantEmails) {
      setError("Please enter participant email addresses.");
      return;
    }

    setSchedulingLoading(true);
    setError("");
    setSchedulingSuggestions([]);
    setScheduledInterview(null);

    try {
      const participantEmails = schedulingParticipantEmails
        .split(",")
        .map((email) => email.trim())
        .filter((email) => email);

      const request: SchedulingRequest = {
        candidate_name: schedulingCandidateName,
        duration_minutes: 45,
        participant_emails: participantEmails,
        preferred_time_range: schedulingTimeRange,
        specific_requirements: schedulingRequirements || undefined,
      };

      const response = await fetch(
        `${BACKEND_INFO.baseUrl}/api/scheduling/schedule-interview`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(request),
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: SchedulingResponse = await response.json();

      if (!data.success) {
        throw new Error(data.message);
      }

      setScheduledInterview(data.booked_slot || null);
    } catch (caughtError: unknown) {
      setError(buildErrorMessage(caughtError, "Failed to schedule interview"));
    } finally {
      setSchedulingLoading(false);
    }
  };

  const handleBookSpecificSlot = async (slot: InterviewSlot) => {
    if (!schedulingCandidateName) {
      setError("Please enter the candidate name.");
      return;
    }

    try {
      const participantEmails = schedulingParticipantEmails
        .split(",")
        .map((email) => email.trim())
        .filter((email) => email);

      const response = await fetch(
        `${BACKEND_INFO.baseUrl}/api/scheduling/book-specific-slot`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            slot_id: slot.id,
            candidate_name: schedulingCandidateName,
            participant_emails: participantEmails,
            start_time: slot.start_time,
            duration_minutes: slot.duration_minutes,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error);
      }

      setScheduledInterview(data.slot);
      setSchedulingSuggestions([]);
      setEmailContent(data.email_content);
      setIsEmailModalOpen(true);
    } catch (caughtError: unknown) {
      setError(buildErrorMessage(caughtError, "Failed to book interview slot"));
    }
  };

  const handleSendEmail = async () => {
    if (!intervieweeEmail) {
      setError("Please enter the interviewee's email address.");
      return;
    }

    setEmailSending(true);
    setError("");
    setSuccessMessage("");

    try {
      console.log("📧 Sending email to:", intervieweeEmail);
      
      const response = await fetch(`${BACKEND_INFO.baseUrl}/api/send-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to_email: intervieweeEmail,
          subject: "Interview Confirmation - Aegis Hire",
          body: emailContent,
        }),
      });

      console.log("📧 Response status:", response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("📧 Response data:", data);

      if (!data.success) {
        throw new Error(data.message || "Failed to send email");
      }

      setSuccessMessage(`✅ Email sent successfully to ${intervieweeEmail}!`);
      setTimeout(() => {
        setIsEmailModalOpen(false);
        setIntervieweeEmail("");
        setSuccessMessage("");
      }, 2000);
    } catch (caughtError: unknown) {
      console.error("❌ Email error:", caughtError);
      setError(buildErrorMessage(caughtError, "Failed to send email"));
    } finally {
      setEmailSending(false);
    }
  };

  const handleLoadParticipants = async () => {
    try {
      const response = await fetch(
        `${BACKEND_INFO.baseUrl}/api/scheduling/participants`,
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const loadedParticipants = data.participants || [];

      // Add default HR employees if they don't exist
      const hrEmployees = [
        {
          id: "hr1",
          name: "Sarah Johnson",
          email: "sarah.johnson@company.com",
          role: "HR Manager",
        },
        {
          id: "hr2",
          name: "Michael Chen",
          email: "michael.chen@company.com",
          role: "HR Specialist",
        },
      ];

      // Combine loaded participants with default HR employees (avoid duplicates)
      const allParticipants = [...loadedParticipants];
      hrEmployees.forEach((hrEmp) => {
        if (!allParticipants.some((p) => p.email === hrEmp.email)) {
          allParticipants.push(hrEmp);
        }
      });

      setParticipants(allParticipants);
    } catch (caughtError: unknown) {
      console.error("Failed to load participants:", caughtError);
      // If API fails, still show default HR employees
      setParticipants([
        {
          id: "hr1",
          name: "Sarah Johnson",
          email: "sarah.johnson@company.com",
          role: "HR Manager",
        },
        {
          id: "hr2",
          name: "Michael Chen",
          email: "michael.chen@company.com",
          role: "HR Specialist",
        },
      ]);
    }
  };

  // Load participants when component mounts
  React.useEffect(() => {
    // handleLoadParticipants(); // Temporarily disabled to prevent 404 error on page load.
  }, []);

  // --- Onboarding handlers (Phase 4) ---
  const handleGenerateOnboardingPlan = async () => {
    setOnboardingLoading(true);
    setOnboardingStatus("Generating onboarding plan...");
    setGeneratedOnboardingPlan(null);

    try {
      const response = await fetch(
        `${BACKEND_INFO.baseUrl}/api/onboarding-plan/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            candidate_name: onboardingCandidateName,
            job_title: onboardingJobTitle,
            start_date: onboardingStartDate,
            manager_name: onboardingManagerName,
            team_members: onboardingTeamMembers
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
            job_description: onboardingJobDescription,
            interview_feedback: onboardingInterviewFeedback,
          }),
        },
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          data.detail || data.error || "Failed to generate onboarding plan",
        );
      }

      setGeneratedOnboardingPlan(data.plan || null);
      setOnboardingStatus("Onboarding plan generated.");
    } catch (err: unknown) {
      setOnboardingStatus(
        err instanceof Error
          ? `Error: ${err.message}`
          : `Error: ${String(err)}`,
      );
    } finally {
      setOnboardingLoading(false);
    }
  };

  const handleSendWelcomeEmail = async () => {
    if (!generatedOnboardingPlan) {
      setOnboardingStatus("Please generate an onboarding plan first.");
      return;
    }
    if (!onboardingEmail) {
      setOnboardingStatus(
        "Please enter an email address to send the welcome email.",
      );
      return;
    }

    setOnboardingLoading(true);
    setOnboardingStatus(`Sending welcome email to ${onboardingEmail}...`);

    try {
      const subject = `Welcome ${generatedOnboardingPlan.candidate_name} to the team`;
      const body = `Hello,

Please join me in welcoming ${generatedOnboardingPlan.candidate_name}, who will start on ${generatedOnboardingPlan.start_date} as ${generatedOnboardingPlan.job_title}.

First day schedule:
${generatedOnboardingPlan.first_day_schedule || "Please refer to the onboarding plan."}

Key first-week goals:
${(generatedOnboardingPlan.first_week_goals || []).join("\n")}

Best regards,
${generatedOnboardingPlan.manager_name || "Hiring Team"}`;

      const response = await fetch(`${BACKEND_INFO.baseUrl}/api/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to_email: onboardingEmail,
          subject,
          body,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || data.message || "Failed to send email");
      }

      setOnboardingStatus("Welcome email sent successfully.");
    } catch (err: unknown) {
      setOnboardingStatus(
        err instanceof Error
          ? `Error: ${err.message}`
          : `Error: ${String(err)}`,
      );
    } finally {
      setOnboardingLoading(false);
    }
  };

  const formatDateTime = (dateTimeString: string) => {
    const date = new Date(dateTimeString);
    return date.toLocaleString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 font-sans">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
        <header className="text-center mb-8 sm:mb-12">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-4">
            🎯 Aegis Hire
          </h1>
          <p className="text-gray-600 text-lg sm:text-xl max-w-3xl mx-auto leading-relaxed">
            Your AI-powered recruitment and onboarding assistant for smarter
            hiring decisions.
          </p>
        </header>

        {/* Tab Navigation */}
        <div className="flex flex-wrap justify-center bg-white rounded-2xl shadow-lg p-2 mb-8 sm:mb-12 border border-gray-100">
          <button
            className={`py-3 px-4 sm:px-6 font-semibold text-sm sm:text-base rounded-xl transition-all duration-200 m-1 ${
              activeTab === "job-description"
                ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md transform scale-105"
                : "text-gray-600 hover:text-gray-800 hover:bg-gray-50"
            }`}
            onClick={() => setActiveTab("job-description")}
          >
            📄 Job Description
          </button>
          <button
            className={`py-3 px-4 sm:px-6 font-semibold text-sm sm:text-base rounded-xl transition-all duration-200 m-1 ${
              activeTab === "screening"
                ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-md transform scale-105"
                : "text-gray-600 hover:text-gray-800 hover:bg-gray-50"
            }`}
            onClick={() => setActiveTab("screening")}
          >
            🔍 Screen Applicants
          </button>
          <button
            className={`py-3 px-4 sm:px-6 font-semibold text-sm sm:text-base rounded-xl transition-all duration-200 m-1 ${
              activeTab === "scheduling"
                ? "bg-gradient-to-r from-purple-500 to-violet-600 text-white shadow-md transform scale-105"
                : "text-gray-600 hover:text-gray-800 hover:bg-gray-50"
            }`}
            onClick={() => setActiveTab("scheduling")}
          >
            📅 Schedule Interview
          </button>
          <button
            className={`py-3 px-4 sm:px-6 font-semibold text-sm sm:text-base rounded-xl transition-all duration-200 m-1 ${
              activeTab === "interview-copilot"
                ? "bg-gradient-to-r from-pink-500 to-rose-600 text-white shadow-md transform scale-105"
                : "text-gray-600 hover:text-gray-800 hover:bg-gray-50"
            }`}
            onClick={() => setActiveTab("interview-copilot")}
          >
            🤖 Interview Copilot
          </button>
        </div>

        {/* Job Description Tab */}
        {/* Content for each tab */}
        {activeTab === "job-description" && (
          <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-xl border border-gray-100 hover:shadow-2xl transition-shadow duration-300">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                <span className="text-white text-xl">📄</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Generate a Job Description
              </h2>
            </div>
            <p className="text-gray-600 mb-8 text-base sm:text-lg leading-relaxed">
              Enter a prompt to have the AI draft a comprehensive and inclusive
              job description. For example:{" "}
              <span className="italic">
                "a Senior Software Engineer specializing in cloud
                infrastructure."
              </span>
            </p>

            <textarea
              className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-gray-50 transition-colors duration-200 text-base"
              rows={5}
              value={jobPrompt}
              onChange={(e) => setJobPrompt(e.target.value)}
              placeholder="Enter your prompt here..."
            />

            <button
              onClick={handleGenerateDescription}
              disabled={jobLoading}
              className="mt-6 w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold py-4 px-6 rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-400 transform hover:scale-[1.02] transition-all duration-200 shadow-lg text-lg"
            >
              {jobLoading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                  Generating...
                </div>
              ) : (
                "🚀 Generate Job Description"
              )}
            </button>

            {error && activeTab === "job-description" && (
              <div className="mt-6 p-4 bg-red-50 border-l-4 border-red-400 rounded-lg">
                <div className="flex">
                  <div className="text-red-400 mr-3">⚠️</div>
                  <div>
                    <p className="text-sm text-red-700">
                      <strong>Error:</strong> {error}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {jobDescription && (
              <div className="mt-8">
                <h3 className="text-xl sm:text-2xl font-bold text-gray-800 mb-6 flex items-center">
                  <span className="mr-3">✨</span>
                  Generated Job Description:
                </h3>
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 sm:p-8 rounded-xl border border-blue-200 text-gray-900 shadow-inner">
                  <ReactMarkdown
                    components={{
                      h1: (props) => (
                        <h1
                          className="text-xl font-bold mt-4 mb-2"
                          {...props}
                        />
                      ),
                      h2: (props) => (
                        <h2
                          className="text-lg font-bold mt-4 mb-2"
                          {...props}
                        />
                      ),
                      h3: (props) => (
                        <h3 className="font-bold mt-4 mb-2" {...props} />
                      ),
                      p: (props) => <p className="mb-2" {...props} />,
                      ul: (props) => (
                        <ul className="list-disc pl-6 mb-4" {...props} />
                      ),
                      ol: (props) => (
                        <ol className="list-decimal pl-6 mb-4" {...props} />
                      ),
                      li: (props) => <li className="mb-1" {...props} />,
                      strong: (props) => (
                        <strong className="font-bold" {...props} />
                      ),
                      em: (props) => <em className="italic" {...props} />,
                      code: (props) => (
                        <code className="bg-gray-200 px-1 rounded" {...props} />
                      ),
                      pre: (props) => (
                        <pre
                          className="bg-gray-800 text-white p-4 rounded my-2 overflow-x-auto"
                          {...props}
                        />
                      ),
                    }}
                  >
                    {jobDescription}
                  </ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Screening Tab */}
        {activeTab === "screening" && (
          <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-xl border border-gray-100 hover:shadow-2xl transition-shadow duration-300">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-600 rounded-full flex items-center justify-center">
                <span className="text-white text-xl">🔍</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                Screen Applicants
              </h2>
            </div>
            <p className="text-gray-600 mb-8 text-base sm:text-lg leading-relaxed">
              Provide the job description and upload candidate PDF resumes to
              analyze their fit for the role.
            </p>

            <div className="space-y-8">
              <div>
                <label className="block text-gray-700 mb-3 font-semibold text-base flex items-center">
                  <span className="mr-2">📄</span>
                  Job Description
                </label>
                <textarea
                  className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900 bg-gray-50 transition-colors duration-200 text-base"
                  rows={5}
                  value={screeningJobDescription}
                  onChange={(e) => setScreeningJobDescription(e.target.value)}
                  placeholder="Paste the job description here..."
                />
              </div>

              <div>
                <label className="block text-gray-700 mb-3 font-semibold text-base flex items-center">
                  <span className="mr-2">📎</span>
                  Upload Resume (PDF)
                </label>
                <div className="mt-2 p-6 border-2 border-dashed border-green-400 rounded-xl bg-green-50 hover:border-green-500 transition-all duration-200 hover:bg-green-100">
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    multiple
                    onChange={handleResumeSelection}
                    className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-700 bg-white file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100 transition-all"
                  />
                  {resumeFiles.length > 0 && (
                    <div className="mt-4">
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="text-sm font-medium text-gray-700">
                          Selected Resumes ({resumeFiles.length})
                        </h4>
                        <button
                          type="button"
                          onClick={handleClearAllResumes}
                          className="text-xs text-red-600 hover:text-red-800 font-medium"
                        >
                          Clear All
                        </button>
                      </div>
                      <ul className="space-y-2">
                        {resumeFiles.map((file) => {
                          const isParsed = parsedResumes[file.name];
                          return (
                            <li
                              key={file.name}
                              className="flex items-center justify-between p-2 bg-white rounded border border-gray-200"
                            >
                              <div className="flex items-center space-x-2">
                                <span
                                  className={`text-sm ${isParsed ? "text-green-600" : "text-gray-600"}`}
                                >
                                  {isParsed ? "✅" : "📄"}
                                </span>
                                <span className="text-sm text-gray-700">
                                  {file.name}
                                </span>
                                {isParsed && (
                                  <span className="text-xs text-green-600 font-medium">
                                    Parsed
                                  </span>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveResume(file.name)}
                                className="text-xs text-red-600 hover:text-red-800 font-medium px-2 py-1 border border-red-200 rounded hover:bg-red-50"
                              >
                                Remove
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                  <p className="mt-2 text-xs text-gray-500">
                    Upload one or more PDF resumes and click &quot;Parse
                    Resumes&quot; to extract their contents.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={handleParseResumes}
                  disabled={parsing || resumeFiles.length === 0}
                  className="bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold py-4 px-6 rounded-xl hover:from-green-700 hover:to-emerald-700 disabled:from-gray-400 disabled:to-gray-400 transform hover:scale-[1.02] transition-all duration-200 shadow-lg"
                >
                  {parsing ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                      Parsing...
                    </div>
                  ) : (
                    "📄 Parse Resumes"
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleScreenApplicants}
                  disabled={screeningLoading || resumeFiles.length === 0}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold py-4 px-6 rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-400 transform hover:scale-[1.02] transition-all duration-200 shadow-lg"
                >
                  {screeningLoading ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                      Screening...
                    </div>
                  ) : (
                    "🔍 Screen Applicants"
                  )}
                </button>
              </div>

              {resumeFiles.length > 0 &&
                Object.keys(parsedResumes).length > 0 && (
                  <div className="mt-6 p-4 bg-white border border-green-200 rounded-lg shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">
                      Resumes Parsed Successfully
                    </h3>
                    <p className="text-sm text-gray-600 mb-3">
                      Resume text has been extracted and is ready for screening.
                    </p>
                    <div className="space-y-4">
                      {resumeFiles.map((file) => {
                        const parsed = parsedResumes[file.name];
                        if (!parsed) {
                          return (
                            <div
                              key={file.name}
                              className="border border-gray-200 rounded px-3 py-2 bg-gray-50"
                            >
                              <p className="text-sm text-gray-600">
                                Processing {file.name}...
                              </p>
                            </div>
                          );
                        }

                        return (
                          <details
                            key={file.name}
                            className="text-sm text-gray-700"
                          >
                            <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
                              Preview Parsed Text &mdash; {file.name}
                            </summary>
                            <pre className="mt-2 max-h-64 overflow-y-auto bg-gray-900 text-gray-100 p-3 rounded">
                              {parsed.raw_text || "No text extracted."}
                            </pre>
                          </details>
                        );
                      })}
                    </div>
                  </div>
                )}
            </div>

            {error && activeTab === "screening" && (
              <div className="mt-6 p-4 bg-red-50 border-l-4 border-red-400 rounded-lg">
                <div className="flex">
                  <div className="text-red-400 mr-3">⚠️</div>
                  <div>
                    <p className="text-sm text-red-700">
                      <strong>Error:</strong> {error}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {screeningResults.length > 0 && (
              <div className="mt-8">
                <h3 className="text-xl sm:text-2xl font-bold text-gray-800 mb-6 flex items-center">
                  <span className="mr-3">📊</span>
                  Screening Results:
                </h3>
                <div className="space-y-6">
                  {screeningResults.map((result, index) => (
                    <div
                      key={index}
                      className="bg-white border border-gray-200 rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow duration-300"
                    >
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 space-y-2 sm:space-y-0">
                        <h4 className="text-lg sm:text-xl font-bold text-gray-800 flex items-center">
                          <span className="mr-2">👤</span>
                          {result.candidate}
                          <span className="ml-2 text-sm font-normal text-gray-600">
                            (Rank: {result.rank})
                          </span>
                        </h4>
                        {result.score !== undefined && (
                          <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-4 py-2 rounded-full text-sm font-bold shadow-md">
                            Score: {result.score}/100
                          </div>
                        )}
                      </div>

                      <div className="mb-3">
                        <p className="text-gray-700">
                          <span className="font-medium">Summary:</span>{" "}
                          {result.summary}
                        </p>
                      </div>

                      {/* Show ranking justification prominently */}
                      {result.justification.some(
                        (item: string) => item === "**Ranking Justification:**",
                      ) && (
                        <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-400 rounded-lg">
                          <h5 className="font-bold text-blue-800 mb-3 flex items-center">
                            <span className="mr-2">🎯</span>
                            Why This Ranking:
                          </h5>
                          <div className="text-sm text-blue-700">
                            {(() => {
                              const rankingIndex =
                                result.justification.findIndex(
                                  (item: string) =>
                                    item === "**Ranking Justification:**",
                                );
                              if (
                                rankingIndex !== -1 &&
                                rankingIndex + 1 < result.justification.length
                              ) {
                                return (
                                  <ReactMarkdown
                                    components={{
                                      p: (props) => (
                                        <p className="mb-2" {...props} />
                                      ),
                                      strong: (props) => (
                                        <strong
                                          className="font-semibold"
                                          {...props}
                                        />
                                      ),
                                      em: (props) => (
                                        <em className="italic" {...props} />
                                      ),
                                    }}
                                  >
                                    {result.justification[rankingIndex + 1]}
                                  </ReactMarkdown>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        </div>
                      )}

                      <details className="mt-4">
                        <summary className="cursor-pointer text-sm font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 p-3 rounded-lg transition-colors">
                          📋 Show Full Analysis
                        </summary>
                        <div className="mt-3 p-4 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700">
                          <div className="mb-4">
                            <h5 className="font-medium text-gray-700 mb-2">
                              Justification:
                            </h5>
                            <div className="text-gray-600">
                              {result.justification.map(
                                (item: string, idx: number) => (
                                  <ReactMarkdown
                                    key={idx}
                                    components={{
                                      ul: (props) => (
                                        <ul
                                          className="list-disc pl-5 mb-2"
                                          {...props}
                                        />
                                      ),
                                      ol: (props) => (
                                        <ol
                                          className="list-decimal pl-5 mb-2"
                                          {...props}
                                        />
                                      ),
                                      li: (props) => (
                                        <li className="mb-1" {...props} />
                                      ),
                                      p: (props) => (
                                        <p className="mb-2" {...props} />
                                      ),
                                      strong: (props) => (
                                        <strong
                                          className="font-semibold"
                                          {...props}
                                        />
                                      ),
                                      em: (props) => (
                                        <em className="italic" {...props} />
                                      ),
                                    }}
                                  >
                                    {item}
                                  </ReactMarkdown>
                                ),
                              )}
                            </div>
                          </div>

                          {result.details && (
                            <div>
                              <h5 className="font-medium text-gray-700 mb-2">
                                Detailed Analysis:
                              </h5>
                              <ReactMarkdown
                                components={{
                                  h1: (props) => (
                                    <h1
                                      className="text-lg font-bold mt-4 mb-2"
                                      {...props}
                                    />
                                  ),
                                  h2: (props) => (
                                    <h2
                                      className="text-md font-bold mt-3 mb-2"
                                      {...props}
                                    />
                                  ),
                                  h3: (props) => (
                                    <h3
                                      className="font-bold mt-3 mb-2"
                                      {...props}
                                    />
                                  ),
                                  p: (props) => (
                                    <p className="mb-2" {...props} />
                                  ),
                                  ul: (props) => (
                                    <ul
                                      className="list-disc pl-5 mb-3"
                                      {...props}
                                    />
                                  ),
                                  ol: (props) => (
                                    <ol
                                      className="list-decimal pl-5 mb-3"
                                      {...props}
                                    />
                                  ),
                                  li: (props) => (
                                    <li className="mb-1" {...props} />
                                  ),
                                  strong: (props) => (
                                    <strong
                                      className="font-semibold"
                                      {...props}
                                    />
                                  ),
                                  em: (props) => (
                                    <em className="italic" {...props} />
                                  ),
                                  code: (props) => (
                                    <code
                                      className="bg-gray-100 px-1 rounded text-xs"
                                      {...props}
                                    />
                                  ),
                                  blockquote: (props) => (
                                    <blockquote
                                      className="border-l-4 border-gray-300 pl-4 italic"
                                      {...props}
                                    />
                                  ),
                                }}
                              >
                                {result.details}
                              </ReactMarkdown>
                            </div>
                          )}
                        </div>
                      </details>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Email Confirmation Modal */}
        {isEmailModalOpen && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
            <div className="relative mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg leading-6 font-medium text-gray-900 text-center mb-4">
                  Send Interview Confirmation
                </h3>
                
                {successMessage && (
                  <div className="mx-7 mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded-md text-center">
                    {successMessage}
                  </div>
                )}
                
                <div className="px-7 py-3">
                  <label className="block text-gray-700 mb-2 font-semibold text-sm">
                    Candidate Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="candidate@example.com"
                    value={intervieweeEmail}
                    onChange={(e) => setIntervieweeEmail(e.target.value)}
                    disabled={emailSending}
                    className="w-full p-3 border border-gray-300 rounded-md text-black focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                  <p className="mt-3 text-xs text-gray-500">
                    A confirmation email will be sent with the interview details.
                  </p>
                </div>
                <div className="items-center px-4 py-3 flex gap-3">
                  <button
                    onClick={handleSendEmail}
                    disabled={emailSending}
                    className="px-4 py-2 bg-green-500 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-300 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {emailSending ? "Sending..." : "Send Email"}
                  </button>
                  <button
                    onClick={() => {
                      setIsEmailModalOpen(false);
                      setSuccessMessage("");
                    }}
                    disabled={emailSending}
                    className="px-4 py-2 bg-gray-500 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Scheduling Tab */}
        {activeTab === "scheduling" && (
          <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-xl border border-gray-100 hover:shadow-2xl transition-shadow duration-300">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-violet-600 rounded-full flex items-center justify-center">
                <span className="text-white text-xl">📅</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-purple-600 to-violet-600 bg-clip-text text-transparent">
                Schedule Interview
              </h2>
            </div>
            <p className="text-gray-600 mb-8 text-base sm:text-lg leading-relaxed">
              Enter the details below to find available time slots and schedule
              the interview.
            </p>

            <div className="space-y-8">
              <div>
                <label className="block text-gray-700 mb-3 font-semibold text-base flex items-center">
                  <span className="mr-2">👤</span>
                  Candidate Name
                </label>
                <input
                  type="text"
                  className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900 bg-gray-50 transition-colors duration-200 text-base"
                  value={schedulingCandidateName}
                  onChange={(e) => setSchedulingCandidateName(e.target.value)}
                  placeholder="Enter candidate name"
                />
              </div>

              <div>
                <label className="block text-gray-700 mb-2 font-semibold">
                  Participant Emails
                </label>
                <textarea
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-gray-900"
                  rows={3}
                  value={schedulingParticipantEmails}
                  onChange={(e) =>
                    setSchedulingParticipantEmails(e.target.value)
                  }
                  placeholder="Enter participant emails separated by commas&#10;e.g., alex@company.com, hiring.manager@company.com"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Include yourself and any other interviewers. Separate multiple
                  emails with commas.
                </p>
              </div>

              <div>
                <label className="block text-gray-700 mb-2 font-semibold">
                  Preferred Time Range
                </label>
                <select
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-gray-900"
                  value={schedulingTimeRange}
                  onChange={(e) => setSchedulingTimeRange(e.target.value)}
                >
                  <option value="next week">Next Week</option>
                  <option value="this week">This Week</option>
                  <option value="next 2 weeks">Next 2 Weeks</option>
                  <option value="next month">Next Month</option>
                  <option value="tomorrow">Tomorrow</option>
                  <option value="today">Today</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-700 mb-2 font-semibold">
                  Specific Requirements (Optional)
                </label>
                <textarea
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-gray-900"
                  rows={2}
                  value={schedulingRequirements}
                  onChange={(e) => setSchedulingRequirements(e.target.value)}
                  placeholder="Any specific scheduling requirements or preferences..."
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <button
                  type="button"
                  onClick={handleGenerateSchedulingSuggestions}
                  disabled={
                    schedulingLoading ||
                    !schedulingCandidateName ||
                    !schedulingParticipantEmails
                  }
                  className="bg-green-600 text-white font-bold py-3 px-4 rounded-md hover:bg-green-700 disabled:bg-gray-400 transition-colors"
                >
                  {schedulingLoading
                    ? "Generating Suggestions..."
                    : "Get Scheduling Suggestions"}
                </button>
                <button
                  type="button"
                  onClick={handleScheduleInterview}
                  disabled={
                    schedulingLoading ||
                    !schedulingCandidateName ||
                    !schedulingParticipantEmails
                  }
                  className="bg-blue-600 text-white font-bold py-3 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
                >
                  {schedulingLoading
                    ? "Scheduling..."
                    : "Auto-Schedule Best Slot"}
                </button>
              </div>
            </div>

            {/* Interview Team */}
            {participants.length > 0 && (
              <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-700 mb-3">
                  Interview Team
                </h3>
                <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                  {participants
                    .filter((p) => !p.email.includes("winchestervicious"))
                    .map((participant) => (
                      <div
                        key={participant.id}
                        className="flex items-center space-x-2 p-2 bg-white rounded border border-gray-200"
                      >
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {participant.name}
                          </p>
                          <p className="text-xs text-gray-600">
                            {participant.email}
                          </p>
                          <p className="text-xs text-blue-600">
                            {participant.role
                              .replace("HR Manager", "Technical Lead")
                              .replace("HR Specialist", "Senior Developer")
                              .replace("hr", "Developer")
                              .replace("hiring_manager", "Tech Lead")}
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Scheduling Suggestions */}
            {schedulingSuggestions.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-gray-700 mb-4">
                  Suggested Interview Slots
                </h3>
                <div className="space-y-3">
                  {schedulingSuggestions.map((slot) => (
                    <div
                      key={slot.id}
                      className="border border-gray-200 rounded-lg p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="font-semibold text-gray-800">
                            {formatDateTime(slot.start_time)}
                          </h4>
                          <p className="text-sm text-gray-600">
                            Duration: {slot.duration_minutes} minutes
                          </p>
                          <p className="text-sm text-green-600 font-medium">
                            ✅ Available for {slot.participants.length} team
                            member{slot.participants.length > 1 ? "s" : ""}
                          </p>
                        </div>
                        <button
                          onClick={() => handleBookSpecificSlot(slot)}
                          className="bg-blue-600 text-white font-medium py-2 px-4 rounded hover:bg-blue-700 transition-colors text-sm"
                        >
                          Book This Slot
                        </button>
                      </div>

                      <div className="text-sm text-gray-600">
                        <p className="font-medium mb-1">Interview Team:</p>
                        <div className="flex flex-wrap gap-2">
                          {slot.participants.map((participant) => (
                            <span
                              key={participant.id}
                              className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs"
                            >
                              {participant.name} (
                              {participant.role
                                .replace("HR Manager", "Technical Lead")
                                .replace("HR Specialist", "Senior Developer")
                                .replace("hr", "Developer")
                                .replace("hiring_manager", "Tech Lead")}
                              )
                            </span>
                          ))}
                        </div>
                        <p className="mt-2 text-xs text-gray-500">
                          Interview for:{" "}
                          <span className="font-medium text-gray-700">
                            {schedulingCandidateName}
                          </span>
                        </p>
                      </div>

                      {slot.meeting_link && (
                        <div className="mt-2 text-sm">
                          <p className="font-medium text-gray-700">
                            Meeting Link:
                          </p>
                          <a
                            href={slot.meeting_link}
                            className="text-blue-600 hover:underline"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {slot.meeting_link}
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Scheduled Interview */}
            {scheduledInterview && (
              <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <h3 className="text-lg font-semibold text-green-800 mb-3">
                  ✅ Interview Scheduled Successfully!
                </h3>
                <div className="space-y-2">
                  <div>
                    <p className="font-medium text-gray-700">Candidate:</p>
                    <p className="text-gray-900">
                      {scheduledInterview.booked_for}
                    </p>
                  </div>
                  <div>
                    <p className="font-medium text-gray-700">Date & Time:</p>
                    <p className="text-gray-900">
                      {formatDateTime(scheduledInterview.start_time)}
                    </p>
                  </div>
                  <div>
                    <p className="font-medium text-gray-700">Duration:</p>
                    <p className="text-gray-900">
                      {scheduledInterview.duration_minutes} minutes
                    </p>
                  </div>
                  <div>
                    <p className="font-medium text-gray-700">Participants:</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {scheduledInterview.participants.map((participant) => (
                        <span
                          key={participant.id}
                          className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm"
                        >
                          {participant.name} ({participant.role})
                        </span>
                      ))}
                    </div>
                  </div>
                  {scheduledInterview.meeting_link && (
                    <div>
                      <p className="font-medium text-gray-700">Meeting Link:</p>
                      <a
                        href={scheduledInterview.meeting_link}
                        className="text-blue-600 hover:underline"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {scheduledInterview.meeting_link}
                      </a>
                    </div>
                  )}
                  <div className="mt-3 p-2 bg-green-100 rounded text-sm text-green-800">
                    📅 Calendar invitations have been sent to all participants.
                  </div>
                </div>
              </div>
            )}

            {error && activeTab === "scheduling" && (
              <div className="mt-6 p-4 bg-red-50 border-l-4 border-red-400 rounded-lg">
                <div className="flex">
                  <div className="text-red-400 mr-3">⚠️</div>
                  <div>
                    <p className="text-sm text-red-700">
                      <strong>Error:</strong> {error}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Interview Copilot Tab */}
        {activeTab === "interview-copilot" && (
          <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-xl border border-gray-100 hover:shadow-2xl transition-shadow duration-300">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-r from-pink-500 to-rose-600 rounded-full flex items-center justify-center">
                <span className="text-white text-xl">🤖</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-pink-600 to-rose-600 bg-clip-text text-transparent">
                Interview Copilot
              </h2>
            </div>
            <p className="text-gray-600 mb-8 text-base sm:text-lg leading-relaxed">
              Your AI-powered assistant for conducting fair, effective, and
              transparent interviews with real-time coaching and bias detection.
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Phase 1: Pre-Interview Briefing */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 border-l-4 border-blue-400 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02]">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-sm">1</span>
                  </div>
                  <h3 className="text-xl font-bold text-blue-800">
                    Pre-Interview Briefing
                  </h3>
                </div>
                <p className="text-blue-700 mb-6 text-sm leading-relaxed">
                  Generate comprehensive interview guides with AI-powered
                  questions, objectives, and legal compliance guardrails.
                </p>
                <div className="space-y-3">
                  <div className="flex items-center text-sm text-blue-600">
                    <span className="mr-2">✓</span>
                    PDF resume parsing
                  </div>
                  <div className="flex items-center text-sm text-blue-600">
                    <span className="mr-2">✓</span>
                    Custom interview questions
                  </div>
                  <div className="flex items-center text-sm text-blue-600">
                    <span className="mr-2">✓</span>
                    Legal compliance checks
                  </div>
                </div>
                <button
                  onClick={() => window.open("/interview-copilot", "_blank")}
                  className="mt-6 w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold py-3 px-4 rounded-xl hover:from-blue-700 hover:to-indigo-700 transform hover:scale-[1.02] transition-all duration-200 shadow-md"
                >
                  🚀 Open Interview Prep Tool
                </button>
              </div>

              {/* Phase 2: Live Interview Moderator */}
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 border-l-4 border-green-400 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02]">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-emerald-600 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-sm">2</span>
                  </div>
                  <h3 className="text-xl font-bold text-green-800">
                    Live Interview Moderator
                  </h3>
                </div>
                <p className="text-green-700 mb-6 text-sm leading-relaxed">
                  Get real-time AI coaching during interviews with bias
                  detection, talk ratio monitoring, and topic tracking.
                </p>
                <div className="space-y-3">
                  <div className="flex items-center text-sm text-green-600">
                    <span className="mr-2">🚨</span>
                    Real-time bias alerts
                  </div>
                  <div className="flex items-center text-sm text-green-600">
                    <span className="mr-2">⏱️</span>
                    Talk ratio monitoring
                  </div>
                  <div className="flex items-center text-sm text-green-600">
                    <span className="mr-2">🎯</span>
                    Topic coverage tracking
                  </div>
                </div>
                <button
                  onClick={() => window.open("/interview-copilot", "_blank")}
                  className="mt-6 w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold py-3 px-4 rounded-xl hover:from-green-700 hover:to-emerald-700 transform hover:scale-[1.02] transition-all duration-200 shadow-md"
                >
                  🎙️ Open Live Moderator
                </button>
              </div>
            </div>

            {/* Phase 3: Post-Interview Analysis */}
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-6 border-l-4 border-purple-400 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02]">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-sm">3</span>
                </div>
                <h3 className="text-xl font-bold text-purple-800">
                  Post-Interview Analysis
                </h3>
              </div>
              <p className="text-purple-700 mb-6 text-sm leading-relaxed">
                Generate comprehensive candidate evaluation reports with
                AI-powered insights, competency scoring, and hiring
                recommendations.
              </p>
              <div className="space-y-3">
                <div className="flex items-center text-sm text-purple-600">
                  <span className="mr-2">📊</span>
                  Competency-based scoring
                </div>
                <div className="flex items-center text-sm text-purple-600">
                  <span className="mr-2">💪</span>
                  Strengths & development areas
                </div>
                <div className="flex items-center text-sm text-purple-600">
                  <span className="mr-2">🎯</span>
                  Data-driven hiring recommendations
                </div>
              </div>
              <button
                onClick={() => window.open("/interview-copilot", "_blank")}
                className="mt-6 w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold py-3 px-4 rounded-xl hover:from-purple-700 hover:to-pink-700 transform hover:scale-[1.02] transition-all duration-200 shadow-md"
              >
                📈 Open Analysis Tool
              </button>
            </div>

            {/* Phase 4: Onboarding the New Hire */}
            <div className="mb-8 p-6 border border-green-200 rounded-lg bg-green-50">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">
                Phase 4: Onboarding the New Hire
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                After an offer is accepted, generate a 3-month onboarding plan
                that includes IT setup, introductory meetings, training modules,
                tasks, resources, and a welcome email draft.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-700 mb-1">
                    Candidate Name
                  </label>
                  <input
                    type="text"
                    value={onboardingCandidateName}
                    onChange={(e) => setOnboardingCandidateName(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded text-black"
                    placeholder="e.g., Priya Sharma"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 mb-1">Job Title</label>
                  <input
                    type="text"
                    value={onboardingJobTitle}
                    onChange={(e) => setOnboardingJobTitle(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded text-black"
                    placeholder="e.g., Senior Software Engineer"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={onboardingStartDate}
                    onChange={(e) => setOnboardingStartDate(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded text-black"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 mb-1">
                    Manager Name
                  </label>
                  <input
                    type="text"
                    value={onboardingManagerName}
                    onChange={(e) => setOnboardingManagerName(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded text-black"
                    placeholder="e.g., Alex"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-gray-700 mb-1">
                    Team Members (comma-separated emails or names)
                  </label>
                  <textarea
                    value={onboardingTeamMembers}
                    onChange={(e) => setOnboardingTeamMembers(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded text-black"
                    rows={2}
                    placeholder="e.g., sarah@company.com, michael@company.com"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-gray-700 mb-1">
                    Job Description
                  </label>
                  <textarea
                    value={onboardingJobDescription}
                    onChange={(e) =>
                      setOnboardingJobDescription(e.target.value)
                    }
                    className="w-full p-2 border border-gray-300 rounded text-black"
                    rows={3}
                    placeholder="Paste the job description..."
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-gray-700 mb-1">
                    Interview Feedback (optional)
                  </label>
                  <textarea
                    value={onboardingInterviewFeedback}
                    onChange={(e) =>
                      setOnboardingInterviewFeedback(e.target.value)
                    }
                    className="w-full p-2 border border-gray-300 rounded text-black"
                    rows={3}
                    placeholder="Key takeaways from the interview"
                  />
                </div>
              </div>

              <div className="mt-4 flex gap-3">
                <button
                  onClick={handleGenerateOnboardingPlan}
                  disabled={onboardingLoading}
                  className="bg-green-600 text-white font-bold py-2 px-4 rounded-md hover:bg-green-700"
                >
                  {onboardingLoading
                    ? "Generating..."
                    : "Generate Onboarding Plan"}
                </button>

                <input
                  type="email"
                  value={onboardingEmail}
                  onChange={(e) => setOnboardingEmail(e.target.value)}
                  placeholder="Enter email to send welcome message"
                  className="px-3 py-2 border border-gray-300 rounded-md text-black"
                />

                <button
                  onClick={handleSendWelcomeEmail}
                  disabled={onboardingLoading || !generatedOnboardingPlan}
                  className="bg-blue-600 text-white font-bold py-2 px-4 rounded-md hover:bg-blue-700"
                >
                  {onboardingLoading ? "Sending..." : "Send Welcome Email"}
                </button>
              </div>

              {onboardingStatus && (
                <p className="mt-3 text-sm text-gray-700">{onboardingStatus}</p>
              )}

              {generatedOnboardingPlan && (
                <div className="mt-6 p-4 bg-white border border-gray-200 rounded">
                  <h4 className="font-semibold mb-2">
                    Onboarding Plan Preview
                  </h4>
                  <p>
                    <strong>Welcome Message:</strong>{" "}
                    {generatedOnboardingPlan.welcome_message}
                  </p>
                  <p className="mt-2">
                    <strong>First Day Schedule:</strong>
                  </p>
                  <pre className="whitespace-pre-wrap text-sm p-2 bg-gray-50 rounded">
                    {generatedOnboardingPlan.first_day_schedule}
                  </pre>
                  <p className="mt-2">
                    <strong>First Week Goals:</strong>
                  </p>
                  <ul className="list-disc pl-6">
                    {(generatedOnboardingPlan.first_week_goals || []).map(
                      (g: string, i: number) => (
                        <li key={i}>{g}</li>
                      ),
                    )}
                  </ul>
                  <p className="mt-2">
                    <strong>First Month Goals:</strong>
                  </p>
                  <ul className="list-disc pl-6">
                    {(generatedOnboardingPlan.first_month_goals || []).map(
                      (g: string, i: number) => (
                        <li key={i}>{g}</li>
                      ),
                    )}
                  </ul>

                  <p className="mt-3 font-semibold">Tasks</p>
                  <div className="grid gap-2 mt-2">
                    {(generatedOnboardingPlan.tasks || []).map(
                      (t: {
                        id: string;
                        title: string;
                        description?: string;
                        due_date?: string;
                        assigned_to?: string;
                      }) => (
                        <div
                          key={t.id}
                          className="p-2 border rounded bg-gray-50"
                        >
                          <p className="font-medium">{t.title}</p>
                          <p className="text-sm text-gray-600">
                            {t.description}
                          </p>
                          <p className="text-xs mt-1">
                            Due: {t.due_date} • Assigned to: {t.assigned_to}
                          </p>
                        </div>
                      ),
                    )}
                  </div>

                  <p className="mt-3 font-semibold">Resources</p>
                  <div className="grid gap-2 mt-2">
                    {(generatedOnboardingPlan.resources || []).map(
                      (r: {
                        id: string;
                        title: string;
                        url?: string;
                        category?: string;
                        description?: string;
                      }) => (
                        <div
                          key={r.id}
                          className="p-2 border rounded bg-gray-50"
                        >
                          <p className="font-medium">
                            <a
                              className="text-blue-600"
                              href={r.url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {r.title}
                            </a>{" "}
                            <span className="text-xs text-gray-500">
                              ({r.category})
                            </span>
                          </p>
                          <p className="text-sm text-gray-600">
                            {r.description}
                          </p>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                <strong>Note:</strong> The Interview Copilot opens in a new tab
                for the best experience. Each phase works independently but
                together they form a complete, responsible AI-powered interview
                workflow.
              </p>
            </div>
          </div>
        )}
        {/* Footer */}
        <footer className="text-center mt-16 sm:mt-20 pt-8 border-t border-gray-200">
          <p className="text-gray-500 text-sm">
            Powered by AI • Built for smarter hiring decisions
          </p>
        </footer>
      </div>
    </main>
  );
}
