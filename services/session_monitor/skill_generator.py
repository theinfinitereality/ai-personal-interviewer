"""Generate Claude Code skill files from interview data."""

import json
import logging
from typing import Optional

import google.generativeai as genai

from .config import secrets

logger = logging.getLogger(__name__)

SKILL_PROMPT = """You are an expert at creating Claude Code skill files from workflow information.

Based on the following interview summary and workflows, create a comprehensive Claude Code skill file in Markdown format.

The skill file should:
1. Have a clear title based on the workflow name
2. Include a description of what the skill does
3. Define clear inputs with their sources and formats
4. Define clear outputs with their destinations and formats
5. Include step-by-step instructions for Claude to follow
6. Be ready to copy-paste and use immediately

INTERVIEW SUMMARY:
{summary}

IDENTIFIED WORKFLOWS:
{workflows}

Generate a complete Claude Code skill file in Markdown format. Include:
- Title (# Skill: [Name])
- Description
- Inputs section (with source systems, formats, triggers)
- Outputs section (with destination systems, formats)
- Step-by-step process instructions
- Any relevant notes or considerations

Return ONLY the Markdown content, ready to be saved as a .md file.
"""


class SkillGenerator:
    """Generates Claude Code skill files from interview data."""

    def __init__(self):
        """Initialize the skill generator with Gemini."""
        if not secrets.GEMINI_API_KEY:
            raise ValueError("Gemini API key is required")

        genai.configure(api_key=secrets.GEMINI_API_KEY)
        self.model = genai.GenerativeModel("gemini-2.5-flash")
        logger.info("Initialized Skill Generator with gemini-2.5-flash")

    def generate(self, summary: dict, workflows: list) -> Optional[str]:
        """
        Generate a Claude Code skill file from summary and workflows.

        Args:
            summary: The conversation summary dict
            workflows: List of identified workflows

        Returns:
            Markdown string for the skill file, or None if generation fails
        """
        if not summary and not workflows:
            logger.warning("No summary or workflows provided, skipping skill generation")
            return None

        # Format the data for the prompt
        summary_text = json.dumps(summary, indent=2) if summary else "No summary available"
        workflows_text = json.dumps(workflows, indent=2) if workflows else "No workflows identified"

        prompt = SKILL_PROMPT.format(
            summary=summary_text,
            workflows=workflows_text
        )

        try:
            response = self.model.generate_content(prompt)
            skill_content = response.text.strip()

            # Clean up response - remove markdown code blocks if present
            if skill_content.startswith("```markdown"):
                skill_content = skill_content[len("```markdown"):].strip()
            elif skill_content.startswith("```md"):
                skill_content = skill_content[len("```md"):].strip()
            elif skill_content.startswith("```"):
                skill_content = skill_content[3:].strip()
            
            if skill_content.endswith("```"):
                skill_content = skill_content[:-3].strip()

            logger.info("Successfully generated skill file")
            return skill_content

        except Exception as e:
            logger.error(f"Failed to generate skill file: {e}")
            return None

