-- Private, append-only receipts for closing reports. No report reason or reporter
-- identity is copied here or published in public.world_events.
create table public.operator_report_reviews (
 request_id uuid primary key,
 -- Keep the audited subject even if an operator later removes the report.
 -- The transaction checks and locks the real report before accepting this row.
 report_id uuid not null,
 actor_id uuid references auth.users(id) on delete set null,
 from_state text not null default 'open' check(from_state='open'),
 to_state text not null check(to_state in ('resolved','dismissed')),
 created_at timestamptz not null default now()
);
create index operator_report_reviews_report_idx on public.operator_report_reviews(report_id,created_at desc);
create index operator_report_reviews_actor_idx on public.operator_report_reviews(actor_id) where actor_id is not null;
alter table public.operator_report_reviews enable row level security;
revoke all on table public.operator_report_reviews from public,anon,authenticated,service_role;
grant select,insert on table public.operator_report_reviews to service_role;

create function public.mb_review_report(p_actor uuid,p_report_id uuid,p_resolution text,p_request_id uuid) returns jsonb
language plpgsql security invoker set search_path=public,extensions as $$
declare v_profile public.profiles;v_report public.reports;v_review public.operator_report_reviews;v_new boolean;v_constraint text;
begin
 if p_actor is null then raise exception 'AUTH_REQUIRED' using errcode='PT401';end if;
 if p_report_id is null or p_request_id is null or p_resolution is null or p_resolution not in ('resolved','dismissed') then
  raise exception 'INVALID_REPORT_REVIEW' using errcode='PT400';
 end if;

 -- Insert a transaction-local claim first. Its existing Auth FK acquires a
 -- parent KEY SHARE lock without granting service_role SELECT on auth.users.
 -- Only then lock profiles, followed by reports, matching Auth deletion order.
 -- Any later denial/conflict rolls back this claim together with the action.
 begin
  insert into public.operator_report_reviews(request_id,report_id,actor_id,to_state)
   values(p_request_id,p_report_id,p_actor,p_resolution)
   on conflict(request_id) do nothing returning * into v_review;
  v_new:=found;
 exception when foreign_key_violation then
  get stacked diagnostics v_constraint=constraint_name;
  if v_constraint='operator_report_reviews_actor_id_fkey' then raise exception 'AUTH_REQUIRED' using errcode='PT401';end if;
  raise;
 end;

 -- Re-read current trusted permissions even on an idempotent retry. SHARE
 -- serializes revocation/suspension against an accepted new review. A replay
 -- needs no report lock and performs no new mutation.
 select * into v_profile from public.profiles where id=p_actor for share;
 if not found or not v_profile.is_operator then raise exception 'OPERATOR_REQUIRED' using errcode='42501';end if;
 if v_profile.suspended then raise exception 'ACCOUNT_SUSPENDED' using errcode='42501';end if;
 if not v_new then
  select * into v_review from public.operator_report_reviews where request_id=p_request_id;
  if not found or v_review.actor_id is distinct from p_actor or v_review.report_id<>p_report_id or v_review.to_state<>p_resolution then
   raise exception 'IDEMPOTENCY_CONFLICT' using errcode='PT409';
  end if;
  return jsonb_build_object('requestId',p_request_id,'reportId',p_report_id,'state',v_review.to_state,'reviewedAt',v_review.created_at,'replayed',true);
 end if;

 select * into v_report from public.reports where id=p_report_id for update;
 if not found then raise exception 'REPORT_UNAVAILABLE' using errcode='PT404';end if;
 if v_report.state<>'open' then raise exception 'REPORT_ALREADY_REVIEWED' using errcode='PT409';end if;
 update public.reports set state=p_resolution where id=p_report_id;
 return jsonb_build_object('requestId',p_request_id,'reportId',p_report_id,'state',p_resolution,'reviewedAt',v_review.created_at,'replayed',false);
end $$;
revoke all on function public.mb_review_report(uuid,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.mb_review_report(uuid,uuid,text,uuid) to service_role;
