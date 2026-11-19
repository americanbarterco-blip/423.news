-- Allow explicitly machine-published Spanish translations to be distinguishable from human approvals.
alter table public.news_translations drop constraint if exists news_translations_status_check;
alter table public.news_translations add constraint news_translations_status_check
  check (status in ('pending_review','approved','auto_published'));

drop policy if exists news_translations_public_approved_es on public.news_translations;
create policy news_translations_public_approved_es
  on public.news_translations
  for select to anon, authenticated
  using (locale = 'es' and status in ('approved','auto_published'));

comment on column public.news_translations.status is
  'pending_review: human draft; approved: human-approved; auto_published: machine-translated and automatically published.';
