
ALTER TABLE public.cabang
  ADD COLUMN IF NOT EXISTS jam_buka_weekday  TIME,
  ADD COLUMN IF NOT EXISTS jam_tutup_weekday TIME,
  ADD COLUMN IF NOT EXISTS jam_buka_weekend  TIME,
  ADD COLUMN IF NOT EXISTS jam_tutup_weekend TIME;

ALTER TABLE public.cabang DISABLE TRIGGER USER;
UPDATE public.cabang SET
  jam_buka_weekday  = COALESCE(jam_buka_weekday,  jam_buka),
  jam_tutup_weekday = COALESCE(jam_tutup_weekday, jam_tutup),
  jam_buka_weekend  = COALESCE(jam_buka_weekend,  jam_buka),
  jam_tutup_weekend = COALESCE(jam_tutup_weekend, jam_tutup);
ALTER TABLE public.cabang ENABLE TRIGGER USER;

ALTER TABLE public.cabang
  DROP COLUMN IF EXISTS jam_buka,
  DROP COLUMN IF EXISTS jam_tutup,
  DROP COLUMN IF EXISTS shift1_mulai,
  DROP COLUMN IF EXISTS shift1_selesai,
  DROP COLUMN IF EXISTS shift2_mulai,
  DROP COLUMN IF EXISTS shift2_selesai;

CREATE TABLE IF NOT EXISTS public.master_shift_cabang (
  id_shift     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_cabang    UUID REFERENCES public.cabang(id_cabang) ON DELETE CASCADE,
  nama_shift   TEXT NOT NULL,
  jam_mulai    TIME NOT NULL,
  jam_selesai  TIME NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS master_shift_cabang_unique
  ON public.master_shift_cabang (COALESCE(id_cabang, '00000000-0000-0000-0000-000000000000'::uuid), nama_shift);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.master_shift_cabang TO authenticated;
GRANT ALL ON public.master_shift_cabang TO service_role;

ALTER TABLE public.master_shift_cabang ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read shift master"
  ON public.master_shift_cabang FOR SELECT TO authenticated USING (true);

CREATE POLICY "Manager manages shift master"
  ON public.master_shift_cabang FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'Manager'))
  WITH CHECK (public.has_role(auth.uid(), 'Manager'));

CREATE TRIGGER tg_master_shift_cabang_touch
  BEFORE UPDATE ON public.master_shift_cabang
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
