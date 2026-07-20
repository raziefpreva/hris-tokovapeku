
-- 1) Remove overly broad karyawan SELECT policy (rely on scoped policies)
DROP POLICY IF EXISTS "karyawan_select_auth" ON public.karyawan;

-- 2) Storage: tighten bukti-tugas bucket
DROP POLICY IF EXISTS "bukti_select_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "bukti_insert_authenticated" ON storage.objects;

-- SELECT: owner of the path, Manager, or Captain on the related task's branch.
-- Path layout: {auth.uid()}/{id_tugas}/{filename}
CREATE POLICY "bukti_select_scoped"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'bukti-tugas' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'Manager'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.transaksi_ceklist_harian t
      WHERE t.id_tugas::text = (storage.foldername(name))[2]
        AND public.has_role(auth.uid(), 'Captain'::public.app_role)
        AND public.has_cabang_access(auth.uid(), t.id_cabang)
    )
  )
);

-- INSERT: path must start with the uploader's own auth.uid()
CREATE POLICY "bukti_insert_owner_prefix"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'bukti-tugas'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 3) Restrict EXECUTE on SECURITY DEFINER helpers to system roles only.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_cabang_access(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_my_cabang_ids() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_account_active(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_alfa_tasks() FROM PUBLIC, anon, authenticated;

-- 4) Set fixed search_path on guard_anti_self_verify (linter: function_search_path_mutable)
CREATE OR REPLACE FUNCTION public.guard_anti_self_verify()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  IF NEW.status_tugas IN ('Disetujui (Murni)', 'Disetujui dengan Penalti', 'Ditolak')
     AND NEW.diverifikasi_oleh IS NOT NULL
     AND NEW.diverifikasi_oleh = NEW.id_karyawan THEN
    RAISE EXCEPTION 'Anti-ACC: Anda tidak dapat memverifikasi tugas yang Anda kerjakan sendiri.';
  END IF;
  RETURN NEW;
END;
$function$;
