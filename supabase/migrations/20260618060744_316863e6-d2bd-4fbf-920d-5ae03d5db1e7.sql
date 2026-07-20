CREATE POLICY "captain_can_read_verification_queue" ON public.transaksi_ceklist_harian
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'Captain'::public.app_role)
  AND flow_type = 'vaporista_to_captain'::public.flow_type_enum
  AND id_karyawan <> auth.uid()
  AND (
    diverifikasi_oleh = auth.uid()
    OR diverifikasi_oleh IS NULL
  )
);