ALTER TABLE public.cabang ADD COLUMN IF NOT EXISTS jam_operasional JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Backfill from existing weekday/weekend columns where available
UPDATE public.cabang
SET jam_operasional = (
  SELECT jsonb_agg(slot) FROM (
    SELECT jsonb_build_object(
      'days', '[1,2,3,4,5]'::jsonb,
      'buka', to_char(jam_buka_weekday, 'HH24:MI'),
      'tutup', to_char(jam_tutup_weekday, 'HH24:MI')
    ) AS slot
    WHERE jam_buka_weekday IS NOT NULL AND jam_tutup_weekday IS NOT NULL
    UNION ALL
    SELECT jsonb_build_object(
      'days', '[0,6]'::jsonb,
      'buka', to_char(jam_buka_weekend, 'HH24:MI'),
      'tutup', to_char(jam_tutup_weekend, 'HH24:MI')
    )
    WHERE jam_buka_weekend IS NOT NULL AND jam_tutup_weekend IS NOT NULL
  ) s
)
WHERE jam_operasional = '[]'::jsonb
  AND (jam_buka_weekday IS NOT NULL OR jam_buka_weekend IS NOT NULL);

UPDATE public.cabang SET jam_operasional = '[]'::jsonb WHERE jam_operasional IS NULL;