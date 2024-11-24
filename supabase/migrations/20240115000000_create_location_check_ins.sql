-- Create location_check_ins table
create table if not exists public.location_check_ins (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    location_id bigint references public.locations(id) on delete cascade not null,
    checked_in_at timestamp with time zone default timezone('utc'::text, now()) not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create index for faster lookups
create index if not exists location_check_ins_user_id_idx on public.location_check_ins(user_id);
create index if not exists location_check_ins_location_id_idx on public.location_check_ins(location_id);

-- Create unique constraint to prevent duplicate check-ins
create unique index if not exists location_check_ins_user_location_unique_idx 
on public.location_check_ins(user_id, location_id);

-- Set up Row Level Security (RLS)
alter table public.location_check_ins enable row level security;

-- Create policies
create policy "Users can view their own check-ins"
    on public.location_check_ins for select
    using (auth.uid() = user_id);

create policy "Users can create their own check-ins"
    on public.location_check_ins for insert
    with check (auth.uid() = user_id);

-- Grant access to authenticated users
grant select, insert on public.location_check_ins to authenticated;
