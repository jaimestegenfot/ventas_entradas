

create table if not exists public.lab_events (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  description text not null default '',
  venue text not null,
  starts_at timestamptz not null,
  price_cents integer not null check (price_cents >= 0),
  capacity integer not null check (capacity >= 0),
  accent text not null default 'violet'
);
alter table public.lab_events
  add column if not exists is_test boolean not null default false;

create table if not exists public.lab_queue (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.lab_events(id) on delete cascade,
  visitor_id uuid not null,
  status text not null default 'waiting' check (status in ('waiting', 'admitted', 'used', 'expired')),
  joined_at timestamptz not null default now(),
  admitted_until timestamptz,
  unique (event_id, visitor_id)
);
create index if not exists idx_lab_queue_event on public.lab_queue(event_id, status, joined_at);

create table if not exists public.lab_reservations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.lab_events(id) on delete cascade,
  queue_id uuid not null references public.lab_queue(id) on delete cascade,
  request_key uuid not null unique,
  status text not null default 'held' check (status in ('held','confirmed','expired')),
  held_until timestamptz not null,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);
create index if not exists idx_lab_reservations_event on public.lab_reservations(event_id, status, held_until);

create table if not exists public.lab_payments (
  reservation_id uuid primary key references public.lab_reservations(id) on delete cascade,
  mock_reference uuid not null unique default gen_random_uuid(),
  confirmed_at timestamptz not null default now()
);

-- Bloquear tablas a clientes públicos. El backend accede con secret key.
alter table public.lab_events enable row level security;
alter table public.lab_queue enable row level security;
alter table public.lab_reservations enable row level security;
alter table public.lab_payments enable row level security;
revoke all on public.lab_events, public.lab_queue, public.lab_reservations, public.lab_payments from anon, authenticated;


-- A) Consulta de eventos con inventario calculado en la base de datos.
create or replace function public.lab_list_events()
returns jsonb language sql security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', e.id, 'slug', e.slug, 'title', e.title,
    'description', e.description, 'venue', e.venue,
    'startsAt', e.starts_at, 'priceCents', e.price_cents,
    'capacity', e.capacity, 'accent', e.accent, 'isTest', e.is_test,
    'available', greatest(0, e.capacity - (
      select count(*) from public.lab_reservations r
      where r.event_id = e.id
      and (r.status = 'confirmed' or (r.status = 'held' and r.held_until > now()))
    ))
  ) order by e.starts_at), '[]'::jsonb)
  from public.lab_events e;
$$;

