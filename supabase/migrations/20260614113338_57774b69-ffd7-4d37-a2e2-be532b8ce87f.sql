-- Convert exposed helper functions to SECURITY INVOKER so signed-in users can execute them safely.
-- Their bodies still restrict checks to the current auth.uid().
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COALESCE(auth.uid() = _user_id, false)
    AND EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = auth.uid()
        AND _user_id = auth.uid()
        AND role = _role
    )
$$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY INVOKER
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
SECURITY INVOKER
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
SECURITY INVOKER
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
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COALESCE(auth.uid() = _user_id, false)
    AND (
      public.has_role(_user_id, 'Manager')
      OR EXISTS (
        SELECT 1
        FROM public.karyawan_cabang_pivot
        WHERE id_karyawan = auth.uid()
          AND _user_id = auth.uid()
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

-- Avoid recursive role checks on user_roles itself. Managers use server-side admin functions for cross-user role writes.
DROP POLICY IF EXISTS user_roles_manager_select ON public.user_roles;
DROP POLICY IF EXISTS user_roles_manager_write ON public.user_roles;
DROP POLICY IF EXISTS user_roles_self_read ON public.user_roles;
DROP POLICY IF EXISTS user_roles_self_select ON public.user_roles;

CREATE POLICY user_roles_self_select
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());
