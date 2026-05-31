-- 1. Add `due_date` column to the tasks table
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS due_date timestamp with time zone;

-- 2. Create the Storage Bucket for Avatars
insert into storage.buckets (id, name, public) 
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- 3. Set up Storage Policies for the Avatars Bucket
drop policy if exists "Avatars are publicly accessible" on storage.objects;
create policy "Avatars are publicly accessible"
on storage.objects for select
using ( bucket_id = 'avatars' );

drop policy if exists "Authenticated users can upload avatars" on storage.objects;
create policy "Authenticated users can upload avatars"
on storage.objects for insert
to authenticated
with check ( bucket_id = 'avatars' );

drop policy if exists "Users can update their own avatars" on storage.objects;
create policy "Users can update their own avatars"
on storage.objects for update
to authenticated
using ( bucket_id = 'avatars' );

drop policy if exists "Users can delete their own avatars" on storage.objects;
create policy "Users can delete their own avatars"
on storage.objects for delete
to authenticated
using ( bucket_id = 'avatars' and auth.uid() = owner );
