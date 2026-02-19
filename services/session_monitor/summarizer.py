"""Gemini-powered conversation summarizer for interviews."""

import json
import logging
from dataclasses import dataclass
from typing import Optional, List

import google.generativeai as genai

from .config import secrets
from .napster_client import SessionTranscript

logger = logging.getLogger(__name__)

# Interview summarization prompt
SUMMARY_PROMPT = """You are an interview analyst helping to summarize and extract insights from interview conversations.

Analyze this conversation between an interviewer (AI Assistant) and a candidate (User). Focus on ACTIONABLE INSIGHTS.

Provide a structured analysis in JSON format:

{{
  "candidate_profile": {{
    "key_points": ["List of key points discussed"],
    "strengths": ["Identified strengths"],
    "areas_of_interest": ["Topics the candidate showed interest in"]
  }},
  "conversation_quality": {{
    "engagement_level": "high/medium/low",
    "depth_of_responses": "detailed/moderate/brief",
    "total_exchanges": <number>
  }},
  "key_insights": [
    "Insight 1",
    "Insight 2",
    "Insight 3"
  ],
  "suggested_actions": [
    "Action 1",
    "Action 2"
  ],
  "overall_summary": "A brief 2-3 sentence summary of the entire conversation"
}}

CONVERSATION:
{conversation}

Return ONLY valid JSON. No markdown, no code blocks, just the JSON object.
"""


@dataclass
class ConversationSummary:
    """Structured summary of an interview conversation."""
    session_id: str
    candidate_profile: dict
    conversation_quality: dict
    key_insights: List[str]
    suggested_actions: List[str]
    overall_summary: str
    raw_json: dict

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "session_id": self.session_id,
            "candidate_profile": self.candidate_profile,
            "conversation_quality": self.conversation_quality,
            "key_insights": self.key_insights,
            "suggested_actions": self.suggested_actions,
            "overall_summary": self.overall_summary,
        }


class GeminiSummarizer:
    """Summarizes conversations using Gemini AI."""

    def __init__(self, api_key: str = None):
        if api_key is None:
            api_key = secrets.GEMINI_API_KEY

        if not api_key:
            raise ValueError("Gemini API key is required. Set GEMINI_API_KEY env var or configure Secret Manager.")

        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel('gemini-2.5-flash')
        logger.info("Initialized Gemini summarizer with gemini-2.5-flash")

    def summarize(self, transcript: SessionTranscript) -> Optional[ConversationSummary]:
        """
        Summarize a conversation transcript using Gemini AI.
        
        Args:
            transcript: The session transcript to summarize
            
        Returns:
            ConversationSummary object or None if summarization fails
        """
        if not transcript.has_meaningful_content():
            logger.warning(f"Skipping summary for session {transcript.session_id[:20]}... - insufficient content")
            return None

        conversation_text = transcript.to_conversation_text()
        prompt = SUMMARY_PROMPT.format(conversation=conversation_text)

        try:
            response = self.model.generate_content(prompt)
            response_text = response.text.strip()

            # Clean up response - remove markdown code blocks if present
            if response_text.startswith("```"):
                response_text = response_text.split("\n", 1)[1]
            if response_text.endswith("```"):
                response_text = response_text.rsplit("```", 1)[0]
            response_text = response_text.strip()

            # Parse JSON response
            data = json.loads(response_text)

            # Extract fields with defaults
            candidate_profile = data.get("candidate_profile", {})
            conversation_quality = data.get("conversation_quality", {})
            key_insights = data.get("key_insights", [])
            suggested_actions = data.get("suggested_actions", [])
            overall_summary = data.get("overall_summary", "")

            summary = ConversationSummary(
                session_id=transcript.session_id,
                candidate_profile=candidate_profile,
                conversation_quality=conversation_quality,
                key_insights=key_insights,
                suggested_actions=suggested_actions,
                overall_summary=overall_summary,
                raw_json=data,
            )

            logger.info(f"Successfully summarized session {transcript.session_id[:20]}...")
            return summary

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse Gemini response as JSON: {e}")
            logger.debug(f"Response text: {response_text[:500]}")
            return None
        except Exception as e:
            logger.error(f"Failed to summarize conversation: {e}")
            return None

