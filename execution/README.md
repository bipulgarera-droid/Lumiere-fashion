# Execution Scripts

This folder contains **deterministic Python scripts** that perform the actual work.

## Purpose

- Handle API calls, data processing, file operations, database interactions
- Reliable, testable, and fast
- Well-commented for maintainability

## Principles

1. **Deterministic**: Same input → same output
2. **Self-contained**: Each script handles one specific task
3. **Error handling**: Graceful failures with clear error messages
4. **Environment variables**: Secrets loaded from `.env`, never hardcoded

## Usage

Scripts are called by the orchestration layer (the AI agent) based on directives.

```bash
# Example: run a script
python execution/script_name.py --arg1 value1
```

## Dependencies

Add any required packages to `requirements.txt` in the project root.
