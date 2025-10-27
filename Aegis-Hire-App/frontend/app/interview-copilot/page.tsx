"use client";

import React, { useState, useEffect, useRef, FC, ComponentProps } from "react";

// --- Type Definitions (for context, not used by demo) ---
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

// --- Reusable UI Components ---

const Card: FC<ComponentProps<"div">> = ({ className, children, ...props }) => (
  <div
    className={`bg-white p-4 sm:p-6 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition-shadow duration-300 ${className}`}
    {...props}
  >
    {children}
  </div>
);

const CardTitle: FC<ComponentProps<"h2">> = ({
  className,
  children,
  ...props
}) => (
  <h2
    className={`text-xl sm:text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-3 ${className}`}
    {...props}
  >
    {children}
  </h2>
);

const Label: FC<ComponentProps<"label">> = ({ className, ...props }) => (
  <label
    className={`block text-sm font-semibold text-gray-700 mb-2 ${className}`}
    {...props}
  />
);

const Textarea: FC<ComponentProps<"textarea">> = ({ className, ...props }) => (
  <textarea
    className={`w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 bg-gray-50 transition-colors duration-200 ${className}`}
    {...props}
  />
);

const Button: FC<ComponentProps<"button">> = ({
  className,
  children,
  ...props
}) => (
  <button
    className={`px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-lg hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed transform hover:scale-[1.02] transition-all duration-200 shadow-md ${className}`}
    {...props}
  >
    {children}
  </button>
);

// --- Other Page Sections ---

