-- Claudia editorial feedback memory: each post flag becomes a persistent lesson.
-- Store flag reason/note and post context; never change publication status.
create or replace function public.claudia_capture_flag_learning()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  post_title text;
  post_section text;
  post_topic text;
  learning text;
begin
  select title, section, topic into post_title, post_section, post_topic
  from public.news_posts where id = new.post_id;

  learning := 'Avoid repeating flagged editorial outcome. Flag reason: ' ||
    coalesce(nullif(new.reason, ''), 'unspecified') ||
    '. User feedback: ' || coalesce(nullif(new.note, ''), 'none provided') ||
    '. Flagged post title: ' || coalesce(post_title, '[title unavailable]') ||
    '. Section/topic: ' || coalesce(post_section, 'unknown') || '/' || coalesce(post_topic, 'unknown') ||
    '. Use this feedback to screen future story ideas, source reliability, framing, categorization, and duplicate coverage; do not treat the flagged post as a factual source.';

  insert into public.claudia_memories(content,kind,tags,importance,project,source_ref)
  values (
    left(learning, 5000),
    'lesson',
    array['flag_feedback','negative_example',coalesce(new.reason,'other')],
    5,
    '423.news',
    'news_flags:' || new.post_id::text
  );
  return new;
end;
$$;

drop trigger if exists claudia_flag_learning_after_insert on public.news_flags;
create trigger claudia_flag_learning_after_insert
after insert on public.news_flags
for each row execute function public.claudia_capture_flag_learning();

-- Backfill any existing flags, idempotently by source_ref.
insert into public.claudia_memories(content,kind,tags,importance,project,source_ref)
select
  left('Avoid repeating flagged editorial outcome. Flag reason: ' || coalesce(nullif(f.reason,''),'unspecified') ||
  '. User feedback: ' || coalesce(nullif(f.note,''),'none provided') ||
  '. Flagged post title: ' || coalesce(p.title,'[title unavailable]') ||
  '. Section/topic: ' || coalesce(p.section,'unknown') || '/' || coalesce(p.topic,'unknown') ||
  '. Screen future story ideas, sourcing, framing, categorization, and duplicates against this lesson.',5000),
  'lesson', array['flag_feedback','negative_example',coalesce(f.reason,'other')],5,'423.news','news_flags:'||f.post_id::text
from public.news_flags f left join public.news_posts p on p.id=f.post_id
where not exists (select 1 from public.claudia_memories m where m.source_ref='news_flags:'||f.post_id::text);
