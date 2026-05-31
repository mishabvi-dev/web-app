create table public.materials (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  url text,
  created_by uuid references public.profiles(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Turn on RLS
alter table public.materials enable row level security;

-- Everyone can view materials
create policy "Materials are viewable by everyone" 
on public.materials for select 
using (true);

-- Only teachers can insert/delete materials (assuming they have role 'teacher' or we just let any authenticated user do it for simplicity in this prototype)
create policy "Authenticated users can create materials" 
on public.materials for insert 
to authenticated 
with check (true);

create policy "Users can delete their own materials" 
on public.materials for delete 
to authenticated 
using (auth.uid() = created_by);
