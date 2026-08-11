-- Fix the trainer visibility predicate for video analyses.
-- The previous policy compared lessons.analysis_id to lessons.id, so a trainer
-- could not read an analysis attached to their own lesson.

begin;

drop policy if exists analyses_select_trainer on public.video_analyses;

create policy analyses_select_trainer
on public.video_analyses
for select
to authenticated
using (
  exists (
    select 1
    from public.lessons as lesson
    where lesson.analysis_id = video_analyses.id
      and lesson.trainer_id = (select auth.uid())
  )
);

commit;
