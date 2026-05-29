create extension if not exists pgcrypto;

create table if not exists credit_packages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price_cents integer not null check (price_cents > 0),
  credits integer not null check (credits > 0),
  active boolean not null default true,
  sort_order integer default 0,
  created_at timestamptz default now()
);

create table if not exists drinks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price_credits integer not null check (price_credits > 0),
  category text,
  active boolean not null default true,
  sort_order integer default 0,
  created_at timestamptz default now()
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  pickup_code text unique not null,
  package_id uuid references credit_packages(id),
  amount_cents integer not null,
  credits_purchased integer not null,
  payment_status text not null default 'pending' check (payment_status in ('pending','paid','failed','cancelled','expired')),
  revolut_order_id text unique,
  revolut_checkout_url text,
  created_at timestamptz default now(),
  paid_at timestamptz
);

create table if not exists credit_movements (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) not null,
  type text not null check (type in ('purchase','redeem','refund','adjust','undo')),
  amount integer not null,
  drink_id uuid references drinks(id),
  note text,
  created_by text,
  created_at timestamptz default now()
);

create index if not exists idx_orders_pickup_code on orders(pickup_code);
create index if not exists idx_orders_revolut_order_id on orders(revolut_order_id);
create index if not exists idx_movements_order_id_created_at on credit_movements(order_id, created_at desc);

create or replace view order_credit_balances as
select
  o.id as order_id,
  o.customer_name,
  o.pickup_code,
  o.payment_status,
  o.amount_cents,
  o.credits_purchased,
  coalesce(sum(cm.amount), 0)::integer as credits_available,
  o.created_at,
  o.paid_at
from orders o
left join credit_movements cm on cm.order_id = o.id
group by o.id, o.customer_name, o.pickup_code, o.payment_status, o.amount_cents, o.credits_purchased, o.created_at, o.paid_at;

create or replace view drink_sales as
select
  d.id as drink_id,
  d.name,
  d.price_credits,
  d.category,
  count(cm.id)::integer as quantity,
  abs(coalesce(sum(cm.amount), 0))::integer as credits_value
from drinks d
left join credit_movements cm on cm.drink_id = d.id and cm.type = 'redeem'
group by d.id, d.name, d.price_credits, d.category;

truncate table credit_packages restart identity cascade;
insert into credit_packages (name, price_cents, credits, sort_order)
values
('5 crediti', 500, 5, 10),
('10 crediti', 1000, 10, 20),
('20 crediti', 2000, 20, 30),
('30 crediti', 3000, 30, 40);

truncate table drinks restart identity cascade;
insert into drinks (name, price_credits, category, sort_order)
values
('Chupito', 1, 'Shot', 10),
('Amari', 2, 'Amari', 20),
('Gin Tonic', 3, 'Drink', 30),
('Gin Lemon', 3, 'Drink', 31),
('Coca Monte', 3, 'Drink', 32),
('Spritz Aperol', 3, 'Spritz & Aperitivi', 33),
('Spritz Campari', 3, 'Spritz & Aperitivi', 34),
('Campari Orange', 3, 'Spritz & Aperitivi', 35),
('Aperol Cedrata', 3, 'Spritz & Aperitivi', 36),
('Vodka Redbull', 4, 'Cocktail', 40),
('Mojito', 4, 'Cocktail', 41),
('Cuba Libre', 4, 'Cocktail', 42),
('Gin Tonic Premium', 5, 'Premium', 50);

-- Per un MVP con service role lato server: lascia RLS disabilitata.
-- Se esponi query dal client, attiva RLS con policy specifiche.
