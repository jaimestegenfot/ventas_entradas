-- Eventos disponibles y registro usado para las pruebas de reservas.
insert into public.lab_events(slug,title,description,venue,starts_at,price_cents,capacity,accent,is_test)
values
 ('festival-amazonico','Festival Amazónico 2027',
  'Una noche para celebrar la música y las tradiciones de nuestra Amazonía.',
  'Puerto Maldonado', '2027-02-13 20:00:00-05', 6500, 150, 'violet', false),
 ('prueba-ultima-entrada','Noche Amazónica en Vivo',
  'Una noche para disfrutar de música en vivo y compartir lo mejor de la Amazonía.',
  'Puerto Maldonado', '2027-03-20 19:00:00-05', 100, 1, 'orange', true)
on conflict(slug) do update
set title = excluded.title,
    description = excluded.description,
    venue = excluded.venue,
    is_test = excluded.is_test;
