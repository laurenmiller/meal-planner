create table week_plan_items (
  id            bigint primary key generated always as identity,
  week_start    date not null,
  day           integer not null check (day between 0 and 6),
  sort_order    integer default 0,
  item_type     text not null check (item_type in ('recipe', 'note')),
  recipe_id     bigint references recipes(id) on delete set null,
  ingredients   text[],
  cook_time     integer,
  thumbnail_url text,
  note          text,
  created_at    timestamptz default now()
);
create index idx_wpi_week_day on week_plan_items(week_start, day, sort_order);
alter publication supabase_realtime add table week_plan_items;
