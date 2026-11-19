create table public.rsvp_invites (
  id uuid primary key default gen_random_uuid(),
  invite_name text not null check (char_length(btrim(invite_name)) between 1 and 120),
  code_hash text not null unique check (code_hash ~ '^[0-9a-f]{64}$'),
  max_additional_guests integer not null check (max_additional_guests between 0 and 6),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.rsvp_invites enable row level security;
revoke all on table public.rsvp_invites from anon, authenticated;

alter table public.rsvp_submissions
  add column invitation_id uuid references public.rsvp_invites(id),
  add column updated_at timestamptz not null default now(),
  add constraint rsvp_submissions_invitation_id_key unique (invitation_id);

create table public.rsvp_submission_history (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.rsvp_submissions(id),
  invitation_id uuid not null references public.rsvp_invites(id),
  change_type text not null check (change_type in ('submitted', 'updated')),
  old_values jsonb,
  new_values jsonb not null,
  changed_at timestamptz not null default now()
);

create index rsvp_submission_history_invitation_changed_idx
  on public.rsvp_submission_history (invitation_id, changed_at desc);

alter table public.rsvp_submission_history enable row level security;
revoke all on table public.rsvp_submission_history from anon, authenticated;

create function public.set_rsvp_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if row(new.respondent_name, new.attendance, new.additional_guest_names)
    is distinct from
    row(old.respondent_name, old.attendance, old.additional_guest_names) then
    new.updated_at := now();
  else
    new.updated_at := old.updated_at;
  end if;
  return new;
end;
$$;

create function public.record_rsvp_submission_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_values jsonb := null;
  history_type text;
begin
  if new.invitation_id is null then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if row(new.respondent_name, new.attendance, new.additional_guest_names)
      is not distinct from
      row(old.respondent_name, old.attendance, old.additional_guest_names) then
      return new;
    end if;
    previous_values := to_jsonb(old);
    history_type := 'updated';
  else
    history_type := 'submitted';
  end if;

  insert into public.rsvp_submission_history (
    submission_id,
    invitation_id,
    change_type,
    old_values,
    new_values
  )
  values (
    new.id,
    new.invitation_id,
    history_type,
    previous_values,
    to_jsonb(new)
  );

  return new;
end;
$$;

revoke all on function public.set_rsvp_updated_at() from public, anon, authenticated;
revoke all on function public.record_rsvp_submission_history() from public, anon, authenticated;

create trigger set_rsvp_updated_at
before update on public.rsvp_submissions
for each row execute function public.set_rsvp_updated_at();

create trigger record_rsvp_submission_history
after insert or update on public.rsvp_submissions
for each row execute function public.record_rsvp_submission_history();
