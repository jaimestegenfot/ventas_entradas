-- CUIDADO: elimina las reservas y filas del evento de prueba.
-- No afecta otros eventos, Trilce QR ni otras tablas.
do $$ declare v_event uuid;
begin
  select id into v_event from public.lab_events where slug='prueba-ultima-entrada';
  if v_event is not null then
    delete from public.lab_queue where event_id=v_event;
    -- Cascada: elimina también reservas y pagos del evento de prueba.
  end if;
end $$;