-- B) Entrada única a la fila por visitante y evento.
create or replace function public.lab_queue_join(p_event_id uuid, p_visitor_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform 1 from public.lab_events where id = p_event_id;
  if not found then raise exception 'EVENTO_NO_ENCONTRADO'; end if;

  -- Puede reingresar después de consumir o expirar su turno.
  insert into public.lab_queue(event_id, visitor_id)
  values (p_event_id, p_visitor_id)
  on conflict (event_id, visitor_id) do update
  set status = case
      when public.lab_queue.status in ('used', 'expired')
        or (public.lab_queue.status = 'admitted' and public.lab_queue.admitted_until <= now())
      then 'waiting' else public.lab_queue.status end,
      joined_at = case
        when public.lab_queue.status in ('used', 'expired')
          or (public.lab_queue.status = 'admitted' and public.lab_queue.admitted_until <= now())
        then now() else public.lab_queue.joined_at end,
      admitted_until = case
        when public.lab_queue.status in ('used', 'expired')
          or (public.lab_queue.status = 'admitted' and public.lab_queue.admitted_until <= now())
        then null else public.lab_queue.admitted_until end
  returning id into v_id;
  return jsonb_build_object('ticketId', v_id);
end; $$;

-- C) Sala de espera: admite a una persona por evento.
-- La fila se mueve al consultar su estado, sin servicio en segundo plano.
create or replace function public.lab_queue_status(p_ticket_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_event_id uuid;
  v_active integer;
  v_ticket public.lab_queue%rowtype;
  v_position bigint;
begin
  select event_id into v_event_id from public.lab_queue where id = p_ticket_id;
  if v_event_id is null then raise exception 'TICKET_NO_ENCONTRADO'; end if;

  -- Serializa decisiones de admisión de un mismo evento.
  perform 1 from public.lab_events where id = v_event_id for update;
  update public.lab_queue set status = 'expired'
    where event_id = v_event_id and status = 'admitted'
      and admitted_until <= now();

  select count(*) into v_active from public.lab_queue
    where event_id = v_event_id and status = 'admitted' and admitted_until > now();

  with seleccion as (
    select id from public.lab_queue
    where event_id = v_event_id and status = 'waiting'
    order by joined_at, id
    limit greatest(0, 1 - v_active)
    for update
  )
  update public.lab_queue q set status='admitted', admitted_until=now()+interval '90 seconds'
  from seleccion where q.id = seleccion.id;

  select * into v_ticket from public.lab_queue where id = p_ticket_id;
  if v_ticket.status = 'waiting' then
    select 1 + count(*) into v_position from public.lab_queue q
    where q.event_id = v_event_id and q.status = 'waiting' and
      (q.joined_at, q.id) < (v_ticket.joined_at, v_ticket.id);
  else
    v_position := 0;
  end if;
  return jsonb_build_object('status', v_ticket.status, 'position', v_position,
    'expiresAt', v_ticket.admitted_until);
end; $$;

-- D) Reserva atómica. El bloqueo por evento garantiza cero sobreventa.
create or replace function public.lab_reserve(
  p_event_id uuid, p_ticket_id uuid, p_request_key uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_capacity integer;
  v_occupied bigint;
  v_q public.lab_queue%rowtype;
  v_res public.lab_reservations%rowtype;
begin
  select capacity into v_capacity from public.lab_events where id = p_event_id for update;
  if not found then raise exception 'EVENTO_NO_ENCONTRADO'; end if;

  update public.lab_reservations set status='expired'
   where event_id=p_event_id and status='held' and held_until <= now();

  -- Un reintento con la misma clave devuelve la reserva previa.
  select * into v_res from public.lab_reservations where request_key=p_request_key;
  if found then
    if v_res.event_id <> p_event_id or v_res.queue_id <> p_ticket_id then
      raise exception 'RESERVA_CLAVE_REUTILIZADA';
    end if;
    return jsonb_build_object('reservationId', v_res.id, 'status', v_res.status,
      'expiresAt', v_res.held_until);
  end if;

  select * into v_q from public.lab_queue where id=p_ticket_id and event_id=p_event_id for update;
  if not found or v_q.status <> 'admitted' or v_q.admitted_until <= now() then
    raise exception 'FILA_NO_AUTORIZADA';
  end if;

  select count(*) into v_occupied from public.lab_reservations
   where event_id=p_event_id and status in ('held','confirmed');
  if v_occupied >= v_capacity then raise exception 'AGOTADO'; end if;

  insert into public.lab_reservations(event_id,queue_id,request_key,held_until)
  values(p_event_id,p_ticket_id,p_request_key,now()+interval '5 minutes')
  returning * into v_res;
  update public.lab_queue set status='used' where id=p_ticket_id;

  return jsonb_build_object('reservationId', v_res.id, 'status', v_res.status,
    'expiresAt', v_res.held_until);
end; $$;

-- E) Confirmación de pago FICTICIO, idempotente y en la misma transacción.
create or replace function public.lab_confirm_mock_payment(p_reservation_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_event_id uuid;
  v_res public.lab_reservations%rowtype;
  v_reference uuid;
begin
  select event_id into v_event_id from public.lab_reservations where id = p_reservation_id;
  if not found then raise exception 'RESERVA_NO_ENCONTRADA'; end if;
  perform 1 from public.lab_events where id=v_event_id for update;
  select * into v_res from public.lab_reservations where id=p_reservation_id for update;

  if v_res.status='expired' or (v_res.status='held' and v_res.held_until <= now()) then
    update public.lab_reservations set status='expired' where id=p_reservation_id and status='held';
    raise exception 'RESERVA_EXPIRADA';
  end if;
  if v_res.status='held' then
    update public.lab_reservations
      set status='confirmed',confirmed_at=now() where id=p_reservation_id;
  end if;
  insert into public.lab_payments(reservation_id) values(p_reservation_id)
    on conflict(reservation_id) do nothing;
  select mock_reference into v_reference from public.lab_payments
    where reservation_id=p_reservation_id;
  return jsonb_build_object('reservationId',p_reservation_id,'status','confirmed',
    'paymentReference', v_reference, 'mode', 'SIMULADO');
end; $$;

-- F) Métricas para un panel de comprobación.
create or replace function public.lab_metrics()
returns jsonb language sql security definer set search_path = '' as $$
  select jsonb_build_object(
    'events', (select count(*) from public.lab_events),
    'confirmed', (select count(*) from public.lab_reservations where status='confirmed'),
    'activeHolds', (select count(*) from public.lab_reservations
       where status='held' and held_until>now()),
    'waiting', (select count(*) from public.lab_queue where status='waiting'),
    'mockPayments', (select count(*) from public.lab_payments)
  );
$$;

-- Las funciones privilegiadas NO deben poder ejecutarse directamente con clave pública.
revoke all on function public.lab_list_events() from public, anon, authenticated;
revoke all on function public.lab_queue_join(uuid,uuid) from public, anon, authenticated;
revoke all on function public.lab_queue_status(uuid) from public, anon, authenticated;
revoke all on function public.lab_reserve(uuid,uuid,uuid) from public, anon, authenticated;
revoke all on function public.lab_confirm_mock_payment(uuid) from public, anon, authenticated;
revoke all on function public.lab_metrics() from public, anon, authenticated;
grant execute on function public.lab_list_events() to service_role;
grant execute on function public.lab_queue_join(uuid,uuid) to service_role;
grant execute on function public.lab_queue_status(uuid) to service_role;
grant execute on function public.lab_reserve(uuid,uuid,uuid) to service_role;
grant execute on function public.lab_confirm_mock_payment(uuid) to service_role;
grant execute on function public.lab_metrics() to service_role;
