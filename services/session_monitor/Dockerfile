# Session Processor Service for AI Personal Interviewer
#
# This Dockerfile builds the processor service that handles:
# - Batch processing of conversation transcripts
# - AI summarization using Gemini
# - Storage of summaries to Google Cloud Storage
#
# This service should be deployed with --no-allow-unauthenticated
# and invoked only by Cloud Scheduler with proper IAM authentication.
#
# Build: docker build -f services/session_monitor/Dockerfile -t session-processor .
# Run:   docker run -p 8080:8080 -e GEMINI_API_KEY=xxx -e NAPSTER_API_KEY=xxx session-processor

FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install dependencies
COPY services/session_monitor/requirements.txt /app/services/session_monitor/
RUN pip install --no-cache-dir -r /app/services/session_monitor/requirements.txt

# Copy service code
COPY services/__init__.py /app/services/
COPY services/session_monitor/ /app/services/session_monitor/

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PORT=8080

# Expose port
EXPOSE 8080

# Run the processor server
CMD ["python", "-m", "services.session_monitor.processor"]

