# Microsoft 365 final document — ordered tasks

- [ ] Decide `graph-launch` versus `wopi-cspp` and record the tenant/library owner.
  - Acceptance: decision names the supported editing surface and has an accountable owner.
  - Verify: ADR 0008 is updated to Accepted.
  - Files: `docs/adr/0008-microsoft-365-final-document-workspace.md`

- [ ] Apply the additive external-binding/checkpoint migration in a test Supabase project.
  - Acceptance: one project/provider binding and one Graph version checkpoint are unique; auditors can read but not write.
  - Verify: `node supabase/verify_migrations.cjs` and SQL integration checks.
  - Files: `supabase/migrations/20260924090000_prepare_microsoft_graph_document_workspace.sql`

- [ ] Build the server-side broker and DOCX provisioner for the selected mode.
  - Acceptance: authenticated reviewer can provision only their project document; returned descriptor contains no credential.
  - Verify: broker integration tests against a non-production Microsoft 365 library.
  - Files: broker and worker/edge-function implementation selected after Task 1.

- [ ] Add the feature-flagged final-document workspace and run a pilot.
  - Acceptance: loading/error/fallback states work by keyboard; the UI accurately labels its mode.
  - Verify: `npm run verify` and browser manual test.
  - Files: `src/components/expediente/*`, `src/data/*`, `render.yaml` only after exact Office origins are known.

- [ ] Retire Tiptap after pilot exit criteria.
  - Acceptance: no active writer depends on `DocumentPrototypeEditor` or Tiptap JSON; historical documents have an approved archive/export path.
  - Verify: `rg -n "@tiptap|DocumentPrototypeEditor|compileConsolidatedToTiptap" src` returns only intentional legacy migration references.
  - Files: current editor/compiler/PDF code and `package.json`.
