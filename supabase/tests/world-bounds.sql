-- Execute inside BEGIN/ROLLBACK with two disposable existing Auth actors.
-- Every paint, source, asset metadata row, report, event, and budget is rolled back.
do $test$
declare
 actor uuid:=current_setting('memory_box.test_actor')::uuid;
 other_actor uuid:=current_setting('memory_box.test_other_actor')::uuid;
 a jsonb;b jsonb;c jsonb;source jsonb;response jsonb;photo jsonb;asset jsonb;
 snapshot jsonb;changes jsonb;original jsonb;bad jsonb;
 op_id text:=gen_random_uuid()::text;
 cell_input jsonb:='[{"x":-9998,"y":-9998,"color":"#3659DB"},{"x":-9997,"y":-9998,"color":"#3659DB"},{"x":9999,"y":9999,"color":"#FFF3BF"}]';
 initial_revision bigint;initial_epoch integer;blocked boolean;report_id uuid;
begin
 -- Holding the same world lock as actual writes keeps the regression isolated.
 select revision,public_epoch into initial_revision,initial_epoch from public.worlds where id='commons' for update;
 update public.worlds set painting_paused=false where id='commons';
 perform public.mb_profile(actor);perform public.mb_profile(other_actor);
 original:=public.mb_snapshot();
 assert original->>'width'='1200' and original->>'height'='720' and original->>'gridSize'='6','entry framing stays compatible';

 -- A guaranteed blank fixture, restored by the outer transaction rollback.
 delete from public.cells where world_id='commons' and ((x=-9998 and y=-9998) or (x=-9997 and y=-9998));
 a:=public.mb_apply_paint(actor,op_id,cell_input,'mixtape');
 assert a->>'operationId'=public.mb_apply_paint(actor,op_id,cell_input,'mixtape')->>'operationId','signed paint retries are idempotent';
 blocked:=false;
 begin
  perform public.mb_apply_paint(actor,op_id,'[{"x":-9998,"y":-9998,"color":"#FFFFFF"}]','mixtape');
 exception when unique_violation then blocked:=true;end;
 assert blocked,'an altered retry cannot reuse a client operation id';
 b:=public.mb_apply_paint(other_actor,gen_random_uuid()::text,'[{"x":-9998,"y":-9998,"color":"#BDA9E9"}]','mixtape');
 c:=public.mb_undo_paint(actor,(a->>'operationId')::uuid);
 assert c->>'restored'='2' and c->>'skipped'='1','signed partial undo restores only cells still owned by its original operation';
 assert (select color='#BDA9E9' and operation_id=(b->>'operationId')::uuid from public.cells where world_id='commons' and x=-9998 and y=-9998),'second human edit survives undo';
 assert (select color='#FFFFFF' from public.cells where world_id='commons' and x=-9997 and y=-9998),'new blank-cell undo uses a neutral white background';
 blocked:=false;
 begin perform public.mb_undo_paint(other_actor,(a->>'operationId')::uuid);
 exception when insufficient_privilege then blocked:=true;end;
 assert blocked,'another author still cannot undo the original operation';

 perform public.mb_apply_paint(actor,gen_random_uuid()::text,'[{"x":-10000,"y":-10000,"color":"#292B3A"},{"x":200,"y":120,"color":"#FFFFFF"},{"x":9999,"y":9999,"color":"#E7ABC6"}]',null);
 foreach bad in array array[
  '[{"x":-10001,"y":0,"color":"#FFFFFF"}]'::jsonb,
  '[{"x":10000,"y":0,"color":"#FFFFFF"}]'::jsonb,
  '[{"x":0,"y":-10001,"color":"#FFFFFF"}]'::jsonb,
  '[{"x":0,"y":10000,"color":"#FFFFFF"}]'::jsonb,
  '[{"x":0.5,"y":0,"color":"#FFFFFF"}]'::jsonb,
  '[{"x":"-1","y":0,"color":"#FFFFFF"}]'::jsonb,
  '[{"x":null,"y":0,"color":"#FFFFFF"}]'::jsonb,
  '[{"x":99999999999999999999,"y":0,"color":"#FFFFFF"}]'::jsonb
 ] loop
  blocked:=false;
  begin perform public.mb_apply_paint(actor,gen_random_uuid()::text,bad,null);
  exception when raise_exception then blocked:=(sqlerrm='INVALID_CELL');end;
  assert blocked,'invalid signed paint rejects cleanly before storage or integer overflow';
 end loop;
 blocked:=false;
 begin
  perform public.mb_apply_paint(actor,gen_random_uuid()::text,'[{"x":1,"y":-1,"color":"#FFFFFF"},{"x":1.0,"y":-1,"color":"#FFFFFF"}]',null);
 exception when raise_exception then blocked:=(sqlerrm='DUPLICATE_CELLS');end;
 assert blocked,'equivalent integer coordinates cannot duplicate a cell';

 source:=public.mb_create_memory(actor,jsonb_build_object('clientId',gen_random_uuid(),'type','text','title','Signed source fixture','body','signedworldfixture original words','color','#FFF3BF','x',-60000,'y',-60000,'sceneId','pond'));
 response:=public.mb_create_memory(other_actor,jsonb_build_object('clientId',gen_random_uuid(),'type','text','title','Signed reply fixture','body','A separately authored response.','color','#EDE6FF','x',59999,'y',59999,'sceneId','garden','inspiredBy',source->>'id'));
 assert source->>'authorId'=actor::text and response->>'authorId'=other_actor::text and response->>'inspiredBy'=source->>'id','separate authorship and lineage survive distant placement';
 asset:=public.mb_create_asset(actor,'signed-fixture.png','image/png',256);
 asset:=public.mb_ready_asset(actor,(asset->>'id')::uuid,jsonb_build_object('path',actor::text||'/signed-fixture.webp','mime','image/webp','size',256,'width',8,'height',8));
 photo:=public.mb_create_memory(actor,jsonb_build_object('clientId',gen_random_uuid(),'type','image','title','Signed image fixture','body','Authored image caption.','assetId',asset->>'id','color','#F8E2EB','x',-4800,'y',3600,'sceneId','pond'));
 assert public.mb_readable_asset((asset->>'id')::uuid) is not null and photo->>'imageUrl'='/api/assets/'||(asset->>'id'),'distant published image keeps ordinary asset access rules';
 foreach bad in array array[
  '{"x":-60001,"y":0}'::jsonb,'{"x":60000,"y":0}'::jsonb,
  '{"x":0,"y":-60001}'::jsonb,'{"x":0,"y":60000}'::jsonb
 ] loop
  blocked:=false;
  begin
   perform public.mb_create_memory(actor,jsonb_build_object('clientId',gen_random_uuid(),'type','text','title','Out of bounds fixture','body','Rejected.','color','#FFF3BF','sceneId','pond')||bad);
  exception when check_violation then blocked:=true;end;
  assert blocked,'memory table constraints reject points beyond the plane';
 end loop;
 -- Existing hybrid RPC must find a signed source without model inference.
 if to_regprocedure('public.mb_search(text,extensions.vector,text,integer,text)') is not null then
  assert (public.mb_search('signedworldfixture',null,null,12,'supabase/gte-small:padded1536')->'results') @> jsonb_build_array(jsonb_build_object('memory',jsonb_build_object('id',source->>'id'))),'keyword search does not discard signed sources';
 end if;
 snapshot:=public.mb_snapshot();
 assert snapshot->'pixels' @> '[{"x":-10000,"y":-10000}]'::jsonb and snapshot->'pixels' @> '[{"x":9999,"y":9999}]'::jsonb,'snapshot includes both signed paint edges';
 assert snapshot->'memories' @> jsonb_build_array(jsonb_build_object('id',source->>'id','x',-60000)) and snapshot->'memories' @> jsonb_build_array(jsonb_build_object('id',response->>'id','x',59999)),'snapshot contains distant originals with unchanged ids';
 changes:=public.mb_changes(initial_revision,initial_epoch);
 assert changes->>'resync'='false' and changes->'pixels' @> '[{"x":-10000,"y":-10000}]'::jsonb,'revision deltas include signed cells';

 report_id:=public.mb_report(actor,'{"bounds":{"x":-10000,"y":-10000,"width":200,"height":120},"reason":"Signed area fixture report."}');
 assert exists(select 1 from public.reports where id=report_id and bounds->>'x'='-10000'),'reports retain signed area coordinates';
 foreach bad in array array[
  '{"x":9999,"y":0,"width":2,"height":1}'::jsonb,
  '{"x":0,"y":9999,"width":1,"height":2}'::jsonb,
  '{"x":0,"y":0,"width":201,"height":1}'::jsonb,
  '{"x":0,"y":0,"width":1,"height":121}'::jsonb,
  '{"x":-10001,"y":0,"width":1,"height":1}'::jsonb,
  '{"x":0,"y":0,"width":1.5,"height":1}'::jsonb,
  '{"x":0,"y":0,"width":1}'::jsonb,
  '{"x":null,"y":0,"width":1,"height":1}'::jsonb,
  'null'::jsonb
 ] loop
  assert not public.mb_valid_cell_bounds(bad),'bounds helper rejects malformed/oversized/overflowing rectangles';
  blocked:=false;
  begin perform public.mb_report(actor,jsonb_build_object('bounds',bad,'reason','Rejected fixture report.'));
  exception when raise_exception then blocked:=(sqlerrm='INVALID_BOUNDS');end;
  assert blocked,'report RPC enforces the same rectangle contract';
 end loop;
 blocked:=false;
 begin perform public.mb_moderate(other_actor,'clear',null,'{"x":-9998,"y":-9998,"width":1,"height":1}');
 exception when insufficient_privilege then blocked:=true;end;
 assert blocked,'area expansion does not grant moderation to guests';
 update public.profiles set is_operator=true where id=actor;
 blocked:=false;
 begin perform public.mb_moderate(actor,'clear',null,'{"x":9999,"y":9999,"width":2,"height":1}');
 exception when raise_exception then blocked:=(sqlerrm='INVALID_BOUNDS');end;
 assert blocked,'keeper clear validates the entire rectangle';
 perform public.mb_moderate(actor,'clear',null,'{"x":-9998,"y":-9998,"width":1,"height":1}');
 assert (select color='#FFFFFF' and operation_id is null from public.cells where world_id='commons' and x=-9998 and y=-9998),'signed keeper clear writes only the requested cell';
 assert public.mb_changes(initial_revision,initial_epoch)->>'resync'='true','clear still forces an epoch resync';
 blocked:=false;
 begin perform public.mb_undo_paint(other_actor,(b->>'operationId')::uuid);
 exception when raise_exception then blocked:=(sqlerrm='UNDO_UNAVAILABLE');end;
 assert blocked,'pre-clear undo remains unavailable';
 assert not has_function_privilege('anon','public.mb_valid_cell_bounds(jsonb)','execute') and not has_function_privilege('authenticated','public.mb_valid_cell_bounds(jsonb)','execute'),'new bounds helper is service-only';
 assert not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('mb_valid_cell_bounds','mb_apply_paint','mb_report','mb_moderate') and p.prosecdef),'changed functions remain security invoker';
end $test$;
select 'PASS: sparse signed world, overlap/undo, sources, assets, search, reports, and moderation' as result;
