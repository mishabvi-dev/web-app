-- 1. Fix Deletion Policies for Teachers (Allowing any teacher to delete tasks/notes)
drop policy if exists "Teachers can delete tasks" on public.tasks;
create policy "Teachers can delete tasks"
on public.tasks for delete
to authenticated
using (true);

drop policy if exists "Teachers can delete notes" on public.notes;
create policy "Teachers can delete notes"
on public.notes for delete
to authenticated
using (true);

-- 2. Create the Storage Bucket for Materials
insert into storage.buckets (id, name, public) 
values ('materials', 'materials', true)
on conflict (id) do nothing;

-- 3. Set up Storage Policies for the Materials Bucket
create policy "Materials are publicly accessible"
on storage.objects for select
using ( bucket_id = 'materials' );

create policy "Authenticated users can upload materials"
on storage.objects for insert
to authenticated
with check ( bucket_id = 'materials' );

create policy "Users can delete their own materials"
on storage.objects for delete
to authenticated
using ( bucket_id = 'materials' and auth.uid() = owner );
