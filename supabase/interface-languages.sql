begin;

alter table public.user_profiles
  drop constraint user_profiles_language_check;

alter table public.user_profiles
  add constraint user_profiles_language_check check (language in ('es', 'en'));

commit;
