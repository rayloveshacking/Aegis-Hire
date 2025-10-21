import smtplib
from email.mime.text import MIMEText
from pydantic import BaseModel
import os

class EmailRequest(BaseModel):
    to_email: str
    subject: str
    body: str

class EmailService:
    def __init__(self):
        self.smtp_server = os.getenv("SMTP_SERVER")
        self.smtp_port = int(os.getenv("SMTP_PORT", 587))
        self.smtp_user = os.getenv("SMTP_USER")
        self.smtp_password = os.getenv("SMTP_PASSWORD")

    def send_email(self, request: EmailRequest):
        """
        Sends an email using the configured SMTP server.
        """
        if not all([self.smtp_server, self.smtp_port, self.smtp_user, self.smtp_password]):
            print("Email service is not configured. Please check your .env file.")
            return {"message": "Email service is not configured."}

        msg = MIMEText(request.body)
        msg['Subject'] = request.subject
        msg['From'] = self.smtp_user
        msg['To'] = request.to_email

        try:
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                server.starttls()
                server.login(self.smtp_user, self.smtp_password)
                server.send_message(msg)
            return {"message": f"Email successfully sent to {request.to_email}"}
        except Exception as e:
            print(f"Failed to send email: {e}")
            return {"message": f"Failed to send email: {e}"}

email_service = EmailService()
