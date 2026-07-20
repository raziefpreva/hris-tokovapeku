
-- 1) Cabang: jam_operasional + legacy time columns boleh NULL
ALTER TABLE public.cabang
  ALTER COLUMN jam_operasional DROP NOT NULL,
  ALTER COLUMN jam_operasional DROP DEFAULT;

-- 2) Master SOP: tambahan kolom multi-shift / multi-day / personal
ALTER TABLE public.master_ceklist_sop
  ADD COLUMN IF NOT EXISTS tipe_shifts text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS hari_berlaku integer[],
  ADD COLUMN IF NOT EXISTS target_karyawan_id uuid;

-- FK terpisah agar idempotent
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'master_ceklist_sop_target_karyawan_id_fkey'
  ) THEN
    ALTER TABLE public.master_ceklist_sop
      ADD CONSTRAINT master_ceklist_sop_target_karyawan_id_fkey
      FOREIGN KEY (target_karyawan_id) REFERENCES public.karyawan(id_karyawan) ON DELETE SET NULL;
  END IF;
END $$;

-- Backfill tipe_shifts dari tipe_shift legacy
UPDATE public.master_ceklist_sop
SET tipe_shifts = ARRAY[tipe_shift::text]
WHERE (tipe_shifts IS NULL OR array_length(tipe_shifts, 1) IS NULL)
  AND tipe_shift IS NOT NULL;

-- tipe_shift jadi optional (legacy)
ALTER TABLE public.master_ceklist_sop
  ALTER COLUMN tipe_shift DROP NOT NULL;
