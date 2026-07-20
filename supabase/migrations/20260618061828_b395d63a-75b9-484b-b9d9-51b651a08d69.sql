REVOKE EXECUTE ON FUNCTION public.get_my_cabang_ids() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_cabang_access(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_cabang_ids() TO service_role;
GRANT EXECUTE ON FUNCTION public.has_cabang_access(uuid, uuid) TO service_role;