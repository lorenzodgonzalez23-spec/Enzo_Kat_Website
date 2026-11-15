create table public.rsvp_submissions (
  id uuid primary key default gen_random_uuid(),
  respondent_name text not null check (char_length(btrim(respondent_name)) between 1 and 120),
  attendance text not null check (attendance in ('accepts', 'declines')),
  additional_guest_names text[] not null default '{}',
  additional_guest_count integer generated always as (cardinality(additional_guest_names)) stored,
  submitted_at timestamptz not null default now(),
  constraint rsvp_additional_guest_limit check (cardinality(additional_guest_names) between 0 and 6),
  constraint rsvp_declines_without_additional_guests check (
    attendance = 'accepts' or cardinality(additional_guest_names) = 0
  )
);

alter table public.rsvp_submissions enable row level security;
revoke all on table public.rsvp_submissions from anon, authenticated;
