-- Preserve the existing schema-v1 document; only ownership and atomic revisions are new.
create function public.worklog_valid_date(value text)
returns boolean language plpgsql immutable set search_path = '' as $$
begin
  return value ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' and to_char(value::date, 'YYYY-MM-DD') = value;
exception when others then return false;
end;
$$;

create function public.worklog_valid_document(payload jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare
  item jsonb;
  dates jsonb;
  field text;
  ids text[] := '{}';
  slots text[] := '{}';
  day text;
  kind text;
  source text;
begin
  if jsonb_typeof(payload) is distinct from 'object'
    or payload->'schemaVersion' is distinct from '1'::jsonb
    or jsonb_typeof(payload->'revision') is distinct from 'number'
    or (payload->>'revision')::numeric < 0
    or (payload->>'revision')::numeric > 9007199254740991
    or trunc((payload->>'revision')::numeric) <> (payload->>'revision')::numeric
    or not coalesce(public.worklog_valid_date(payload->>'generationStartDate'), false)
    or jsonb_typeof(payload->'items') is distinct from 'array'
  then return false; end if;
  foreach field in array array['processedDates', 'dayOffDates'] loop
    dates := payload->field;
    if jsonb_typeof(dates) is distinct from 'array' then return false; end if;
    if exists(select 1 from jsonb_array_elements(dates) d where jsonb_typeof(d) <> 'string'
      or not public.worklog_valid_date(d #>> '{}')) then return false; end if;
    if (select count(*) <> count(distinct d) from jsonb_array_elements(dates) d) then return false; end if;
  end loop;
  for item in select * from jsonb_array_elements(payload->'items') loop
    day := item->>'date'; kind := item->>'type'; source := item->>'source';
    if jsonb_typeof(item) <> 'object'
      or jsonb_typeof(item->'id') is distinct from 'string'
      or coalesce(length(trim(item->>'id')), 0) = 0
      or item->>'id' = any(ids)
      or not coalesce(public.worklog_valid_date(day), false)
      or kind is null or kind not in ('MEETING', 'WORK_ON_TASK', 'TODO')
    then return false; end if;
    ids := array_append(ids, item->>'id');
    foreach field in array array['createdAt', 'updatedAt'] loop
      if jsonb_typeof(item->field) is distinct from 'string'
        or (item->>field) !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T'
        or not isfinite((item->>field)::timestamptz)
      then return false; end if;
    end loop;
    if kind = 'TODO' then
      if source is distinct from 'MANUAL' or item->'defaultSlot' is distinct from 'null'::jsonb
        or jsonb_typeof(item->'title') is distinct from 'string'
        or length(trim(item->>'title')) = 0
        or jsonb_typeof(item->'completed') is distinct from 'boolean'
        or item ?| array['timeSpent', 'timeLog', 'storyId', 'name', 'storyPoints', 'status', 'note']
      then return false; end if;
    else
      if source is null or source not in ('AUTO', 'MANUAL')
        or jsonb_typeof(item->'timeSpent') is distinct from 'number'
        or (item->>'timeSpent')::numeric < 0
        or (item->>'timeSpent')::numeric > 9007199254740991
        or jsonb_typeof(item->'timeLog') is distinct from 'boolean'
        or payload->'dayOffDates' ? day
      then return false; end if;
      if source = 'AUTO' then
        if item->>'defaultSlot' is distinct from day || ':' || kind
          or not (payload->'processedDates' ? day)
          or extract(isodow from day::date) > 5
          or item->>'defaultSlot' = any(slots)
        then return false; end if;
        slots := array_append(slots, item->>'defaultSlot');
      elsif item->'defaultSlot' is distinct from 'null'::jsonb then return false;
      end if;
      if kind = 'WORK_ON_TASK' then
        if jsonb_typeof(item->'name') is distinct from 'string'
          or jsonb_typeof(item->'storyId') is distinct from 'string'
          or not (item ? 'storyPoints')
          or (item->'storyPoints' <> 'null'::jsonb and
            (jsonb_typeof(item->'storyPoints') <> 'number' or (item->>'storyPoints')::numeric < 0))
          or item->>'status' is null or item->>'status' not in ('TODO', 'IN_PROGRESS', 'DONE')
        then return false; end if;
      end if;
    end if;
  end loop;
  return true;
exception when others then return false;
end;
$$;

create table public.worklog_documents (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  document jsonb not null check (public.worklog_valid_document(document)),
  revision bigint not null check (revision > 0 and revision <= 9007199254740991),
  updated_at timestamptz not null default now(),
  constraint worklog_revision_matches check ((document->>'revision')::bigint = revision)
);
alter table public.worklog_documents enable row level security;
revoke all on public.worklog_documents from anon, authenticated;
grant select on public.worklog_documents to authenticated;
create policy worklog_owner_read on public.worklog_documents for select to authenticated
  using ((select auth.uid()) = owner_id);

-- SECURITY DEFINER is deliberate: authenticated users cannot bypass CAS through table writes.
-- The only writable owner comes from auth.uid(), never from the caller's payload.
create function public.save_worklog_document(payload jsonb, expected_revision bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  owner uuid := auth.uid();
  saved jsonb;
begin
  if owner is null then raise exception 'Sign in required' using errcode = '42501'; end if;
  if not public.worklog_valid_document(payload) then
    raise exception 'Invalid worklog document' using errcode = '22023';
  end if;
  if expected_revision is null then
    insert into public.worklog_documents(owner_id, document, revision)
      values(owner, jsonb_set(payload, '{revision}', '1'), 1)
      on conflict (owner_id) do nothing returning document into saved;
  else
    update public.worklog_documents
      set document = jsonb_set(payload, '{revision}', to_jsonb(revision + 1)),
          revision = revision + 1, updated_at = now()
      where owner_id = owner and revision = expected_revision
      returning document into saved;
  end if;
  if saved is null then raise exception 'Stale revision; reload and review' using errcode = '40001'; end if;
  return saved;
end;
$$;
revoke all on function public.save_worklog_document(jsonb, bigint) from public, anon;
grant execute on function public.save_worklog_document(jsonb, bigint) to authenticated;
revoke all on function public.worklog_valid_document(jsonb) from public, anon;
grant execute on function public.worklog_valid_document(jsonb) to authenticated;
revoke all on function public.worklog_valid_date(text) from public, anon;
grant execute on function public.worklog_valid_date(text) to authenticated;
