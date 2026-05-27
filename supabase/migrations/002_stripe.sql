-- ============================================================
-- Migration 002 — Stripe subscriptions
-- ============================================================

-- Subscriptions (synced from Stripe webhooks)
create table subscriptions (
  id                   text primary key,       -- Stripe subscription ID
  user_id              uuid references auth.users on delete cascade not null,
  stripe_customer_id   text not null,
  status               text not null,          -- active | past_due | canceled | trialing
  price_id             text not null,
  current_period_end   timestamptz,
  cancel_at_period_end boolean default false,
  created_at           timestamptz default now(),
  updated_at           timestamptz default now()
);
alter table subscriptions enable row level security;
create policy "Users view own subscription"
  on subscriptions for select using (auth.uid() = user_id);

-- Sync plan on subscription change
create or replace function sync_user_plan()
returns trigger language plpgsql security definer as $$
begin
  update profiles set plan =
    case
      when new.status in ('active', 'trialing') then 'pro'
      else 'free'
    end
  where id = new.user_id;
  return new;
end;
$$;

create trigger on_subscription_change
  after insert or update on subscriptions
  for each row execute procedure sync_user_plan();
