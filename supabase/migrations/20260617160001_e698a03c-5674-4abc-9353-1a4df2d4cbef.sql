
ALTER TABLE public.karyawan
  ADD COLUMN IF NOT EXISTS divisi text,
  ADD COLUMN IF NOT EXISTS jabatan text;

ALTER TABLE public.jadwal_kerja
  ADD COLUMN IF NOT EXISTS shifts text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS id_cabang_list uuid[] NOT NULL DEFAULT '{}';

-- Backfill arrays from legacy single columns so existing data still works
UPDATE public.jadwal_kerja
SET shifts = CASE WHEN shift IS NULL THEN '{}'::text[] ELSE ARRAY[shift::text] END
WHERE (shifts IS NULL OR array_length(shifts,1) IS NULL);

UPDATE public.jadwal_kerja
SET id_cabang_list = CASE WHEN id_cabang IS NULL THEN '{}'::uuid[] ELSE ARRAY[id_cabang] END
WHERE (id_cabang_list IS NULL OR array_length(id_cabang_list,1) IS NULL);
