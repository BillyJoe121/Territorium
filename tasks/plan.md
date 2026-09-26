# Implementation plan: Microsoft 365 final document

## Overview

Migrate the final document from Tiptap JSON editing to a Microsoft 365-managed DOCX while preserving Supabase authorization and immutable Territorium audit data. The high-risk decision is whether the product requires a real embedded editor (`wopi-cspp`) or a supported Word web launch (`graph-launch`).

## Architecture decisions

- Graph is a server-side document-management API, not a browser credential or a guaranteed organization iframe editor.
- Supabase remains the trusted project-role and immutable-audit boundary.
- Database expansion comes before UI cutover; Tiptap removal is the final contract step.
- The Microsoft version history and Territorium checkpoint history are related but distinct: the former is Microsoft file history; the latter proves business-process state and source consolidation.

## Task list

### Phase 0: Decision and tenant proof

- [ ] Confirm `graph-launch` or `wopi-cspp`, the Microsoft 365 tenant, SharePoint site/library, retention policy, and document owner.
- [ ] Create a non-production Entra application with least privilege and validate the permission model against one test document.
- [ ] If `wopi-cspp`, obtain CSPP eligibility before starting host/iframe work.

### Phase 1: Foundation

- [ ] Apply `20260924090000_prepare_microsoft_graph_document_workspace.sql` and verify RLS plus binding/checkpoint uniqueness.
- [ ] Define the server broker contract: provision, get session/launch descriptor, synchronize version checkpoints, and finalize.
- [ ] Implement a DOCX renderer from the approved consolidation using the existing worker `python-docx` dependency and a reviewed `.docx` template.

### Checkpoint: Foundation

- [ ] A legal reviewer can provision a document in the test library; an auditor can read the binding and checkpoints; no browser bundle contains a credential or Graph token.

### Phase 2: Document operations

- [ ] Implement the authenticated server broker with strict project/item binding and validated Graph responses.
- [ ] Implement Graph version synchronization and finalization that fails closed when the synchronized item version is stale.
- [ ] Add tests for unauthorized access, cross-project binding, duplicate checkpoints, Graph outage, and stale finalization.

### Phase 3: UI and migration

- [ ] Add a feature-flagged `DocumentWorkspace` UI with loading, failure, keyboard, status, and launch fallback states.
- [ ] For `graph-launch`, open the permitted Word web URL in a new tab. For `wopi-cspp`, add the WOPI host iframe only after integration testing.
- [ ] Pilot with selected projects; preserve Tiptap as rollback/read-only legacy.
- [ ] Migrate eligible active documents to DOCX and remove Tiptap packages only after no active Tiptap writers remain and archive/export verification passes.

## Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Assuming Graph gives an editable SharePoint iframe | High | Decide Graph launch vs WOPI/CSPP before UI work. |
| Browser token/secret exposure | Critical | Server-only broker; no `VITE_` secrets; CSP and log review. |
| Source-version ambiguity | High | Record source consolidation, drive/item/version/ETag and immutable checkpoint at every finalization. |
| Breaking historical documents | High | Expand-first schema and Tiptap legacy reader until migration exit criteria pass. |
| Microsoft retention removes an old version | Medium | Confirm tenant library retention and retain Territorium checkpoint metadata/hashes. |
