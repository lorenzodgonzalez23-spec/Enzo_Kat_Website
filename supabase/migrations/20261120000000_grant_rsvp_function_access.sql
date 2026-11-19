grant select on table public.rsvp_invites to service_role;

grant select, insert, update
  on table public.rsvp_submissions
  to service_role;
