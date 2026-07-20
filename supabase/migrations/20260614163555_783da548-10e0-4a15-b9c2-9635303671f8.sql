DROP INDEX IF EXISTS public.master_shift_cabang_unique;

DROP INDEX IF EXISTS public.master_shift_cabang_scope_shift_days_idx;
CREATE INDEX IF NOT EXISTS master_shift_cabang_scope_shift_days_idx
ON public.master_shift_cabang (id_cabang, nama_shift);