-- Run inside BEGIN/ROLLBACK with memory_box.test_actor set by the test runner.
-- Only metadata fixtures: no Storage object, guest, or provider writes.
do $test$
declare
 actor uuid:=current_setting('memory_box.test_actor')::uuid;
 old_asset uuid:=gen_random_uuid();fresh_asset uuid:=gen_random_uuid();pending_asset uuid:=gen_random_uuid();
 ids uuid[];result jsonb;first_token uuid;second_token uuid;memory jsonb;
 canonical text;staging text;
begin
 canonical:=actor::text||'/'||old_asset::text||'.webp';
 staging:=actor::text||'/'||old_asset::text||'.upload';
 insert into public.assets(id,owner_id,name,staging_path,path,mime,size,width,height,status,created_at) values
 (old_asset,actor,'ready-old.png',staging,canonical,'image/webp',256,8,8,'ready',now()-interval '4 hours'),
 (fresh_asset,actor,'ready-fresh.png',actor::text||'/'||fresh_asset::text||'.upload',actor::text||'/'||fresh_asset::text||'.webp','image/webp',256,8,8,'ready',now()-interval '1 hour'),
 (pending_asset,actor,'pending.png',actor::text||'/'||pending_asset::text||'.upload',null,'image/png',256,null,null,'staging',now()-interval '4 hours');
 ids:=array[old_asset,fresh_asset,pending_asset];
 memory:=public.mb_create_memory(actor,jsonb_build_object('clientId',gen_random_uuid(),'type','image','title','Ready staging fixture','body','','assetId',old_asset,'color','#FFED9C','x',100,'y',100,'sceneId','pond'));

 result:=public.mb_claim_ready_staging_cleanup(100,ids);
 assert jsonb_array_length(result)=1 and result->0->>'id'=old_asset::text,'only an expired-token ready asset is claimed';
 assert result->0->>'staging_path'=staging and not (result->0?'path'),'the claim exposes only the exact raw path, never canonical bytes';
 first_token:=(result->0->>'claim_token')::uuid;
 assert jsonb_array_length(public.mb_claim_ready_staging_cleanup(100,ids))=0,'an active lease is not handed to another worker';
 assert not public.mb_complete_ready_staging_cleanup(old_asset,gen_random_uuid()),'an unrelated token cannot complete cleanup';
 assert (select staging_cleanup_completed_at is null from public.assets where id=old_asset),'failed cleanup remains retryable';

 update public.assets set staging_cleanup_claimed_at=now()-interval '16 minutes' where id=old_asset;
 result:=public.mb_claim_ready_staging_cleanup(100,ids);
 second_token:=(result->0->>'claim_token')::uuid;
 assert jsonb_array_length(result)=1 and second_token<>first_token,'an expired lease retries with a fresh token';
 assert not public.mb_complete_ready_staging_cleanup(old_asset,first_token),'the stale worker cannot complete the renewed lease';
 assert public.mb_complete_ready_staging_cleanup(old_asset,second_token),'the current worker can complete exact staging removal';
 assert jsonb_array_length(public.mb_claim_ready_staging_cleanup(100,ids))=0,'completed raw cleanup is not claimed again';
 assert (select status='ready' and path=canonical from public.assets where id=old_asset),'ready status and canonical image path are untouched';
 assert public.mb_readable_asset(old_asset) is not null,'published sanitized image remains readable';
 assert (select asset_id=old_asset and visibility='published' from public.memories where id=(memory->>'id')::uuid),'published reference remains intact';
 update public.memories set visibility='hidden' where id=(memory->>'id')::uuid;
 assert (select status='ready' and path=canonical from public.assets where id=old_asset),'hidden originals also retain their canonical image for restoration';
 assert not has_function_privilege('anon','public.mb_claim_ready_staging_cleanup(integer,uuid[])','EXECUTE'),'anonymous clients cannot claim raw cleanup';
 assert not has_function_privilege('authenticated','public.mb_complete_ready_staging_cleanup(uuid,uuid)','EXECUTE'),'authenticated clients cannot complete cleanup';
end $test$;
select 'PASS: ready staging expiry, exact paths, claim retry and fencing, published/hidden asset retention, service-only access' as result;
