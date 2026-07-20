CREATE SCHEMA IF NOT EXISTS internal;

CREATE OR REPLACE FUNCTION internal.get_my_cabang_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT id_cabang
  FROM public.karyawan_cabang_pivot
  WHERE id_karyawan = auth.uid()
$function$;

CREATE OR REPLACE FUNCTION internal.has_cabang_access(_user_id uuid, _id_cabang uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(auth.uid() = _user_id, false)
    AND (
      public.has_role(_user_id, 'Manager')
      OR EXISTS (
        SELECT 1
        FROM public.karyawan_cabang_pivot
        WHERE id_karyawan = _user_id
          AND id_cabang = _id_cabang
      )
    )
$function$;

GRANT USAGE ON SCHEMA internal TO authenticated;
GRANT EXECUTE ON FUNCTION internal.get_my_cabang_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION internal.has_cabang_access(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS jadwal_captain_select ON public.jadwal_kerja;
CREATE POLICY jadwal_captain_select
ON public.jadwal_kerja
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'Captain')
  AND (id_cabang IS NULL OR internal.has_cabang_access(auth.uid(), id_cabang))
);

DROP POLICY IF EXISTS karyawan_captain_select ON public.karyawan;
CREATE POLICY karyawan_captain_select
ON public.karyawan
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'Captain')
  AND EXISTS (
    SELECT 1
    FROM public.karyawan_cabang_pivot kcp
    WHERE kcp.id_karyawan = karyawan.id_karyawan
      AND kcp.id_cabang IN (SELECT internal.get_my_cabang_ids())
  )
);

DROP POLICY IF EXISTS tugas_captain_select ON public.transaksi_ceklist_harian;
CREATE POLICY tugas_captain_select
ON public.transaksi_ceklist_harian
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'Captain')
  AND internal.has_cabang_access(auth.uid(), id_cabang)
);

DROP POLICY IF EXISTS tugas_captain_verify ON public.transaksi_ceklist_harian;
CREATE POLICY tugas_captain_verify
ON public.transaksi_ceklist_harian
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'Captain')
  AND id_karyawan <> auth.uid()
  AND internal.has_cabang_access(auth.uid(), id_cabang)
)
WITH CHECK (
  public.has_role(auth.uid(), 'Captain')
  AND id_karyawan <> auth.uid()
  AND internal.has_cabang_access(auth.uid(), id_cabang)
);

DROP POLICY IF EXISTS tugas_self_insert ON public.transaksi_ceklist_harian;
CREATE POLICY tugas_self_insert
ON public.transaksi_ceklist_harian
FOR INSERT
TO authenticated
WITH CHECK (
  id_karyawan = auth.uid()
  AND internal.has_cabang_access(auth.uid(), id_cabang)
);

DROP POLICY IF EXISTS audit_self_select ON public.tugas_audit_log;
CREATE POLICY audit_self_select
ON public.tugas_audit_log
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.transaksi_ceklist_harian t
    WHERE t.id_tugas = tugas_audit_log.id_tugas
      AND (
        t.id_karyawan = auth.uid()
        OR public.has_role(auth.uid(), 'Manager')
        OR (public.has_role(auth.uid(), 'Captain') AND internal.has_cabang_access(auth.uid(), t.id_cabang))
      )
  )
);

REVOKE EXECUTE ON FUNCTION public.get_my_cabang_ids() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_cabang_access(uuid, uuid) FROM PUBLIC, anon, authenticated;