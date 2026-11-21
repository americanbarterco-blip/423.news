-- Safe single-task leasing and idempotent evidence writes for Claudia.
create or replace function public.claudia_claim_research_task(worker_id text)
returns setof public.claudia_research_tasks
language plpgsql security definer set search_path=public
as $$
begin
  return query
  with picked as (
    select id from public.claudia_research_tasks
    where status='queued' and available_at<=now() and attempt_count<max_attempts
    order by priority desc,available_at asc,created_at asc
    limit 1 for update skip locked
  )
  update public.claudia_research_tasks t
  set status='in_progress',locked_at=now(),locked_by=worker_id,
      attempt_count=attempt_count+1,updated_at=now()
  from picked where t.id=picked.id
  returning t.*;
end;
$$;
revoke all on function public.claudia_claim_research_task(text) from public,anon,authenticated;
grant execute on function public.claudia_claim_research_task(text) to service_role;

create unique index if not exists claudia_evidence_unique_url
on public.claudia_story_evidence(lead_id,evidence_type,url);
