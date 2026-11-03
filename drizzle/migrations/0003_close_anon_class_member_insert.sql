DROP POLICY IF EXISTS "anyone can request to join" ON public.class_members;
REVOKE INSERT ON public.class_members FROM anon;