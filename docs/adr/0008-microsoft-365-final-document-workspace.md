# ADR 0008: Microsoft 365 is the final DOCX authority; Graph alone does not provide the embedded business editor

**Status:** Proposed — pending product decision and tenant validation  
**Date:** 2026-09-24

## Context

The final-document flow currently compiles an approved consolidated property record into Tiptap JSON, stores it in `expediente_document_versions`, and edits it through `DocumentPrototypeEditor`. The requested future experience needs a Word-compatible final document, Microsoft 365-managed file versions, and an integrated editing experience where technically supported.

Microsoft Graph can upload, inspect, share, and list versions of SharePoint/OneDrive files. It does not make Word for the web an embeddable editor for an organization tenant. The Graph `createLink` `embed` link type is documented as OneDrive Personal-only. Microsoft documents an editable Microsoft 365-for-the-web iframe as a WOPI integration requiring Cloud Storage Partner Program membership and a WOPI host.

## Decision

1. Treat a SharePoint/OneDrive Business DOCX and its Graph `driveItem` versions as the authority for the active Microsoft 365 document.
2. Keep Supabase as Territorium's authorization, process-state, and immutable audit-checkpoint authority. It stores identifiers and verified checkpoint metadata, not browser Graph credentials.
3. Do **not** implement a client-only Graph call or use an `embed` link as the organization-document editor.
4. Support two mutually exclusive delivery modes:
   - `graph-launch` (default proposed): Graph provisions/synchronizes the DOCX; the user opens the permitted Word web URL in a separate tab. This is the short, supported path.
   - `wopi-cspp`: only after CSPP acceptance, implement a WOPI server and host page for the editable iframe. The iframe receives a short-lived WOPI token by POST, never in its query string.
5. Keep Tiptap read/write behavior until the selected replacement completes a controlled pilot. Only then make it read-only legacy, migrate active documents through a reviewed DOCX renderer, and finally remove its packages and editor.

## Consequences

- `graph-launch` delivers DOCX and Microsoft 365 versioning without falsely promising iframe editing.
- `wopi-cspp` meets the embedded-edit requirement but adds programme eligibility, WOPI file/lock endpoints, discovery, token lifecycle, CSP, monitoring, and a larger operational surface.
- Existing Tiptap content remains historical evidence. It cannot be treated as a lossless DOCX conversion.
- The data migration is expand-first: external bindings/checkpoints are additive, and no current Tiptap column is dropped.

## References

- [Graph createLink](https://learn.microsoft.com/en-us/graph/api/driveitem-createlink?view=graph-rest-1.0)
- [Graph file versions](https://learn.microsoft.com/en-us/graph/api/driveitem-list-versions?view=graph-rest-1.0)
- [Microsoft 365 WOPI integration](https://learn.microsoft.com/en-us/microsoft-365/cloud-storage-partner-program/online/)
- [WOPI host page](https://learn.microsoft.com/en-us/microsoft-365/cloud-storage-partner-program/online/hostpage)