const PreInterviewBriefing = () => {
  const [jobDescription, setJobDescription] = useState(
    "Senior Software Engineer with 5+ years of experience in Python, Django, AWS, and Kubernetes.",
  );
  const [candidateName, setCandidateName] = useState("");
  const [candidateResume, setCandidateResume] = useState("");
  const [interviewerName, setInterviewerName] = useState("");
  const [jobTitle, setJobTitle] = useState("Senior Software Engineer");
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [interviewGuide, setInterviewGuide] = useState(null);
  const [error, setError] = useState("");

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("http://127.0.0.1:8000/api/upload-resume", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setCandidateName(data.candidate_name || "");
        setCandidateResume(data.raw_text || "");
      } else {
        setError(data.detail || "Failed to upload resume");
      }
    } catch (err) {
      setError(
        "Failed to upload resume. Make sure the backend server is running.",
      );
    } finally {
      setIsUploading(false);
    }
  };

  const generateInterviewGuide = async () => {
    if (
      !jobDescription.trim() ||
      !candidateResume.trim() ||
      !candidateName.trim()
    ) {
      setError("Please fill in all required fields and upload a resume.");
      return;
    }

    setIsGenerating(true);
    setError("");

    try {
      const response = await fetch(
        "http://127.0.0.1:8000/api/generate-interview-guide",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            job_title: jobTitle,
            job_description: jobDescription,
            candidate_name: candidateName,
            candidate_resume: candidateResume,
            interviewer_name: interviewerName || "Interviewer",
          }),
        },
      );

      const data = await response.json();

      if (response.ok) {
        setInterviewGuide(data.guide);
      } else {
        setError(data.detail || "Failed to generate interview guide");
      }
    } catch (err) {
      setError(
        "Failed to generate guide. Ensure backend server is running and GEMINI_API_KEY is configured.",
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card className="mb-8">
      <div className="flex items-center space-x-3 mb-4">
        <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
          <span className="text-white font-bold">1</span>
        </div>
        <CardTitle>Pre-Interview Briefing</CardTitle>
      </div>
      <p className="text-gray-600 mb-6 text-sm sm:text-base">
        Upload candidate resume and generate AI-powered interview guide.
      </p>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-400 rounded-lg">
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

      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="jobTitle">💼 Job Title</Label>
            <input
              id="jobTitle"
              type="text"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 bg-gray-50 transition-colors duration-200"
            />
          </div>
          <div>
            <Label htmlFor="interviewerName">👤 Interviewer Name</Label>
            <input
              id="interviewerName"
              type="text"
              value={interviewerName}
              onChange={(e) => setInterviewerName(e.target.value)}
              placeholder="Your name"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 bg-gray-50 transition-colors duration-200"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="jobDescription">📄 Job Description</Label>
          <Textarea
            id="jobDescription"
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            rows={4}
            className="resize-none"
          />
        </div>

        <div className="bg-gray-50 p-4 rounded-lg border-2 border-dashed border-gray-300 hover:border-indigo-400 transition-colors">
          <Label htmlFor="resumeUpload">📎 Upload Candidate Resume (PDF)</Label>
          <input
            id="resumeUpload"
            type="file"
            accept=".pdf"
            onChange={handleFileUpload}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-700 bg-white file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
            disabled={isUploading}
          />
          {isUploading && (
            <div className="mt-3 flex items-center text-sm text-indigo-600">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600 mr-2"></div>
              Uploading and parsing resume...
            </div>
          )}
        </div>

        {candidateName && (
          <div className="bg-green-50 border-l-4 border-green-400 p-4 rounded-lg">
            <div className="flex items-center">
              <div className="text-green-400 mr-3">✅</div>
              <p className="text-sm text-green-800">
                <strong>Candidate Identified:</strong> {candidateName}
              </p>
            </div>
          </div>
        )}

        <Button
          onClick={generateInterviewGuide}
          disabled={isGenerating || isUploading}
          className="w-full text-lg py-4"
        >
          {isGenerating ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
              🤖 Generating AI Guide...
            </div>
          ) : (
            "🚀 Generate AI Interview Guide"
          )}
        </Button>

        {interviewGuide && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6">
            <h5 className="font-bold text-blue-900 mb-4 text-lg flex items-center">
              <span className="mr-2">📋</span>
              Generated Interview Guide
            </h5>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <h6 className="font-semibold text-blue-700 mb-3 flex items-center">
                  <span className="mr-2">🎯</span>
                  Key Objectives
                </h6>
                <ul className="text-sm text-blue-600 space-y-2">
                  {interviewGuide.key_objectives?.map((obj, idx) => (
                    <li key={idx} className="flex items-start">
                      <span className="text-blue-400 mr-2">•</span>
                      {obj}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-white p-4 rounded-lg shadow-sm">
                <h6 className="font-semibold text-blue-700 mb-3 flex items-center">
                  <span className="mr-2">❓</span>
                  Structured Questions
                </h6>
                <ul className="text-sm text-blue-600 space-y-2">
                  {interviewGuide.structured_questions?.map((q, idx) => (
                    <li key={idx} className="flex items-start">
                      <span className="text-blue-400 mr-2">•</span>
                      {q}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-white p-4 rounded-lg shadow-sm">
                <h6 className="font-semibold text-blue-700 mb-3 flex items-center">
                  <span className="mr-2">⚖️</span>
                  Legal Guardrails
                </h6>
                <ul className="text-sm text-blue-600 space-y-2">
                  {interviewGuide.legal_guardrails?.map((g, idx) => (
                    <li key={idx} className="flex items-start">
                      <span className="text-blue-400 mr-2">•</span>
                      {g}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};

const PostInterviewAnalysis = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState("");
  const [sessionId] = useState(
    "session_demo_" + Math.random().toString(36).substr(2, 9),
  );

  // This would typically come from the live interview session
  const mockTranscript = `
Interviewer: Can you tell me about your experience with Python and Django?
Candidate: I have over 6 years of experience with Python and have worked extensively with Django for web development. I've built several microservices architectures using these technologies.
Interviewer: That's great. What about your experience with AWS?
Candidate: I'm comfortable with EC2, RDS, S3, and Lambda. I've deployed applications using these services and have experience with infrastructure as code.
  `.trim();

  const generateAnalysis = async () => {
    setIsGenerating(true);
    setError("");

    try {
      const response = await fetch(
        "http://127.0.0.1:8000/api/generate-interview-analysis",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            interview_session_id: sessionId,
            job_title: "Senior Software Engineer",
            job_description:
              "Senior Software Engineer with 5+ years of experience in Python, Django, AWS, and Kubernetes.",
            candidate_name: "Sarah Johnson",
            interview_transcript: mockTranscript,
            interviewer_notes:
              "Candidate seemed knowledgeable and professional.",
          }),
        },
      );

      const data = await response.json();

      if (response.ok) {
        setAnalysis(data.analysis);
      } else {
        setError(data.detail || "Failed to generate analysis");
      }
    } catch (err) {
      setError(
        "Failed to generate analysis. Ensure backend server is running and GEMINI_API_KEY is configured.",
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card className="mt-8">
      <div className="flex items-center space-x-3 mb-4">
        <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-600 rounded-full flex items-center justify-center">
          <span className="text-white font-bold">3</span>
        </div>
        <CardTitle>Post-Interview Analysis</CardTitle>
      </div>
      <p className="text-gray-600 mb-6 text-sm sm:text-base">
        Generate AI-powered analysis of the interview transcript.
      </p>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-400 rounded-lg">
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

      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Button
            onClick={generateAnalysis}
            disabled={isGenerating}
            className="flex items-center justify-center space-x-2 py-4"
          >
            {isGenerating ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>🤖 Analyzing...</span>
              </>
            ) : (
              <>
                <span>📊</span>
                <span>Generate AI Analysis</span>
              </>
            )}
          </Button>

          <Button
            className="flex items-center justify-center space-x-2 bg-gray-400 hover:bg-gray-500 py-4"
            disabled
          >
            <span>📝</span>
            <span>Export Report</span>
          </Button>
        </div>

        {analysis && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-l-4 border-green-400 rounded-lg p-6">
                <h5 className="font-bold text-green-800 mb-3 flex items-center">
                  <span className="mr-2">💪</span>
                  Strengths
                </h5>
                <div className="mb-3">
                  <div className="flex items-center justify-center w-16 h-16 bg-green-500 rounded-full mx-auto mb-2">
                    <span className="text-2xl font-bold text-white">
                      {analysis.overall_rating}
                    </span>
                    <span className="text-sm text-green-100">/5</span>
                  </div>
                </div>
                <ul className="text-sm text-green-700 space-y-2">
                  {analysis.strengths?.map((strength, idx) => (
                    <li key={idx} className="flex items-start">
                      <span className="text-green-500 mr-2">✓</span>
                      {strength}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-gradient-to-br from-yellow-50 to-amber-50 border-l-4 border-yellow-400 rounded-lg p-6">
                <h5 className="font-bold text-yellow-800 mb-4 flex items-center">
                  <span className="mr-2">📈</span>
                  Areas for Development
                </h5>
                <ul className="text-sm text-yellow-700 space-y-2">
                  {analysis.areas_for_development?.map((area, idx) => (
                    <li key={idx} className="flex items-start">
                      <span className="text-yellow-500 mr-2">→</span>
                      {area}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-l-4 border-blue-400 rounded-lg p-6">
                <h5 className="font-bold text-blue-800 mb-4 flex items-center">
                  <span className="mr-2">🎯</span>
                  Recommendation
                </h5>
                <div className="text-center mb-4">
                  <span className="inline-block px-4 py-2 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold">
                    {analysis.hiring_recommendation}
                  </span>
                </div>
                <p className="text-sm text-blue-700">
                  {analysis.diversity_insights}
                </p>
              </div>
            </div>

            {analysis?.competencies_assessed && (
              <div className="bg-gray-50 rounded-xl p-6">
                <h5 className="font-bold text-gray-800 mb-4 flex items-center text-lg">
                  <span className="mr-2">🔍</span>
                  Competency Assessment
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {analysis.competencies_assessed.map((comp, idx) => (
                    <div
                      key={idx}
                      className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-indigo-400"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <h6 className="font-semibold text-gray-800 flex-1">
                          {comp.competency}
                        </h6>
                        <div className="ml-4 flex items-center">
                          <div className="flex space-x-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <span
                                key={star}
                                className={`text-sm ${
                                  star <= comp.rating
                                    ? "text-yellow-400"
                                    : "text-gray-300"
                                }`}
                              >
                                ⭐
                              </span>
                            ))}
                          </div>
                          <span className="ml-2 text-sm font-semibold text-indigo-600">
                            {comp.rating}/5
                          </span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm text-gray-600">
                          <strong className="text-gray-700">Evidence:</strong>{" "}
                          {comp.evidence}
                        </p>
                        <p className="text-sm text-gray-600">
                          <strong className="text-gray-700">
                            Recommendation:
                          </strong>{" "}
                          {comp.recommendation}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};

// --- Phase 2: Live Interview Moderator ---

const LiveInterviewModerator = () => {
  // --- State Management ---
  const [showModal, setShowModal] = useState(false);
  const [isInterviewing, setIsInterviewing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [nudges, setNudges] = useState<string[]>([]);
  const [jobDescription, setJobDescription] = useState(
    "Senior Software Engineer with 5+ years of experience in Python, Django, AWS, and Kubernetes.",
  );
  const [error, setError] = useState<string | null>(null);

  // --- Refs for managing WebSocket and SpeechRecognition ---
  const ws = useRef<WebSocket | null>(null);
  const recognition = useRef<SpeechRecognition | null>(null);

  const handleNudge = (nudgeData: string) => {
    try {
      const data = JSON.parse(nudgeData);
      if (data.event_type === "automatic_scribe") {
        return;
      }
      console.log("Received nudge:", data);
      const nudgeMessage = `${data.event_type.replace(/_/g, " ").toUpperCase()}: ${
        data.message
      }`;
      setNudges((prev) => [...prev, nudgeMessage]);
    } catch (e) {
      console.error("Failed to parse incoming nudge:", nudgeData);
    }
  };

  // --- Session and WebSocket Management ---
  const handleStartSession = () => {
    if (!jobDescription.trim()) {
      alert("Please enter a job description to provide context for the AI.");
      return;
    }
    setShowModal(true);
    setIsInterviewing(true);
    setTranscript("");
    setNudges([]);
    setError(null);

    const sessionId = "session_demo_" + Math.random().toString(36).substr(2, 9);
    ws.current = new WebSocket(`ws://127.0.0.1:8000/ws/interview/${sessionId}`);

    ws.current.onopen = () => console.log("WebSocket connection established.");
    ws.current.onclose = () => console.log("WebSocket connection closed.");
    ws.current.onerror = (err) => {
      console.error("WebSocket error:", err);
      setError(
        "WebSocket connection failed. Ensure the backend server is running.",
      );
      stopRecording();
    };

    ws.current.onmessage = (event) => {
      handleNudge(event.data);
    };
  };

  const handleEndSession = () => {
    stopRecording();
    setIsInterviewing(false);
    setShowModal(false);
    ws.current?.close();
    ws.current = null;
  };

  // --- Speech Recognition Logic ---
  const startRecording = () => {
    if (recognition.current) {
      recognition.current.start();
      setIsRecording(true);
    }
  };

  const stopRecording = () => {
    if (recognition.current) {
      recognition.current.stop();
      setIsRecording(false);
    }
  };

  // --- Lifecycle Hook for Cleanup ---
  useEffect(() => {
    const SpeechRecognitionAPI =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognitionAPI) {
      recognition.current = new SpeechRecognitionAPI();
      recognition.current.continuous = true;
      recognition.current.interimResults = true;
      recognition.current.lang = "en-US";

      recognition.current.onresult = (event: SpeechRecognitionEvent) => {
        let final_transcript = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final_transcript += event.results[i][0].transcript;
          }
        }

        if (final_transcript) {
          setTranscript((prev) => prev + final_transcript);
          if (ws.current?.readyState === WebSocket.OPEN) {
            ws.current.send(final_transcript);
          }
        }
      };

      recognition.current.onerror = (event: Event) => {
        console.error("Speech recognition error", event);
        setError(
          "Speech recognition error. Please check your microphone and browser permissions.",
        );
      };
    } else {
      setError(
        "Speech recognition not supported in this browser. Please use Chrome or Firefox.",
      );
    }

    return () => {
      recognition.current?.stop();
      if (ws.current) {
        ws.current.close();
      }
    };
  }, []);

  return (
    <Card className="my-8">
      <div className="flex items-center space-x-3 mb-4">
        <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-emerald-600 rounded-full flex items-center justify-center">
          <span className="text-white font-bold">2</span>
        </div>
        <CardTitle>Live Interview Moderator</CardTitle>
      </div>
      <p className="text-gray-600 mb-6 text-sm sm:text-base">
        Real-time bias detection and interview coaching.
      </p>

      <div className="mb-6">
        <Label htmlFor="liveJobDescription">
          📄 Job Description (Context for AI)
        </Label>
        <Textarea
          id="liveJobDescription"
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
          rows={4}
          className="resize-none"
        />
      </div>

      <Button
        onClick={handleStartSession}
        disabled={isInterviewing}
        className="w-full sm:w-auto text-lg py-4 px-8"
      >
        {isInterviewing ? (
          <div className="flex items-center">
            <div className="animate-pulse w-3 h-3 bg-white rounded-full mr-3"></div>
            Session Active
          </div>
        ) : (
          <div className="flex items-center">
            <span className="mr-2">🚀</span>
            Start Live Interview Session
          </div>
        )}
      </Button>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full h-full max-w-none max-h-screen overflow-hidden flex flex-col sm:max-w-7xl sm:max-h-[90vh]">
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-4 sm:p-6 flex justify-between items-center">
              <h3 className="text-xl sm:text-2xl font-bold text-white flex items-center">
                <span className="mr-3">🎙️</span>
                Live Interview Moderator
              </h3>
              <button
                onClick={handleEndSession}
                className="text-white hover:text-gray-200 text-2xl sm:text-3xl font-bold p-1 hover:bg-white hover:bg-opacity-20 rounded-full transition-all"
              >
                ×
              </button>
            </div>

            <div className="p-4 sm:p-6 flex-1 flex flex-col overflow-hidden">
              <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row gap-3 sm:gap-4">
                <Button
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={!isInterviewing}
                  className="flex items-center justify-center text-base sm:text-lg py-3 px-6"
                >
                  {isRecording ? (
                    <>
                      <span className="mr-2">⏹️</span>
                      Stop Recording
                    </>
                  ) : (
                    <>
                      <span className="mr-2">▶️</span>
                      Start Recording
                    </>
                  )}
                </Button>

                {isRecording && (
                  <div className="flex items-center justify-center sm:justify-start gap-3 text-red-600 bg-red-50 px-4 py-3 rounded-lg">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></div>
                      <div
                        className="w-2 h-2 bg-red-600 rounded-full animate-pulse"
                        style={{ animationDelay: "0.2s" }}
                      ></div>
                      <div
                        className="w-2 h-2 bg-red-600 rounded-full animate-pulse"
                        style={{ animationDelay: "0.4s" }}
                      ></div>
                    </div>
                    <span className="font-semibold text-sm sm:text-base">
                      Recording Live...
                    </span>
                  </div>
                )}
              </div>

              {error && (
                <div className="mb-4 sm:mb-6 p-4 bg-red-50 border-l-4 border-red-400 rounded-lg">
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

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 flex-1 min-h-0">
                <div className="flex flex-col min-h-0 bg-gray-50 rounded-xl p-4 sm:p-6">
                  <h4 className="font-bold mb-3 text-gray-800 flex items-center text-lg">
                    <span className="mr-2">📝</span>
                    Live Transcript
                  </h4>
                  <div className="flex-1 overflow-y-auto bg-white rounded-lg p-4 border border-gray-200">
                    <div className="whitespace-pre-wrap text-gray-900 text-sm sm:text-base leading-relaxed">
                      {transcript || (
                        <div className="text-gray-500 italic text-center py-8">
                          <div className="mb-3 text-2xl">🎤</div>
                          Start recording to begin the interview...
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col min-h-0 bg-red-50 rounded-xl p-4 sm:p-6">
                  <h4 className="font-bold mb-3 text-red-800 flex items-center text-lg">
                    <span className="mr-2">🚨</span>
                    AI Nudges (Private)
                  </h4>
                  <div className="flex-1 overflow-y-auto bg-white rounded-lg p-4 border border-red-200">
                    {nudges.map((nudge, index) => (
                      <div
                        key={index}
                        className="mb-4 p-4 bg-gradient-to-r from-red-100 to-pink-100 border-l-4 border-red-400 rounded-lg shadow-sm transform hover:scale-[1.02] transition-transform"
                      >
                        <p className="text-sm sm:text-base text-red-800 font-medium leading-relaxed">
                          {nudge}
                        </p>
                      </div>
                    ))}
                    {nudges.length === 0 && (
                      <div className="text-gray-500 italic text-center py-8">
                        <div className="mb-3 text-2xl">🤖</div>
                        <p className="text-sm sm:text-base">
                          No nudges yet. The AI is monitoring the
                          conversation...
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};

// --- Main Page Component ---
export default function InterviewCopilotPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-12">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-4">
            🤖 AI Interview Copilot
          </h1>
          <p className="text-gray-600 text-lg sm:text-xl max-w-3xl mx-auto leading-relaxed">
            Transform your hiring process with AI-powered interview assistance,
            bias detection, and comprehensive analysis.
          </p>
        </div>

        {/* Progress Indicator */}
        <div className="flex justify-center mb-8 sm:mb-12">
          <div className="flex items-center space-x-4 bg-white rounded-full p-2 shadow-lg border border-gray-200">
            <div className="flex items-center space-x-2 px-4 py-2 bg-blue-50 rounded-full">
              <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                1
              </div>
              <span className="text-blue-700 text-sm font-medium hidden sm:inline">
                Prep
              </span>
            </div>
            <div className="w-8 h-0.5 bg-gray-300"></div>
            <div className="flex items-center space-x-2 px-4 py-2 bg-green-50 rounded-full">
              <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                2
              </div>
              <span className="text-green-700 text-sm font-medium hidden sm:inline">
                Live
              </span>
            </div>
            <div className="w-8 h-0.5 bg-gray-300"></div>
            <div className="flex items-center space-x-2 px-4 py-2 bg-purple-50 rounded-full">
              <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                3
              </div>
              <span className="text-purple-700 text-sm font-medium hidden sm:inline">
                Analysis
              </span>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="space-y-8 sm:space-y-12">
          <PreInterviewBriefing />
          <LiveInterviewModerator />
          <PostInterviewAnalysis />
        </div>

        {/* Footer */}
        <footer className="text-center mt-16 sm:mt-20 pt-8 border-t border-gray-200">
          <p className="text-gray-500 text-sm">
            Powered by AI • Built for fair and effective hiring
          </p>
        </footer>
      </div>
    </div>
  );
}
