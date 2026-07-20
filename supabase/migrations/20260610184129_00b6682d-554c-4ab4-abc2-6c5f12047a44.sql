
-- Helper: ambil daftar cabang milik user saat ini, bypass RLS
CREATE OR REPLACE FUNCTION public.get_my_cabang_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id_cabang FROM public.karyawan_cabang_pivot WHERE id_karyawan = auth.uid()
$$;

GRANT EXECUTE ON FUNCTION public.get_my_cabang_ids() TO authenticated;

-- Drop policy lama yang rekursif
DROP POLICY IF EXISTS karyawan_captain_select ON public.karyawan;
DROP POLICY IF EXISTS pivot_captain_select ON public.karyawan_cabang_pivot;

-- Buat ulang policy Captain tanpa rekursi
CREATE POLICY karyawan_captain_select ON public.karyawan
  FOR SELECT
  USING (
    public.has_role(auth.uid(), 'Captain'::public.app_role)
    AND EXISTS (
      SELECT 1 FROM public.karyawan_cabang_pivot kcp
      WHERE kcp.id_karyawan = karyawan.id_karyawan
        AND kcp.id_cabang IN (SELECT public.get_my_cabang_ids())
    )
  );

CREATE POLICY pivot_captain_select ON public.karyawan_cabang_pivot
  FOR SELECT
  USING (
    public.has_role(auth.uid(), 'Captain'::public.app_role)
    AND id_cabang IN (SELECT public.get_my_cabang_ids())
  );
