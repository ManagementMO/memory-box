-- Every fixture is rolled back. No public contribution is created.
begin;
do $$
declare actor uuid:=gen_random_uuid(); result jsonb; full_snapshot jsonb; snapshot_head jsonb;
begin
 insert into auth.users(id,aud,role,is_anonymous) values(actor,'authenticated','authenticated',true);
 result:=public.mb_profile(actor);
 if result->>'id'<>actor::text then raise exception 'Live profile did not resolve';end if;
 -- This is the same database boundary reached when Auth revocation wins
 -- between requireActor and its dependent paint-turn RPC.
 delete from auth.users where id=actor;
 begin
  perform public.mb_paint_turn(actor);
  raise exception 'Deleted actor unexpectedly received a paint turn';
 exception when sqlstate 'PT401' then
  if sqlerrm<>'AUTH_REQUIRED' then raise;end if;
 end;
 full_snapshot:=public.mb_snapshot();snapshot_head:=public.mb_snapshot_head();
 if full_snapshot-'pixels' is distinct from snapshot_head then raise exception 'Snapshot head changed public metadata';end if;
 if snapshot_head ? 'pixels' then raise exception 'Snapshot head must not serialize pixels';end if;
 if has_function_privilege('anon','public.mb_snapshot_head()','EXECUTE')
    or has_function_privilege('authenticated','public.mb_snapshot_head()','EXECUTE') then raise exception 'Snapshot head must remain server-only';end if;
end $$;
rollback;
