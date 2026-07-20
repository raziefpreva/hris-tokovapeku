-- Restore safe helper functions used by RLS policies.
-- These functions may be executed by signed-in users, but only evaluate the current auth.uid().
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(auth.uid() = _user_id, false)
    AND EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = _user_id
        AND role = _role
    )
$$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = auth.uid()
    AND _user_id = auth.uid()
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_account_active(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.karyawan
    WHERE id_karyawan = auth.uid()
      AND _user_id = auth.uid()
      AND status_akun = 'Aktif'
  )
$$;

CREATE OR REPLACE FUNCTION public.get_my_cabang_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id_cabang
  FROM public.karyawan_cabang_pivot
  WHERE id_karyawan = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.has_cabang_access(_user_id uuid, _id_cabang uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(auth.uid() = _user_id, false)
    AND (
      public.has_role(_user_id, 'Manager')
      OR EXISTS (
        SELECT 1
        FROM public.karyawan_cabang_pivot
        WHERE id_karyawan = _user_id
          AND id_cabang = _id_cabang
      )
    )
$$;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_account_active(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_my_cabang_ids() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_cabang_access(uuid, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_account_active(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_cabang_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_cabang_access(uuid, uuid) TO authenticated;

-- Ensure Data API grants exist for app tables while RLS policies still restrict row access.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cabang TO authenticated;
GRANT ALL ON public.cabang TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.karyawan TO authenticated;
GRANT ALL ON public.karyawan TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jadwal_kerja TO authenticated;
GRANT ALL ON public.jadwal_kerja TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.master_shift_cabang TO authenticated;
GRANT ALL ON public.master_shift_cabang TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.karyawan_cabang_pivot TO authenticated;
GRANT ALL ON public.karyawan_cabang_pivot TO service_role;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

-- Manager must be able to view all employee profiles and schedules for the monthly matrix.
DROP POLICY IF EXISTS karyawan_manager_select ON public.karyawan;
CREATE POLICY karyawan_manager_select
ON public.karyawan
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'Manager'));

DROP POLICY IF EXISTS jadwal_manager_select ON public.jadwal_kerja;
CREATE POLICY jadwal_manager_select
ON public.jadwal_kerja
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'Manager'));

-- Add dynamic day grouping to branch shift master.
ALTER TABLE public.master_shift_cabang
ADD COLUMN IF NOT EXISTS hari integer[] NOT NULL DEFAULT ARRAY[0,1,2,3,4,5,6];

UPDATE public.master_shift_cabang
SET hari = ARRAY[0,1,2,3,4,5,6]
WHERE hari IS NULL OR array_length(hari, 1) IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'master_shift_cabang_hari_valid'
      AND conrelid = 'public.master_shift_cabang'::regclass
  ) THEN
    ALTER TABLE public.master_shift_cabang
      ADD CONSTRAINT master_shift_cabang_hari_valid
      CHECK (
        array_length(hari, 1) >= 1
        AND hari <@ ARRAY[0,1,2,3,4,5,6]
      );
  END IF;
END $$;

DROP INDEX IF EXISTS public.master_shift_cabang_scope_shift_days_idx;
CREATE INDEX master_shift_cabang_scope_shift_days_idx
ON public.master_shift_cabang (id_cabang, nama_shift);
