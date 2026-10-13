-- This SECURITY DEFINER event-trigger helper must not be callable through PostgREST by browser roles.
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
