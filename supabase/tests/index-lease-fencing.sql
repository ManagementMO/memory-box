-- The caller encloses this fixture in BEGIN/ROLLBACK and supplies one disposable
-- auth actor as memory_box.test_actor. No provider or Storage request is made.
do $test$
declare
 actor uuid:=current_setting('memory_box.test_actor')::uuid;
 m jsonb; changed jsonb; image_one jsonb; image_two jsonb; asset jsonb;
 first_lease jsonb; next_lease jsonb; leases jsonb; item jsonb; snapshot jsonb;
 target_memory uuid; job_id uuid; seed_id uuid:=gen_random_uuid();
 basis extensions.vector:=array_fill(0::double precision,array[1536])::extensions.vector;
 before_revision bigint; rejected_caption boolean;
begin
 assert not has_function_privilege('service_role','public.mb_complete_index_job(uuid,integer,text,extensions.vector,text)','EXECUTE'),'legacy unfenced completion is revoked from service_role';
 assert not has_function_privilege('service_role','public.mb_fail_index_job(uuid,text)','EXECUTE'),'legacy unfenced failure is revoked from service_role';
 assert has_function_privilege('service_role','public.mb_complete_index_job_leased(uuid,integer,integer,text,extensions.vector,text,text)','EXECUTE'),'service worker can complete its fenced lease';
 assert has_function_privilege('service_role','public.mb_fail_index_job_leased(uuid,integer,text)','EXECUTE'),'service worker can fail its fenced lease';
 assert not has_function_privilege('anon','public.mb_complete_index_job_leased(uuid,integer,integer,text,extensions.vector,text,text)','EXECUTE'),'anonymous caller cannot complete work';
 assert not has_function_privilege('authenticated','public.mb_fail_index_job_leased(uuid,integer,text)','EXECUTE'),'guest caller cannot fail work';

 m:=public.mb_create_memory(actor,jsonb_build_object('clientId',gen_random_uuid(),'type','text','title','Lease fixture','body','Only the current worker may finish.','color','#F0DE8E','x',100,'y',100,'sceneId','garden'));
 target_memory:=(m->>'id')::uuid;
 first_lease:=public.mb_lease_index_jobs_budget(1,actor,'test_index_fence',20,array[target_memory])->0;
 job_id:=(first_lease->>'id')::uuid;
 assert first_lease->>'attempts'='1','first lease has generation one';
 update public.index_jobs set lease_until=clock_timestamp()-interval '1 second' where id=job_id;
 assert not public.mb_complete_index_job_leased(job_id,1,1,'Expired text',basis,'test/fence',null),'an expired worker cannot finish before replacement';
 assert not public.mb_fail_index_job_leased(job_id,1,'expired'),'an expired worker cannot fail before replacement';
 next_lease:=public.mb_lease_index_jobs_budget(1,actor,'test_index_fence',20,array[target_memory])->0;
 assert next_lease->>'id'=first_lease->>'id' and next_lease->>'attempts'='2','replacement reuses the job with a new lease generation';
 select revision into before_revision from public.worlds where id='commons';
 assert not public.mb_fail_index_job_leased(job_id,1,'stale old worker'),'an old attempt cannot fail the replacement';
 assert not public.mb_complete_index_job_leased(job_id,1,1,'Stale old worker text',basis,'test/fence',null),'an old attempt cannot complete the replacement';
 assert exists(select 1 from public.index_jobs where id=job_id and status='processing' and attempts=2),'stale calls preserve the replacement lease';
 assert (select revision=before_revision from public.worlds where id='commons'),'rejected stale calls emit no revision';
 assert public.mb_complete_index_job_leased(job_id,1,2,'Current worker text',basis,'test/fence',null),'the replacement can complete';
 assert not public.mb_complete_index_job_leased(job_id,1,2,'Duplicate text',basis,'test/fence',null),'duplicate completion is a no-op';
 assert not public.mb_fail_index_job_leased(job_id,2,'late failure'),'completed work cannot be failed';
 assert exists(select 1 from public.index_jobs where id=job_id and status='complete'),'duplicate completion does not obsolete completed work';
 assert (select representation='Current worker text' from public.memory_embeddings where memory_id=(m->>'id')::uuid),'stale and duplicate workers do not replace the index';

 changed:=public.mb_update_memory(actor,target_memory,1,jsonb_build_object('body','A second source version.'));
 first_lease:=public.mb_lease_index_jobs_budget(1,actor,'test_index_fence',20,array[target_memory])->0;
 job_id:=(first_lease->>'id')::uuid;
 perform public.mb_update_memory(actor,target_memory,2,jsonb_build_object('body','A third source version.'));
 assert not public.mb_complete_index_job_leased(job_id,2,1,'Removed version',basis,'test/fence',null),'source edits still fence current-attempt completion';
 assert not exists(select 1 from public.memory_embeddings where memory_id=(m->>'id')::uuid),'stale source completion does not resurrect its vector';
 first_lease:=public.mb_lease_index_jobs_budget(1,actor,'test_index_fence',20,array[target_memory])->0;
 job_id:=(first_lease->>'id')::uuid;
 assert public.mb_fail_index_job_leased(job_id,1,'provider_unavailable'),'active failure schedules retry';
 assert exists(select 1 from public.index_jobs where id=job_id and status='failed' and available_at>now()),'failure retains retry backoff';

 asset:=public.mb_create_asset(actor,'caption-fixture.webp','image/webp',256);
 asset:=public.mb_ready_asset(actor,(asset->>'id')::uuid,jsonb_build_object('path',actor::text||'/caption-fixture.webp','mime','image/webp','size',256,'width',8,'height',8));
 image_one:=public.mb_create_memory(actor,jsonb_build_object('clientId',gen_random_uuid(),'type','image','title','First use','body','','assetId',asset->>'id','color','#F0DE8E','x',200,'y',100,'sceneId','garden'));
 image_two:=public.mb_create_memory(actor,jsonb_build_object('clientId',gen_random_uuid(),'type','image','title','Second use','body','','assetId',asset->>'id','color','#F0DE8E','x',300,'y',100,'sceneId','garden'));
 leases:=public.mb_lease_index_jobs_budget(2,actor,'test_index_fence',20,array[(image_one->>'id')::uuid,(image_two->>'id')::uuid]);
 for item in select value from jsonb_array_elements(leases) loop
  rejected_caption:=false;
  begin
   perform public.mb_complete_index_job_leased((item->>'id')::uuid,1,(item->>'attempts')::integer,'Missing image evidence',basis,'test/fence',null);
  exception when raise_exception then
   if sqlerrm='INVALID_IMAGE_DESCRIPTION' then rejected_caption:=true;else raise;end if;
  end;
  assert rejected_caption,'image jobs cannot be marked ready without visual evidence';
  assert public.mb_complete_index_job_leased((item->>'id')::uuid,1,(item->>'attempts')::integer,'Image evidence',basis,'test/fence',
   case when item->>'memory_id'=image_one->>'id' then 'A red bicycle.' else 'A blue bicycle.' end),'image completion accepts its own versioned description';
 end loop;
 assert (select description is null from public.assets where id=(asset->>'id')::uuid),'new completion never mutates the shared asset caption';
 update public.assets set description='A green bicycle.' where id=(asset->>'id')::uuid;
 select public.mb_memory_json(original) into snapshot from public.memories original where id=(image_one->>'id')::uuid;
 assert snapshot->>'imageDescription'='A red bicycle.' and snapshot->>'version'='1','legacy shared-caption drift cannot change accepted evidence for the first source';
 select public.mb_memory_json(original) into snapshot from public.memories original where id=(image_two->>'id')::uuid;
 assert snapshot->>'imageDescription'='A blue bicycle.' and snapshot->>'version'='1','a second original retains its own accepted evidence';
 -- Existing legacy captions remain readable without inferring historical seed
 -- descriptions or issuing any reindex request.
 update public.memory_embeddings set image_description=null where memory_id=(image_two->>'id')::uuid;
 select public.mb_memory_json(original) into snapshot from public.memories original where id=(image_two->>'id')::uuid;
 assert snapshot->>'imageDescription'='A green bicycle.','legacy asset evidence remains available until an explicit new index';

 insert into public.memories(id,author_id,author_name,client_id,request_hash,type,title,body,seed_image_url,color,x,y,scene_id,is_seed)
 values(seed_id,null,'Starter','test-caption-'||seed_id::text,'fixture','image','Seed image','','/seed-radio.svg','#F0DE8E',400,100,'garden',true);
 insert into public.index_jobs(memory_id,source_version) values(seed_id,1);
 first_lease:=public.mb_lease_index_jobs_budget(1,actor,'test_index_fence',20,array[seed_id])->0;
 assert public.mb_complete_index_job_leased((first_lease->>'id')::uuid,1,1,'Seed visual evidence',basis,'test/fence','A pink radio.'),'new trusted-seed indexing can store a verified description';
 select public.mb_memory_json(original) into snapshot from public.memories original where id=seed_id;
 assert snapshot->>'imageDescription'='A pink radio.','seed visual evidence reaches the same public source representation';
 assert exists(select 1 from public.world_events where memory_id=seed_id and description='is ready to discover in search' and is_seed),'index activity retains seed provenance';
end $test$;
select 'PASS: fenced attempts, expiry, stale source, duplicate completion, permissions, per-version captions, shared-asset drift and seed evidence' as result;
