---
name: Report reference contract
description: Durable findings from the supplied notation.docx report template.
---

The report reference is an A4 portrait French evaluation sheet with a fixed
three-row header, narrow objective value cells, a totals row, and a separate
individual/class decisions section. Production document generation should
preserve this information hierarchy while calculating dynamic widths and
switching orientation when objective count makes portrait unreadable.

**Why:** The user explicitly identified the document as authoritative for
generated reports, while also requiring the database—not Word—to be the source
of truth.

**How to apply:** Use the report DTO and generator boundary described in
`docs/architecture.md`; do not add document-editing behavior to the app.