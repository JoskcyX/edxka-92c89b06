ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS auto_approve_until timestamptz;
COMMENT ON COLUMN public.classes.auto_approve_until IS 'While in the future, join requests are approved instantly (open-door window set by the tutor)';

CREATE OR REPLACE FUNCTION public.request_class_join(_class_id uuid, _name text, _phone text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare _id uuid;
begin
  insert into public.class_members (class_id, name, phone)
  values (_class_id, _name, coalesce(_phone, ''))
  on conflict (class_id, phone) do update set name = excluded.name, status = 'pending'
  returning id into _id;
  -- Open-door window active: approve immediately so the tutor never has to leave the live class.
  if exists (
    select 1 from public.classes c
    where c.id = _class_id and c.auto_approve_until > now()
  ) then
    update public.class_members set status = 'approved' where id = _id;
  end if;
  return _id;
end;
$$;