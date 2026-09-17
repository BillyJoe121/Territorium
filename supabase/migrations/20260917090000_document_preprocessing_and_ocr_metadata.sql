-- Migration: 20260917090000_document_preprocessing_and_ocr_metadata.sql
-- Description: E04 Almacenamiento y preprocesamiento documental (US-035 to US-040)

-- 1. Add metadata and preprocessing columns to source_documents
alter table public.source_documents
  add column if not exists page_count integer,
  add column if not exists is_scanned boolean default false,
  add column if not exists needs_ocr boolean default false,
  add column if not exists ocr_applied boolean default false,
  add column if not exists text_origin text default 'native' check (text_origin in ('native', 'ocr', 'hybrid', 'exception')),
  add column if not exists is_encrypted boolean default false,
  add column if not exists working_text text,
  add column if not exists preprocessing_status text default 'ready' check (preprocessing_status in ('ready', 'needs_ocr', 'ocr_in_progress', 'ocr_completed', 'exception', 'corrupt')),
  add column if not exists exception_reason text;

-- Indexes for querying documents requiring OCR or in exception
create index if not exists idx_source_documents_preprocessing on public.source_documents(project_id, preprocessing_status);
create index if not exists idx_source_documents_needs_ocr on public.source_documents(project_id, needs_ocr) where needs_ocr = true;
