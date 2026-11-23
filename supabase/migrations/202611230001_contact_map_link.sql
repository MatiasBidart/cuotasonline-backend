alter table public.contact
  add column if not exists map_link text;

alter table public.contact
  drop column if exists streets_between;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.contact'::regclass
      and conname = 'contact_map_link_http_url_check'
  ) then
    alter table public.contact
      add constraint contact_map_link_http_url_check
      check (map_link is null or map_link ~* '^https?://[^[:space:]]+$');
  end if;
end;
$$;

comment on column public.contact.map_link is
  'Optional HTTP or HTTPS URL for the contact location, such as a Google Maps link.';
