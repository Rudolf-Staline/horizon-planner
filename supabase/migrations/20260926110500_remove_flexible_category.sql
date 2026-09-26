begin;

update public.tasks
set category = 'neutral'
where category = 'flexible';

update public.routines
set category = 'neutral'
where category = 'flexible';

update public.calendar_events
set category = 'neutral'
where category = 'flexible';

alter table public.tasks
  drop constraint if exists tasks_category_check;
alter table public.tasks
  add constraint tasks_category_check
  check (
    category in (
      'course',
      'project',
      'personal',
      'focus',
      'routine',
      'admin',
      'neutral'
    )
  );

alter table public.routines
  drop constraint if exists routines_category_check;
alter table public.routines
  add constraint routines_category_check
  check (
    category in (
      'course',
      'project',
      'personal',
      'focus',
      'routine',
      'admin',
      'neutral'
    )
  );

alter table public.calendar_events
  drop constraint if exists calendar_events_category_check;
alter table public.calendar_events
  add constraint calendar_events_category_check
  check (
    category in (
      'course',
      'project',
      'personal',
      'focus',
      'routine',
      'admin',
      'neutral'
    )
  );

commit;
