-- Removal scrubs an original's authored words and URL while retaining its stable
-- relation ID. Published/hidden contributions still satisfy their content rules.
alter table public.memories drop constraint memories_check1;
alter table public.memories drop constraint memories_check2;
alter table public.memories add constraint memories_text_content_check check (visibility='deleted' or type<>'text' or char_length(trim(body))>0);
alter table public.memories add constraint memories_link_content_check check (visibility='deleted' or type<>'link' or url is not null);
