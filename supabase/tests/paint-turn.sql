-- Run inside BEGIN/ROLLBACK with two disposable existing Auth actors. This
-- suite changes only its fixture records, and the outer rollback restores all.
do $test$
declare
 actor uuid:=current_setting('memory_box.test_actor')::uuid;
 other_actor uuid:=current_setting('memory_box.test_other_actor')::uuid;
 first_id text:=gen_random_uuid()::text; denied_id text:=gen_random_uuid()::text;
 cells jsonb:='[{"x":-9988,"y":-9988,"color":"#BDA9E9"},{"x":-9987,"y":-9988,"color":"#BDA9E9"}]';
 first_turn jsonb; after_turn jsonb; first_paint jsonb; second_paint jsonb;
 denied jsonb; replay jsonb; undone jsonb; retried jsonb; bad jsonb;
 initial_revision bigint; current_revision bigint; operation_count bigint;
 budget_used bigint; rejected boolean;
begin
 select revision into initial_revision from public.worlds where id='commons' for update;
 update public.worlds set painting_paused=false where id='commons';
 first_turn:=public.mb_paint_turn(actor);
 assert (first_turn->>'serverTime')::timestamptz=(first_turn->>'nextPaintAt')::timestamptz,'new actor is ready immediately';
 assert first_turn->>'cooldownSeconds'='15','turn duration is server policy';

 foreach bad in array array[
  '[{"x":10000,"y":0,"color":"#FFFFFF"}]'::jsonb,
  '[{"x":1.5,"y":0,"color":"#FFFFFF"}]'::jsonb,
  '[{"x":1,"y":0,"color":"invalid"}]'::jsonb,
  '[{"x":1,"y":0,"color":"#FFFFFF"},{"x":1,"y":0,"color":"#FFFFFF"}]'::jsonb,
  '[]'::jsonb, '{}'::jsonb,
  (select jsonb_agg(jsonb_build_object('x',n,'y',0,'color','#FFFFFF')) from generate_series(1,145)n)
 ] loop
  rejected:=false;
  begin perform public.mb_apply_paint(actor,gen_random_uuid()::text,bad,null);
  exception when raise_exception then rejected:=sqlerrm in ('INVALID_CELL','INVALID_PAINT','DUPLICATE_CELLS');end;
  assert rejected,'invalid input is rejected before it can spend a turn';
 end loop;
 rejected:=false;
 begin perform public.mb_apply_paint(actor,'undo:reserved',cells,null);
 exception when raise_exception then rejected:=sqlerrm='INVALID_PAINT';end;
 assert rejected,'forward writes cannot masquerade as an undo receipt';
 assert not exists(select 1 from public.paint_operations where actor_id=actor),'invalid requests did not create a paint receipt';
 after_turn:=public.mb_paint_turn(actor);
 assert (after_turn->>'nextPaintAt')::timestamptz<=(after_turn->>'serverTime')::timestamptz,'invalid requests did not start a timer';

 first_paint:=public.mb_apply_paint(actor,first_id,cells,'pond');
 assert first_paint->>'status'='accepted','valid first paint is accepted';
 assert (first_paint->>'nextPaintAt')::timestamptz-(first_paint->>'serverTime')::timestamptz=interval '15 seconds','accepted turn uses an exact fifteen-second interval';
 select revision into current_revision from public.worlds where id='commons';
 assert current_revision=initial_revision+1,'one actual paint advances one revision';
 select count(*) into operation_count from public.paint_operations where actor_id=actor;
 select coalesce(sum(used),0) into budget_used from public.rate_budgets where actor_id=actor;

 denied:=public.mb_apply_paint(actor,denied_id,cells,'pond');
 assert denied->>'status'='cooldown' and (denied->>'retryAfterMs')::integer between 1 and 15000,'same actor cannot repaint while cooling';
 assert denied->>'nextPaintAt'=first_paint->>'nextPaintAt','rejected paint does not reset the timer';
 assert (select revision from public.worlds where id='commons')=current_revision,'cooldown does not advance the world';
 assert (select count(*) from public.paint_operations where actor_id=actor)=operation_count,'cooldown does not reserve an operation id';
 assert (select coalesce(sum(used),0) from public.rate_budgets where actor_id=actor)=budget_used,'cooldown does not spend rate allowances';
 replay:=public.mb_apply_paint(actor,first_id,cells,'pond');
 assert replay->>'status'='accepted' and replay->>'operationId'=first_paint->>'operationId' and replay->>'revision'=first_paint->>'revision','lost acceptance can be replayed while cooling';
 assert replay->>'nextPaintAt'=first_paint->>'nextPaintAt','replay does not reset the timer';
 rejected:=false;
 begin perform public.mb_apply_paint(actor,first_id,'[{"x":-9988,"y":-9988,"color":"#FFFFFF"}]','pond');
 exception when unique_violation then rejected:=true;end;
 assert rejected,'different content cannot reuse an accepted operation id';

 second_paint:=public.mb_apply_paint(other_actor,gen_random_uuid()::text,'[{"x":-9988,"y":-9988,"color":"#FFF3BF"}]','pond');
 assert second_paint->>'status'='accepted','another actor gets an independent turn';
 undone:=public.mb_undo_paint(actor,(first_paint->>'operationId')::uuid);
 assert undone->>'restored'='1' and undone->>'skipped'='1','immediate undo preserves the other actor''s later edit';
 after_turn:=public.mb_paint_turn(actor);
 assert after_turn->>'nextPaintAt'=first_paint->>'nextPaintAt','undo neither refunds nor resets a forward turn';
 assert (public.mb_apply_paint(actor,denied_id,cells,'pond')->>'status')='cooldown','undo cannot make an early next turn';
 retried:=public.mb_undo_paint(actor,(first_paint->>'operationId')::uuid);
 assert retried->>'operationId'=undone->>'operationId' and retried->>'restored'='0','undo retry is idempotent';
 rejected:=false;
 begin perform public.mb_undo_paint(actor,(undone->>'operationId')::uuid);
 exception when raise_exception then rejected:=sqlerrm='UNDO_UNAVAILABLE';end;
 assert rejected,'an undo receipt cannot become a free redo loop';

 -- Artificial time advance affects only the exact rollback fixture; production
 -- has no clock-override parameter or privileged bypass in its mutation RPC.
 update public.paint_operations set created_at=clock_timestamp()-interval '16 seconds' where id=(first_paint->>'operationId')::uuid;
 after_turn:=public.mb_paint_turn(actor);
 assert (after_turn->>'nextPaintAt')::timestamptz<(after_turn->>'serverTime')::timestamptz,'the server clock replenishes the next turn';
 retried:=public.mb_apply_paint(actor,denied_id,cells,'pond');
 assert retried->>'status'='accepted' and retried->>'operationId'<>first_paint->>'operationId','a previously denied operation can be accepted when ready';
 assert (retried->>'nextPaintAt')::timestamptz-(retried->>'serverTime')::timestamptz=interval '15 seconds','a new accepted paint starts its own full turn';

 assert not has_function_privilege('anon','public.mb_paint_turn(uuid)','execute') and not has_function_privilege('authenticated','public.mb_paint_turn(uuid)','execute'),'browser roles cannot read another actor''s private timing';
 assert has_function_privilege('service_role','public.mb_paint_turn(uuid)','execute'),'verified application server can read timing';
 assert not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('mb_paint_turn','mb_apply_paint','mb_undo_paint') and p.prosecdef),'paint functions remain security invokers';
end $test$;
select 'PASS: authoritative paint turns, exact timing, replay, independent actors, invalid/cooldown no-op, immediate partial undo, and undo-loop denial' as result;
