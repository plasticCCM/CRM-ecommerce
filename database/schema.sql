create table if not exists clients (
  id bigserial primary key,
  age integer not null check (age between 14 and 100),
  gender varchar(16) not null check (gender in ('Мужской', 'Женский')),
  region varchar(120) not null,
  registered_at date not null,
  orders integer not null check (orders >= 0),
  avg_check numeric(12, 2) not null check (avg_check >= 0),
  created_at timestamptz not null default now()
);

create index if not exists clients_region_idx on clients (region);
create index if not exists clients_gender_idx on clients (gender);
create index if not exists clients_registered_at_idx on clients (registered_at);
