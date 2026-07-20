DROP POLICY IF EXISTS pivot_captain_select ON public.karyawan_cabang_pivot;
GRANT EXECUTE ON FUNCTION public.get_my_cabang_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_cabang_access(uuid, uuid) TO authenticated;