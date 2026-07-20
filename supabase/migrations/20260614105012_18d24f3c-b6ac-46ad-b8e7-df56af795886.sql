ALTER TABLE public.cabang
  ADD COLUMN IF NOT EXISTS jam_buka time,
  ADD COLUMN IF NOT EXISTS jam_tutup time,
  ADD COLUMN IF NOT EXISTS shift1_mulai time,
  ADD COLUMN IF NOT EXISTS shift1_selesai time,
  ADD COLUMN IF NOT EXISTS shift2_mulai time,
  ADD COLUMN IF NOT EXISTS shift2_selesai time;