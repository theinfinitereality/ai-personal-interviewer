# Session Monitor Service for AI Personal Interviewer
# 
# This Dockerfile builds the session monitor service that:
# - Fetches transcripts from Napster Spaces API
# - Generates summaries using Gemini AI
# - Stores results in Google Cloud Storage
#
# Build: docker build -f services/session_monitor/Dockerfile -t session-monitor .
# Run:   docker run -e GEMINI_API_KEY=xxx -e NAPSTER_API_KEY=xxx session-monitor

FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Copy requirements and install dependencies
COPY services/session_monitor/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy service code
COPY services/session_monitor /app/services/session_monitor

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV CHECK_INTERVAL_SECONDS=300

# Run the service
CMD ["python", "-m", "services.session_monitor.main", "--once"]

