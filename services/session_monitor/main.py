#!/usr/bin/env python3
"""
Session Monitor Service for AI Personal Interviewer.

This service:
1. Periodically checks for new sessions from Napster Spaces API
2. Gets transcripts for completed sessions
3. Summarizes conversations using Gemini AI
4. Stores summaries and transcripts in GCS

Usage:
    # Run once (for Cloud Run/Scheduler)
    python -m services.session_monitor.main --once

    # Run continuously (polling every 5 minutes)
    python -m services.session_monitor.main --daemon
"""

import argparse
import json
import logging
import sys
import time
from datetime import datetime

from .config import CHECK_INTERVAL_SECONDS, GCS_BUCKET, secrets
from .napster_client import NapsterSpacesClient
from .state_manager import StateManager
from .summarizer import GeminiSummarizer
from .skill_generator import SkillGenerator

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger(__name__)


class SessionMonitor:
    """Main service that monitors sessions and generates summaries."""

    def __init__(self):
        logger.info("Initializing Session Monitor Service...")

        self.napster_client = NapsterSpacesClient()
        self.state_manager = StateManager()
        self.summarizer = GeminiSummarizer()
        self.skill_generator = SkillGenerator()
        
        # Initialize GCS client
        self.gcs_client = None
        self.gcs_bucket = None
        if GCS_BUCKET:
            try:
                from google.cloud import storage
                self.gcs_client = storage.Client()
                self.gcs_bucket = self.gcs_client.bucket(GCS_BUCKET)
                logger.info(f"Initialized GCS bucket: {GCS_BUCKET}")
            except Exception as e:
                logger.error(f"Failed to initialize GCS: {e}")

        logger.info("Session Monitor Service initialized successfully")

    def _save_to_gcs(self, path: str, data: dict):
        """Save data to GCS."""
        if not self.gcs_bucket:
            logger.warning("GCS not configured, skipping save")
            return

        try:
            blob = self.gcs_bucket.blob(path)
            blob.upload_from_string(json.dumps(data, indent=2))
            logger.info(f"Saved to GCS: {path}")
        except Exception as e:
            logger.error(f"Failed to save to GCS {path}: {e}")

    def _load_workflows_from_gcs(self, session_id: str) -> list:
        """Load workflows for a session from GCS."""
        if not self.gcs_bucket:
            return []

        try:
            blob = self.gcs_bucket.blob(f"workflows/{session_id}.json")
            if blob.exists():
                content = blob.download_as_string()
                data = json.loads(content)
                return data.get("workflows", [])
        except Exception as e:
            logger.debug(f"No workflows found for session {session_id[:20]}...: {e}")

        return []

    def check_and_process(self) -> int:
        """
        Check for new sessions and process them.
        
        Returns:
            Number of sessions processed
        """
        logger.info("Checking for new sessions...")
        
        # Get all session IDs from Napster API
        all_session_ids = self.napster_client.get_session_ids()
        
        if not all_session_ids:
            logger.info("No sessions found")
            return 0
        
        # Load already-processed sessions
        processed_sessions = self.state_manager.load_processed_sessions()
        
        # Find new sessions
        new_sessions = [sid for sid in all_session_ids if sid not in processed_sessions]
        
        if not new_sessions:
            logger.info(f"No new sessions to process (total: {len(all_session_ids)}, processed: {len(processed_sessions)})")
            return 0
        
        logger.info(f"Found {len(new_sessions)} new session(s) to process")
        
        processed_count = 0
        
        for session_id in new_sessions:
            try:
                logger.info(f"Processing session {session_id[:20]}...")
                
                # Get transcript
                transcript = self.napster_client.get_transcript(session_id)
                
                if not transcript:
                    logger.warning(f"No transcript available for {session_id[:20]}..., skipping")
                    continue
                
                # Save transcript to GCS
                transcript_data = {
                    "session_id": session_id,
                    "entries": [
                        {
                            "text": entry.text,
                            "role": entry.role,
                            "timestamp": entry.timestamp
                        }
                        for entry in transcript.entries
                    ],
                    "processed_at": datetime.utcnow().isoformat()
                }
                self._save_to_gcs(f"transcripts/{session_id}.json", transcript_data)
                
                # Generate summary
                summary = self.summarizer.summarize(transcript)
                summary_data = None

                if summary:
                    # Save summary to GCS
                    summary_data = {
                        **summary.to_dict(),
                        "processed_at": datetime.utcnow().isoformat()
                    }
                    self._save_to_gcs(f"summaries/{session_id}.json", summary_data)
                    logger.info(f"Successfully processed session {session_id[:20]}...")
                else:
                    logger.warning(f"Failed to generate summary for {session_id[:20]}...")

                # Load workflows for this session (if any)
                workflows = self._load_workflows_from_gcs(session_id)

                # Generate skill file
                if summary_data or workflows:
                    skill_content = self.skill_generator.generate(summary_data, workflows)
                    if skill_content:
                        skill_data = {
                            "session_id": session_id,
                            "skill_content": skill_content,
                            "generated_at": datetime.utcnow().isoformat()
                        }
                        self._save_to_gcs(f"skills/{session_id}.json", skill_data)
                        logger.info(f"Generated skill file for session {session_id[:20]}...")

                # Mark as processed
                self.state_manager.mark_as_processed(session_id)
                processed_count += 1
                
            except Exception as e:
                logger.error(f"Error processing session {session_id[:20]}...: {e}", exc_info=True)
        
        logger.info(f"Completed processing {processed_count} session(s)")
        return processed_count

    def run_daemon(self, interval: int = CHECK_INTERVAL_SECONDS):
        """Run continuously, checking for new sessions at regular intervals."""
        logger.info(f"Starting daemon mode (checking every {interval} seconds)")
        
        while True:
            try:
                self.check_and_process()
            except Exception as e:
                logger.error(f"Error in daemon loop: {e}", exc_info=True)
            
            logger.info(f"Sleeping for {interval} seconds...")
            time.sleep(interval)


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description="Session Monitor Service")
    parser.add_argument(
        "--daemon",
        action="store_true",
        help="Run continuously (daemon mode)"
    )
    parser.add_argument(
        "--interval",
        type=int,
        default=CHECK_INTERVAL_SECONDS,
        help=f"Check interval in seconds (default: {CHECK_INTERVAL_SECONDS})"
    )

    args = parser.parse_args()

    # Validate secrets
    if not secrets.GEMINI_API_KEY:
        logger.error("Gemini API key is required. Set GEMINI_API_KEY env var or configure Secret Manager.")
        sys.exit(1)

    try:
        monitor = SessionMonitor()

        if args.daemon:
            monitor.run_daemon(args.interval)
        else:
            # Default: run once
            processed = monitor.check_and_process()
            logger.info(f"Completed. Processed {processed} session(s)")

    except KeyboardInterrupt:
        logger.info("Shutting down...")
    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()

