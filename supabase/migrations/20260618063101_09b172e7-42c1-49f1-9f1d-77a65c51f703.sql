CREATE POLICY "tugas_cabang_member_select" ON public.transaksi_ceklist_harian
FOR SELECT
USING (
  internal.has_cabang_access(auth.uid(), id_cabang)
);