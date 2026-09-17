-- Migration: 20260917080000_batch_manifest_and_input_validation.sql
-- Description: E03 Lotes, carga y manifiesto de insumos (US-019 to US-029)

-- 1. Extend document_kind enum with 'boundaries' if not already present
alter type public.document_kind add value if not exists 'boundaries';

-- 2. Add columns to source_documents for property association and duplicate resolution
alter table public.source_documents
  add column if not exists property_code text,
  add column if not exists duplicate_decision text check (duplicate_decision is null or duplicate_decision in ('omit', 'replace', 'keep_version')),
  add column if not exists duplicate_of_document_id uuid references public.source_documents(id) on delete set null;

-- Index for property code and sha256 lookups
create index if not exists idx_source_documents_property_code on public.source_documents(project_id, property_code);
create index if not exists idx_source_documents_sha256 on public.source_documents(project_id, sha256);

-- 3. Add columns to batches for expected properties list and manifest summary
alter table public.batches
  add column if not exists expected_properties text[] default '{}',
  add column if not exists manifest_summary jsonb default '{}'::jsonb;
