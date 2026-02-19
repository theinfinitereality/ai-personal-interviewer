"""Gemini-powered conversation summarizer for interviews."""

import json
import logging
from dataclasses import dataclass
from typing import Optional, List

import google.generativeai as genai

from .config import secrets
from .napster_client import SessionTranscript

logger = logging.getLogger(__name__)

# Employee workflow analysis prompt
SUMMARY_PROMPT = """You are a workflow analyst helping to understand employee daily tasks and identify opportunities for process improvement.

Analyze this conversation between an AI interviewer and an employee discussing their work responsibilities and daily tasks.

Provide a structured analysis in JSON format:

{{
  "employee_profile": {{
    "role_summary": "Brief description of the employee's role",
    "key_responsibilities": ["Main tasks and responsibilities discussed"],
    "tools_and_systems": ["Software, tools, or systems they mentioned using"],
    "pain_points": ["Frustrations or challenges mentioned"]
  }},
  "workflow_analysis": {{
    "identified_workflows": ["List of distinct workflows or processes described"],
    "repetitive_tasks": ["Tasks that appear to be done frequently/regularly"],
    "manual_processes": ["Tasks that seem highly manual or time-consuming"],
    "automation_potential": "high/medium/low"
  }},
  "conversation_quality": {{
    "engagement_level": "high/medium/low",
    "depth_of_responses": "detailed/moderate/brief",
    "total_exchanges": <number>
  }},
  "key_insights": [
    "Insight about their work or processes",
    "Another insight"
  ],
  "suggested_actions": [
    "Recommended follow-up or improvement opportunity"
  ],
  "overall_summary": "A brief 2-3 sentence summary of the employee's role and the workflows discussed"
}}

CONVERSATION:
{conversation}

Return ONLY valid JSON. No markdown, no code blocks, just the JSON object.
"""


@dataclass
class ConversationSummary:
    """Structured summary of an employee workflow interview."""
    session_id: str
    employee_profile: dict
    workflow_analysis: dict
    conversation_quality: dict
    key_insights: List[str]
    suggested_actions: List[str]
    overall_summary: str
    raw_json: dict

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "session_id": self.session_id,
            "employee_profile": self.employee_profile,
            "workflow_analysis": self.workflow_analysis,
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
            employee_profile = data.get("employee_profile", {})
            workflow_analysis = data.get("workflow_analysis", {})
            conversation_quality = data.get("conversation_quality", {})
            key_insights = data.get("key_insights", [])
            suggested_actions = data.get("suggested_actions", [])
            overall_summary = data.get("overall_summary", "")

            summary = ConversationSummary(
                session_id=transcript.session_id,
                employee_profile=employee_profile,
                workflow_analysis=workflow_analysis,
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

