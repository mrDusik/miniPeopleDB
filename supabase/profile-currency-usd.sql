begin;

alter table public.user_profiles
  drop constraint if exists user_profiles_currency_check;

alter table public.user_profiles
  add constraint user_profiles_currency_check check (currency in ('EUR', 'USD'));

commit;
