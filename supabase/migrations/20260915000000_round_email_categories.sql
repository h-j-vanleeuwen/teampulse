-- Lets the admin choose which Lencioni categories are revealed in the
-- individual result email (independently of which questions the round asks).
-- Same text+JSON pattern as rounds.questions, for consistency.
--
-- Run this in the Supabase Dashboard > SQL Editor.

alter table rounds
  add column if not exists email_categories text not null
  default '["Confiance","Conflit","Engagement","Responsabilite","Resultats"]';
