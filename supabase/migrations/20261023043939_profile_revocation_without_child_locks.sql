-- Profile lookup must not hold a child-only KEY SHARE lock. Auth deletion
-- locks auth.users before cascading to profiles, while contribution inserts
-- subsequently check that same Auth parent. Reversing that order deadlocks.
-- Keep exact deleted-parent handling without expanding Auth privileges.
create or replace function public.mb_profile(p_actor uuid,p_name text default null) returns jsonb
language plpgsql security invoker set search_path=public,extensions as $$
declare r public.profiles; v_constraint text;
begin
 if p_actor is null then raise exception 'AUTH_REQUIRED' using errcode='PT401';end if;
 if p_name is not null and char_length(trim(p_name)) not between 1 and 32 then raise exception 'INVALID_NAME';end if;
 select * into r from public.profiles where id=p_actor;
 if not found then
  begin
   insert into public.profiles(id,name) values(p_actor,coalesce(trim(p_name),'guest-'||left(p_actor::text,5))) on conflict(id) do nothing;
  exception when foreign_key_violation then
   get stacked diagnostics v_constraint=constraint_name;
   if v_constraint='profiles_id_fkey' then raise exception 'AUTH_REQUIRED' using errcode='PT401';end if;
   raise;
  end;
  select * into r from public.profiles where id=p_actor;
  if not found then raise exception 'AUTH_REQUIRED' using errcode='PT401';end if;
 end if;
 if p_name is not null then
  update public.profiles set name=trim(p_name) where id=p_actor returning * into r;
  if not found then raise exception 'AUTH_REQUIRED' using errcode='PT401';end if;
 end if;
 if r.suspended then raise exception 'ACCOUNT_SUSPENDED' using errcode='42501';end if;
 return jsonb_build_object('id',r.id,'name',r.name,'isOperator',r.is_operator,'suspended',r.suspended);
end $$;
