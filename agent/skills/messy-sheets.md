---
description: Use when connecting or interpreting messy spreadsheet headers, blank rows, or locale numbers.
---

# Spreadsheet quirks

- Treat the first non-empty row as headers. Normalize spaces to underscores.
- Never use row numbers as identity.
- Blank rows are not records.
- Numeric strings like "nine" stay strings until a human confirms a type override.
- Merged cells and duplicate headers become `name_2`.
