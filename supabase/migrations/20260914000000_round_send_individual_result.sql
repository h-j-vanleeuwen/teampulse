-- Adds the "send individual result by email" toggle to rounds, and an
-- optional email column on responses so we keep a record of who a result
-- was sent to.
--
-- Run this in the Supabase Dashboard > SQL Editor (or via `supabase db push`
-- once the project is linked with the CLI).

alter table rounds
  add column if not exists send_individual_result boolean not null default false;

alter table responses
  add column if not exists email text;
