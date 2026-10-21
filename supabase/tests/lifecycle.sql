-- Runs inside the test runner's BEGIN/ROLLBACK, with a disposable Auth actor.
-- No test memories, activity, budget rows, or fake stored assets are committed.
do $test$
declare
 actor uuid:=current_setting('memory_box.test_actor')::uuid;
 a jsonb;b jsonb;c jsonb;shared_asset jsonb;orphan jsonb;staged jsonb;fresh jsonb;
 m1 jsonb;m2 jsonb;result jsonb;before_revision bigint;before_jobs integer;
 before_attempts integer;after_attempts integer;budget_used integer;
 ids uuid[];exhausted_id uuid;blocked boolean;stale boolean;
begin
 result:=public.mb_lease_index_jobs_budget(10,actor,'test_index_cap',2,'{}'::uuid[]);
 assert jsonb_array_length(result)=0,'no due jobs returns an empty batch';
 assert not exists(select 1 from public.rate_budgets where actor_id=actor and kind='test_index_cap'),'no jobs reserves no daily budget';

 a:=public.mb_create_memory(actor,jsonb_build_object('clientId',gen_random_uuid(),'type','text','title','Lifecycle A','body','Same saved words.','color','#F0DE8E','x',1100,'y',640,'sceneId','garden'));
 b:=public.mb_create_memory(actor,jsonb_build_object('clientId',gen_random_uuid(),'type','text','title','Lifecycle B','body','Another fixture.','color','#BDCFAB','x',1100,'y',640,'sceneId','garden'));
 c:=public.mb_create_memory(actor,jsonb_build_object('clientId',gen_random_uuid(),'type','text','title','Lifecycle C','body','A third fixture.','color','#BED5DE','x',1100,'y',640,'sceneId','garden'));
 ids:=array[(a->>'id')::uuid,(b->>'id')::uuid,(c->>'id')::uuid];
 select revision into before_revision from public.worlds where id='commons';
 select count(*) into before_jobs from public.index_jobs where memory_id=(a->>'id')::uuid;
 result:=public.mb_update_memory(actor,(a->>'id')::uuid,1,jsonb_build_object('title','  Lifecycle A  ','body',' Same saved words. ','color','#f0de8e','x',1100,'y',640,'sceneId','garden'));
 assert result->>'version'='1' and result->>'updatedAt'=a->>'updatedAt','normalized no-op retains source version and timestamp';
 assert (select revision=before_revision from public.worlds where id='commons'),'no-op does not emit a world revision';
 assert (select count(*)=before_jobs from public.index_jobs where memory_id=(a->>'id')::uuid),'no-op adds no indexing work';
 result:=public.mb_update_memory(actor,(a->>'id')::uuid,1,jsonb_build_object('body','Changed authored words.'));
 stale:=false;
 begin
  perform public.mb_update_memory(actor,(a->>'id')::uuid,1,jsonb_build_object('body','Changed authored words.'));
 exception when sqlstate 'PT409' then stale:=true;end;
 assert stale,'stale expected version still conflicts even if the requested values equal the current source';

 result:=public.mb_lease_index_jobs_budget(10,actor,'test_index_cap',2,ids);
 assert jsonb_array_length(result)=2,'a batch leases only remaining global allowance';
 select used into budget_used from public.rate_budgets where actor_id=actor and kind='test_index_cap' and bucket=floor(extract(epoch from now())/86400);
 assert budget_used=2,'one reservation is charged for each actual leased job';
 select sum(attempts) into before_attempts from public.index_jobs where memory_id=any(ids);
 result:=public.mb_lease_index_jobs_budget(10,actor,'test_index_cap',2,ids);
 select sum(attempts) into after_attempts from public.index_jobs where memory_id=any(ids);
 assert jsonb_array_length(result)=0 and before_attempts=after_attempts,'exhausted daily budget does not burn pending attempts';
 assert exists(select 1 from public.index_jobs where memory_id=any(ids) and status='pending' and attempts=0),'unleased work stays pending for a new day';
 -- Move only this isolated test budget to yesterday to exercise day rollover.
 update public.rate_budgets set bucket=bucket-1 where actor_id=actor and kind='test_index_cap';
 result:=public.mb_lease_index_jobs_budget(10,actor,'test_index_cap',2,ids);
 assert jsonb_array_length(result)=1,'due work resumes in a fresh daily bucket';

 exhausted_id:=(result->0->>'memory_id')::uuid;
 update public.index_jobs set attempts=4,status='processing',lease_until=now()-interval '1 second' where memory_id=exhausted_id and status='processing';
 update public.memories set index_status='pending' where id=exhausted_id;
 result:=public.mb_lease_index_jobs_budget(10,actor,'test_index_cap',2,array[exhausted_id]);
 assert jsonb_array_length(result)=0,'an expired fourth lease is not retried';
 assert exists(select 1 from public.index_jobs where memory_id=exhausted_id and attempts=4 and status='failed' and lease_until is null),'exhausted processing lease becomes failed without another attempt';
 assert (select index_status='failed' from public.memories where id=exhausted_id),'matching current source reflects terminal index failure';
 assert (select used=1 from public.rate_budgets where actor_id=actor and kind='test_index_cap' and bucket=floor(extract(epoch from now())/86400)),'terminal lease cleanup reserves no inference budget';

 shared_asset:=public.mb_create_asset(actor,'fixture-shared.png','image/png',256);
 shared_asset:=public.mb_ready_asset(actor,(shared_asset->>'id')::uuid,jsonb_build_object('path',actor::text||'/shared.webp','mime','image/webp','size',256,'width',8,'height',8));
 m1:=public.mb_create_memory(actor,jsonb_build_object('clientId',gen_random_uuid(),'type','image','title','Shared image one','body','','assetId',shared_asset->>'id','color','#F0DE8E','x',1100,'y',640,'sceneId','garden'));
 m2:=public.mb_create_memory(actor,jsonb_build_object('clientId',gen_random_uuid(),'type','image','title','Shared image two','body','','assetId',shared_asset->>'id','color','#BDCFAB','x',1100,'y',640,'sceneId','garden'));
 perform public.mb_delete_memory(actor,(m1->>'id')::uuid);
 assert public.mb_readable_asset((shared_asset->>'id')::uuid) is not null,'deleting one memory preserves another published original using the asset';
 update public.assets set created_at=now()-interval '25 hours' where id=(shared_asset->>'id')::uuid;
 update public.profiles set is_operator=true where id=actor;
 perform public.mb_moderate(actor,'hide',(m2->>'id')::uuid);
 result:=public.mb_claim_asset_cleanup(25,array[(shared_asset->>'id')::uuid]);
 assert jsonb_array_length(result)=0,'a hidden memory protects its immutable asset from cleanup';
 assert (select status='ready' from public.assets where id=(shared_asset->>'id')::uuid),'hidden source retains a ready asset for restoration';
 perform public.mb_moderate(actor,'restore',(m2->>'id')::uuid);
 assert public.mb_readable_asset((shared_asset->>'id')::uuid) is not null,'restoring a hidden source restores public asset eligibility';
 perform public.mb_delete_memory(actor,(m2->>'id')::uuid);
 result:=public.mb_claim_asset_cleanup(25,array[(shared_asset->>'id')::uuid]);
 assert jsonb_array_length(result)=1,'last deleted reference permits an aged asset cleanup claim';
 assert public.mb_complete_asset_cleanup((shared_asset->>'id')::uuid),'claimed cleanup can be completed';
 assert jsonb_array_length(public.mb_claim_asset_cleanup(25,array[(shared_asset->>'id')::uuid]))=0,'completed cleanup is not claimed repeatedly';

 orphan:=public.mb_create_asset(actor,'fixture-orphan.png','image/png',256);
 orphan:=public.mb_ready_asset(actor,(orphan->>'id')::uuid,jsonb_build_object('path',actor::text||'/orphan.webp','mime','image/webp','size',256,'width',8,'height',8));
 update public.assets set created_at=now()-interval '25 hours' where id=(orphan->>'id')::uuid;
 result:=public.mb_claim_asset_cleanup(25,array[(orphan->>'id')::uuid]);
 assert jsonb_array_length(result)=1 and result->0->>'path'=actor::text||'/orphan.webp','orphan claim returns the exact private storage path';
 blocked:=false;
 begin
  perform public.mb_create_memory(actor,jsonb_build_object('clientId',gen_random_uuid(),'type','image','title','Must not publish','body','','assetId',orphan->>'id','color','#F0DE8E','x',1100,'y',640,'sceneId','garden'));
 exception when insufficient_privilege then
  if sqlerrm='ASSET_UNAVAILABLE' then blocked:=true;else raise;end if;
 end;
 assert blocked,'a claimed asset cannot be published while removal is pending';
 assert jsonb_array_length(public.mb_claim_asset_cleanup(25,array[(orphan->>'id')::uuid]))=0,'active cleanup claim is not delivered twice immediately';
 update public.assets set cleanup_claimed_at=now()-interval '16 minutes' where id=(orphan->>'id')::uuid;
 assert jsonb_array_length(public.mb_claim_asset_cleanup(25,array[(orphan->>'id')::uuid]))=1,'abandoned cleanup claims can retry after the lease';

 staged:=public.mb_create_asset(actor,'fixture-staged.png','image/png',256);
 fresh:=public.mb_create_asset(actor,'fixture-fresh.png','image/png',256);
 update public.assets set created_at=now()-interval '25 hours' where id=(staged->>'id')::uuid;
 result:=public.mb_claim_asset_cleanup(25,array[(staged->>'id')::uuid,(fresh->>'id')::uuid]);
 assert jsonb_array_length(result)=1 and result->0->>'id'=staged->>'id' and result->0->'path'='null'::jsonb,'only the expired staging asset is reclaimed';

 -- Reclamation must outpace the public pilot's 60-upload daily ceiling. These
 -- rollback-only metadata fixtures create no Storage objects or provider calls.
 with batch as (
  insert into public.assets(owner_id,name,staging_path,mime,size,created_at)
  select actor,'fixture-capacity.png',actor::text||'/'||gen_random_uuid()::text||'.upload','image/png',256,now()-interval '25 hours'
  from generate_series(1,61) returning id
 ) select array_agg(id) into ids from batch;
 result:=public.mb_claim_asset_cleanup(100,ids);
 assert jsonb_array_length(result)=61,'one configured cleanup batch can drain more than the daily upload allowance';
end $test$;
select 'PASS: isolated real-DB global lease cap, day rollover, no-op/stale edits, exhausted leases, shared assets, hidden refs, cleanup fencing, retry and expiry' as result;
