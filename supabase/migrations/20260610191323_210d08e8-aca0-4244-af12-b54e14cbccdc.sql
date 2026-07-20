-- 1. Nomor HP di karyawan
ALTER TABLE public.karyawan ADD COLUMN IF NOT EXISTS no_hp TEXT;

-- 2. Kategori SOP
DO $$ BEGIN
  CREATE TYPE public.sop_kategori AS ENUM ('OPENING','BERJALAN_TOKO','CLOSING');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.master_ceklist_sop
  ADD COLUMN IF NOT EXISTS kategori public.sop_kategori NOT NULL DEFAULT 'BERJALAN_TOKO';

-- 3. Pivot SOP <-> Cabang dengan bobot poin per cabang
CREATE TABLE IF NOT EXISTS public.sop_cabang_pivot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_sop UUID NOT NULL REFERENCES public.master_ceklist_sop(id_sop) ON DELETE CASCADE,
  id_cabang UUID NOT NULL REFERENCES public.cabang(id_cabang) ON DELETE CASCADE,
  bobot_poin INTEGER NOT NULL DEFAULT 10 CHECK (bobot_poin >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id_sop, id_cabang)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sop_cabang_pivot TO authenticated;
GRANT ALL ON public.sop_cabang_pivot TO service_role;

ALTER TABLE public.sop_cabang_pivot ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Manager kelola sop_cabang_pivot"
  ON public.sop_cabang_pivot FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(),'Manager'))
  WITH CHECK (public.has_role(auth.uid(),'Manager'));

CREATE POLICY "Karyawan baca sop cabangnya"
  ON public.sop_cabang_pivot FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(),'Manager')
    OR EXISTS (
      SELECT 1 FROM public.karyawan_cabang_pivot kcp
      WHERE kcp.id_karyawan = auth.uid() AND kcp.id_cabang = sop_cabang_pivot.id_cabang
    )
  );

CREATE INDEX IF NOT EXISTS idx_sop_cabang_pivot_sop ON public.sop_cabang_pivot(id_sop);
CREATE INDEX IF NOT EXISTS idx_sop_cabang_pivot_cabang ON public.sop_cabang_pivot(id_cabang);