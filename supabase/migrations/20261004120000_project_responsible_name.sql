-- Proyecto: profesional responsable obligatorio y municipios múltiples.
--
-- 1. El formulario de proyecto ya no captura "Línea de transmisión / Infraestructura"
--    (power_line se conserva solo por compatibilidad con datos históricos).
-- 2. Quien crea el proyecto registra su nombre como responsable.
-- 3. El municipio sigue siendo texto libre, pero admite varios separados por coma.

alter table public.projects
  add column if not exists responsible_name text
    check (responsible_name is null or char_length(trim(responsible_name)) between 3 and 180);

comment on column public.projects.responsible_name is
  'Nombre del profesional/abogado que creó el proyecto y responde por él. Obligatorio para proyectos nuevos (validado en la aplicación).';

-- Permite registrar varios municipios ("Pereira, Dosquebradas").
alter table public.projects drop constraint if exists projects_municipality_check;
alter table public.projects
  add constraint projects_municipality_check
    check (municipality is null or char_length(municipality) <= 400);

grant update (responsible_name) on public.projects to authenticated;

create index if not exists projects_responsible_idx
  on public.projects (responsible_name) where responsible_name is not null;
