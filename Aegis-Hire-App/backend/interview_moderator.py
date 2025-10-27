from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_google_genai import ChatGoogleGenerativeAI


class InterviewModerator:
    def __init__(self):
        # Initialize the language model
        self.llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0.7)

        # Define the prompt template for generating interview feedback
        self.prompt_template = PromptTemplate(
            input_variables=["transcript"],
            template="""
            As an interview moderator, your role is to analyze the provided interview transcript and offer real-time feedback to the interviewer. This feedback should help the interviewer conduct a more effective and fair interview.

            Here is the current transcript of the interview:
            ---
            {transcript}
            ---

            Based on the transcript, please provide concise and actionable feedback for the interviewer. Focus on the following areas:

            1.  **Question Quality**: Are the questions open-ended, relevant to the job description, and effective at assessing the candidate's skills and experience?
            2.  **Bias and Fairness**: Is the interviewer asking questions that could be perceived as biased or discriminatory? Are they giving the candidate enough time to speak?
            3.  **Rapport and Engagement**: Is the interviewer building a good rapport with the candidate? Is the conversation engaging and professional?
            4.  **Topic Coverage**: Are all the key areas of the job description being covered? Are there any important topics that have been missed?

            Your feedback should be presented as a list of suggestions or observations that the interviewer can use to improve their technique during the interview.
            """,
        )

        # Create the processing chain
        self.chain = self.prompt_template | self.llm | StrOutputParser()

    def generate_feedback(self, transcript: str) -> str:
        """
        Generates feedback on the interview transcript.

        Args:
            transcript: The transcript of the interview.

        Returns:
            A string containing feedback for the interviewer.
        """
        # Invoke the chain with the transcript
        feedback = self.chain.invoke({"transcript": transcript})
        return feedback
