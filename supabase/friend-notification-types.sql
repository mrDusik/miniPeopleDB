begin;

alter table public.notificaciones drop constraint if exists notificaciones_type_check;
alter table public.notificaciones add constraint notificaciones_type_check check (type in (
  'gift_received', 'gift_thanks', 'ranking_entered', 'ranking_exited', 'daily_summary',
  'friend_request', 'friend_request_accepted'
));

commit;