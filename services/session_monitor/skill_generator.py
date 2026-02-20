"""Generate Claude Code skill files from interview data."""

import json
import logging
from typing import Optional

import google.generativeai as genai

from .config import secrets

logger = logging.getLogger(__name__)

SKILL_PROMPT = """You are an expert at creating extremely comprehensive, production-ready Claude Code skill files.

Based on the interview data below, create the MOST DETAILED Claude Code skill file possible in Markdown format.

INTERVIEW SUMMARY:
{summary}

IDENTIFIED WORKFLOWS:
{workflows}

Generate a HIGHLY DETAILED skill file that is immediately usable by Claude Code. Follow this structure:

---
name: [short-kebab-case-name]
description: [One detailed sentence describing what this skill does end-to-end]
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, WebFetch, WebSearch, Task, TodoWrite, mcp__Claude_in_Chrome__tabs_context_mcp, mcp__Claude_in_Chrome__tabs_create_mcp, mcp__Claude_in_Chrome__navigate, mcp__Claude_in_Chrome__get_page_text, mcp__Claude_in_Chrome__read_page, mcp__Claude_in_Chrome__find, mcp__Claude_in_Chrome__computer, mcp__Claude_in_Chrome__javascript_tool, mcp__Claude_in_Chrome__form_input
---

# [Descriptive Title for the Skill]

[2-3 sentence overview of what this skill accomplishes and its business value]

## Your Role: [Specific Role Name] for [User's Name if available]

You are acting as [specific role] supporting [user's team/function]. Your job is to:
- [Key responsibility 1 with specific detail]
- [Key responsibility 2 with specific detail]
- [Key responsibility 3 with specific detail]
- [Key responsibility 4 with specific detail]

**Your Voice in the Report:**
- [Describe tone - e.g., Professional, research-driven, concise]
- [How to address the user - e.g., "I've identified...", "I recommend..."]
- [Key priorities - e.g., prioritize accuracy over speed]
- [Be specific about communication style]

## User Persona: [Name and Title]

**Background:**
- [Professional background bullet 1]
- [Professional background bullet 2]
- [Current role and responsibilities]
- [Relevant experience or expertise]
- [Location/context if relevant]

**[User's] Communication Style (for outputs):**
- [Style trait 1 - e.g., Direct and confident]
- [Style trait 2 - e.g., Relationship-focused]
- [Style trait 3 - e.g., Action-oriented]
- [Style trait 4 - e.g., Technical but accessible]

## Business/Product Context

[Describe the business context, team, or product this workflow supports. Include:]
- What the team/company does
- Key differentiators or important context
- Why this workflow matters to the business
- Any domain-specific knowledge Claude needs

## Step-by-Step Process

### Phase 0: Load Context & Memory

Before starting, load any relevant context files:

```bash
cat ~/Desktop/context/memory.txt 2>/dev/null || echo "No prior memory found"
```

Use context to:
- Recognize previous work or interactions
- Identify existing information that could be leveraged
- Understand ongoing tasks that provide context

### Phase 1: Gather Requirements

Ask the user for:

1. **[Specific requirement 1]** — Description and examples
2. **[Specific requirement 2]** — Description and defaults if not provided
3. **[Specific requirement 3]** — Description and what it enables

If the user provides all upfront, proceed directly. Do not ask unnecessary questions.

### Phase 2: [Process Name - e.g., "Research & Analysis"]

For each [item/task], perform:

1. **[Step 1 name]** — Detailed description
2. **[Step 2 name]** — Detailed description
3. **[Step 3 name]** — Detailed description

**[Process] sources** (in order of priority):
- [Source 1 with specifics]
- [Source 2 with specifics]
- [Source 3 with specifics]

**Technical approach:**
- Use [specific tool] to [specific action]
- Use [specific tool] to [specific action]
- Use browser automation if needed for [specific scenario]

### Phase 3: [Transform/Process Name]

For each [item] identified:

1. [Specific action with validation]
2. [Specific action with format requirements]
3. Note [specific details to capture]

**Strategy:**
- [Approach 1 with specifics]
- [Approach 2 with specifics]
- [Fallback approach]

### Phase 4: [Analysis/Mapping Name]

For each [item], determine the approach:

**Tier 1 — [Best case scenario]:**
- [Specific criteria]
- [What to look for]
- [How to verify]

**Tier 2 — [Good scenario]:**
- [Specific criteria]
- [What to look for]
- [Alternative approach]

**Tier 3 — [Fallback scenario]:**
- [Specific criteria]
- [Extra effort required]
- [How to proceed]

### Phase 5: Generate Outputs

Create outputs based on the analysis:

**For [Tier/Type 1] — [Output template name]:**
```
[Actual template with placeholders like [First Name], [Company], etc.]

[Multiple lines showing the complete template]

[Include signature or closing if relevant]
```

**For [Tier/Type 2] — [Output template name]:**
```
[Actual template with placeholders]

[Multiple lines showing the complete template]
```

**For [Tier/Type 3] — [Output template name]:**
```
[Actual template with placeholders]

[Multiple lines showing the complete template]
```

### Phase 6: Present Findings

Deliver a comprehensive output formatted as follows:

---

**[OUTPUT TITLE]: [Date]**

For each [item], present:

**[Item Name]**
| Field | Details |
|-------|---------|
| [Field 1] | ... |
| [Field 2] | ... |
| [Key insight] | [1-2 sentences] |

**[Section 2 if applicable]:**

| Column 1 | Column 2 | Column 3 | Column 4 |
|----------|----------|----------|----------|
| [data] | [data] | [data] | [data] |

**[Drafted content/recommendations]:**
[Include any generated content, clearly labeled]

---

### Phase 7: Save to Memory (After Completion)

After the user reviews and approves:

1. Save key information to memory for future reference
2. Note decisions made and approaches taken
3. Record feedback for improvement

```bash
# Append to memory
cat >> ~/Desktop/context/memory.txt << 'EOF'

[DATE] - [Workflow Name]: [Brief description]
- [Key outcome 1]
- [Key outcome 2]
- Status: [Pending/Complete/etc.]
EOF
```

## Templates & Examples

### [Template 1 Name]

```
[Complete template with placeholders]
[Should be copy-paste ready]
[Include all necessary sections]
```

### [Template 2 Name]

```
[Complete template with placeholders]
[Should be copy-paste ready]
```

## Important Notes

- **Never [critical constraint 1]** — always [correct behavior]
- **Respect [constraint 2]** — only [acceptable approach]
- **Be transparent** about [uncertainty/limitations]
- **Prioritize [quality metric]** — [reasoning]
- **[Tool/system access]** — if [limitation], note what you couldn't access and suggest manual follow-up

---

CRITICAL REQUIREMENTS:
1. Be EXTREMELY detailed and specific — this skill should be immediately usable without modifications
2. Include ACTUAL templates with [placeholders], not descriptions of templates
3. Add bash commands for file operations, context loading, and memory management
4. Include multiple tiers/scenarios for different situations
5. Create numbered, actionable steps in each phase (not vague descriptions)
6. The skill should enable Claude to execute this workflow END-TO-END autonomously
7. Include tables for structured data presentation
8. Add decision trees and branching logic where applicable
9. Reference specific tools and systems mentioned in the interview
10. Make the user persona section detailed with background and communication style

Return ONLY the Markdown content, ready to be saved as a .md file.
"""


class SkillGenerator:
    """Generates Claude Code skill files from interview data."""

    def __init__(self):
        """Initialize the skill generator with Gemini."""
        if not secrets.GEMINI_API_KEY:
            raise ValueError("Gemini API key is required")

        genai.configure(api_key=secrets.GEMINI_API_KEY)
        self.model = genai.GenerativeModel("gemini-3.1-pro")
        logger.info("Initialized Skill Generator with gemini-3.1-pro")

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

