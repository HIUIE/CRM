---
name: self-improving-agent
description: A protocol for agents to document errors, learnings, and user feedback in a .learnings directory and evolve project rules. Use this skill when you encounter tool failures, user corrections, or need to track long-term improvements.
---

# Self-Improving Agent Protocol

This skill enforces a continuous improvement loop by documenting technical failures and strategic insights.

## Core Workflow

### 1. Document Failures
When a tool call fails or a logical error is detected, log it in `.learnings/ERRORS.md`:
- **Context**: What was being attempted.
- **Symptom**: The observable failure (e.g., build error, white screen).
- **Root Cause**: Why it happened (e.g., tool truncation, port collision).

### 2. Capture Learnings
When a fix is successful or a user provides a correction, log it in `.learnings/LEARNINGS.md`:
- **Protocol**: A specific sequence of steps to prevent recurrence.
- **Rule**: A project-level constraint derived from the experience.

### 3. Track Requests
Log new feature ideas or user suggestions in `.learnings/FEATURE_REQUESTS.md`.

### 4. Evolve Project Rules
Periodically promote high-impact learnings into the project's root `AI_CONTEXT.md` or engineering standards.

## Project Structure
The following directory and files are mandatory for this skill:
- `.learnings/ERRORS.md`
- `.learnings/LEARNINGS.md`
- `.learnings/FEATURE_REQUESTS.md`
