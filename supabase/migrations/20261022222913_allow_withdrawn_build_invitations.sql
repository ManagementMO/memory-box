-- Withdrawal deliberately erases authored words while retaining a tombstone
-- for other authors' links. Only that lifecycle state may lack request text.
alter table public.memories drop constraint build_invitation_has_words;
alter table public.memories add constraint build_invitation_has_words
 check (visibility='deleted' or not is_build_invitation or body ~ '[^[:space:]]');
