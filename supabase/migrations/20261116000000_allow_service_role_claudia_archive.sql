-- Allow trusted server-side service-role inserts while preserving Claudia's
-- supplied permanent slug, author, and original report timestamp.
-- Ordinary signed-in users retain the existing author/rate-limit workflow.

create or replace function public.news_posts_before_insert()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  nm text;
  recent int;
begin
  if auth.uid() is null then
    if coalesce(auth.role(), '') <> 'service_role' then
      raise exception 'sign in required';
    end if;

    -- The authenticated admin Edge Function uses the service-role key.
    -- Keep its explicitly supplied archive fields instead of replacing them
    -- with an anonymous visitor or a newly generated slug.
    new.author_name := coalesce(nullif(new.author_name, ''), 'Neighbor');
    if new.slug is null or new.slug = '' then
      new.slug := left(regexp_replace(lower(new.title), '[^a-z0-9]+', '-', 'g'), 60)
                  || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
    end if;
    new.created_at := coalesce(new.created_at, now());
    new.updated_at := now();
    return new;
  end if;

  select display_name into nm
  from public.news_profiles
  where id = auth.uid();

  new.author_id := auth.uid();
  new.author_name := coalesce(nm, 'Neighbor');
  new.slug := left(regexp_replace(lower(new.title), '[^a-z0-9]+', '-', 'g'), 60)
              || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);

  if not public.news_is_staff() then
    select count(*) into recent
    from public.news_posts
    where author_id = auth.uid()
      and created_at > now() - interval '1 hour';

    if recent >= 10 then
      raise exception 'You are posting too fast. Please wait a bit and try again.';
    end if;

    new.status := case
      when new.section = 'sports' then 'published'
      when new.video_url is not null then 'pending'
      when new.section in ('community', 'classifieds') then 'published'
      else 'pending'
    end;
  end if;

  new.created_at := now();
  new.updated_at := now();
  return new;
end
$function$;
