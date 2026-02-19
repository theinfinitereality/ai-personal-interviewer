"""
Session Processor - Private HTTP endpoint for Cloud Scheduler

This service handles batch processing of sessions:
- Fetches transcripts from Napster API
- Summarizes conversations using Gemini AI
- Stores summaries in Google Cloud Storage

This endpoint is deployed as a private Cloud Run service (--no-allow-unauthenticated)
and is only callable by Cloud Scheduler with proper IAM authentication.
"""

import json
import logging
import os
from http.server import HTTPServer, BaseHTTPRequestHandler

logger = logging.getLogger(__name__)


class ProcessorHandler(BaseHTTPRequestHandler):
    """HTTP handler for the processor service."""

    def _send_json(self, status: int, data: dict):
        """Send JSON response."""
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def do_GET(self):
        """Handle GET requests - health check only."""
        if self.path == "/health" or self.path == "/":
            self._send_json(200, {"status": "healthy", "service": "session-processor"})
        else:
            self._send_json(404, {"error": "Not found"})

    def do_POST(self):
        """Handle POST requests - process sessions."""
        if self.path == "/" or self.path == "/process":
            try:
                from .main import SessionMonitor

                logger.info("Starting batch session processing...")
                monitor = SessionMonitor()
                processed = monitor.check_and_process()

                logger.info(f"Batch processing complete: {processed} session(s) processed")
                self._send_json(200, {
                    "success": True,
                    "message": f"Processed {processed} session(s)",
                    "processed_count": processed
                })
            except Exception as e:
                logger.error(f"Failed to process sessions: {e}", exc_info=True)
                self._send_json(500, {"error": str(e)})
        else:
            self._send_json(404, {"error": "Not found"})

    def log_message(self, format, *args):
        """Override to use our logger."""
        logger.info(f"{self.address_string()} - {format % args}")


def run_processor(host: str = "0.0.0.0", port: int = 8080):
    """Run the processor HTTP server."""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

    server = HTTPServer((host, port), ProcessorHandler)
    logger.info(f"Starting Session Processor on {host}:{port}")
    logger.info("This is a PRIVATE service - only callable by Cloud Scheduler")
    logger.info("Endpoints:")
    logger.info("  GET  /health  - Health check")
    logger.info("  POST /        - Process sessions (trigger batch job)")
    logger.info("  POST /process - Process sessions (alias)")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        logger.info("Shutting down processor...")
        server.shutdown()


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Session Processor Service")
    parser.add_argument("--host", default="0.0.0.0", help="Host to bind to")
    parser.add_argument("--port", type=int, default=int(os.environ.get("PORT", 8080)), help="Port to listen on")
    args = parser.parse_args()

    run_processor(args.host, args.port)

