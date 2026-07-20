
ALTER TABLE public.cabang
  ADD COLUMN IF NOT EXISTS latitude numeric(10,7),
  ADD COLUMN IF NOT EXISTS longitude numeric(10,7);

ALTER TABLE public.transaksi_ceklist_harian
  ADD COLUMN IF NOT EXISTS is_in_location boolean,
  ADD COLUMN IF NOT EXISTS upload_latitude numeric(10,7),
  ADD COLUMN IF NOT EXISTS upload_longitude numeric(10,7),
  ADD COLUMN IF NOT EXISTS upload_distance_m numeric(10,2);
