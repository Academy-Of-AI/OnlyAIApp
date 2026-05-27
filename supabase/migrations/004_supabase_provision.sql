-- Add supabase_project_ref to projects for Management API reference
alter table projects add column if not exists supabase_project_ref text;
