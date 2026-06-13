-- Private bucket for "Report a problem" screenshots.
--
-- These are DIAGNOSTIC artifacts, not display assets: they exist so the owner
-- and the Pilot can see what the user saw, learn from it, and figure out the
-- fix. So unlike `showcase` (public), this bucket is PRIVATE — objects are
-- never reachable by URL. The durable record is the storage PATH saved on the
-- feedback row (context.screenshot_path); the owner/Pilot read the bytes with
-- the service-role key (createSignedUrl / download), which bypasses RLS.
--
-- Bucket-level mime + size caps are a second enforcement rung (defense in
-- depth) — the upload route validates too, but the bucket makes a bad write
-- impossible even if the route is bypassed.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'feedback', 'feedback', false, 6291456,
  array['image/jpeg','image/png','image/webp','image/gif']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- A signed-in user may upload ONLY into their own {uid}/ folder. Tighter than
-- the legacy `showcase` policy on purpose (deny-by-default, owner-scoped).
-- No SELECT / UPDATE / DELETE policy → nobody reads or mutates via RLS; the
-- owner and the Pilot read with the service-role key, which bypasses RLS.
drop policy if exists "feedback: owner can upload own screenshots" on storage.objects;
create policy "feedback: owner can upload own screenshots"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'feedback'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
