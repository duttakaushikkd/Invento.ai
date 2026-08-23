---
description: Use when creating, updating, or deleting inventory records.
---

# Mutation confirmation

1. Call `inspect_schema` unless the schema is already in context.
2. Call `preview_mutation` with only known columns.
3. Summarize the before/after impact in plain language.
4. Wait for the user to confirm, then `commit_mutation`.
5. Never skip preview. Never emit A1 ranges or spreadsheet formulas.
