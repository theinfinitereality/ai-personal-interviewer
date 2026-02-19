"""State management for tracking processed sessions."""

import json
import logging
import os
from typing import Set

from .config import GCS_BUCKET, GCS_STATE_BLOB, PROCESSED_SESSIONS_FILE

logger = logging.getLogger(__name__)


class StateManager:
    """Manages state of processed sessions using GCS or local file."""

    def __init__(self):
        self.state_file = PROCESSED_SESSIONS_FILE
        self._gcs_client = None
        self._gcs_bucket = None
        
        if GCS_BUCKET:
            self._init_gcs()
    
    def _init_gcs(self):
        """Initialize Google Cloud Storage client."""
        try:
            from google.cloud import storage
            self._gcs_client = storage.Client()
            self._gcs_bucket = self._gcs_client.bucket(GCS_BUCKET)
            logger.info(f"Initialized GCS storage with bucket: {GCS_BUCKET}")
        except ImportError:
            logger.warning("google-cloud-storage not installed, using local file storage")
        except Exception as e:
            logger.error(f"Failed to initialize GCS: {e}")
    
    def load_processed_sessions(self) -> Set[str]:
        """Load the set of already-processed session IDs."""
        # Try GCS first
        if self._gcs_bucket:
            try:
                blob = self._gcs_bucket.blob(GCS_STATE_BLOB)
                if blob.exists():
                    content = blob.download_as_text()
                    data = json.loads(content)
                    sessions = set(data.get("processed_sessions", []))
                    logger.info(f"Loaded {len(sessions)} processed sessions from GCS")
                    return sessions
            except Exception as e:
                logger.warning(f"Failed to load state from GCS: {e}")
        
        # Fallback to local file
        try:
            if os.path.exists(self.state_file):
                with open(self.state_file, "r") as f:
                    data = json.load(f)
                    sessions = set(data.get("processed_sessions", []))
                    logger.info(f"Loaded {len(sessions)} processed sessions from local file")
                    return sessions
        except Exception as e:
            logger.warning(f"Failed to load state from file: {e}")
        
        return set()
    
    def save_processed_sessions(self, sessions: Set[str]):
        """Save the set of processed session IDs."""
        data = {
            "processed_sessions": list(sessions),
            "last_updated": __import__('datetime').datetime.utcnow().isoformat()
        }
        
        # Save to GCS
        if self._gcs_bucket:
            self._save_to_gcs(data)
        
        # Also save to local file as backup
        self._save_to_file(data)
    
    def _save_to_gcs(self, data: dict):
        """Save state to Google Cloud Storage."""
        try:
            blob = self._gcs_bucket.blob(GCS_STATE_BLOB)
            blob.upload_from_string(json.dumps(data, indent=2))
            logger.info(f"Saved state to GCS: {GCS_STATE_BLOB}")
        except Exception as e:
            logger.error(f"Failed to save state to GCS: {e}")
    
    def _save_to_file(self, data: dict):
        """Save state to local file."""
        try:
            os.makedirs(os.path.dirname(self.state_file), exist_ok=True)
            with open(self.state_file, "w") as f:
                json.dump(data, f, indent=2)
            logger.info(f"Saved state to file: {self.state_file}")
        except Exception as e:
            logger.error(f"Failed to save state to file: {e}")
    
    def mark_as_processed(self, session_id: str):
        """Mark a single session as processed."""
        sessions = self.load_processed_sessions()
        sessions.add(session_id)
        self.save_processed_sessions(sessions)

