DROP POLICY IF EXISTS "public can read quizzes" ON public.quizzes;
CREATE POLICY "public can read quizzes" ON public.quizzes FOR SELECT TO anon, authenticated USING (status <> 'draft');