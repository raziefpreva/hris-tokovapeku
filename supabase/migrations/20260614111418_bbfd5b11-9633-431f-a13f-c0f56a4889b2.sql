CREATE OR REPLACE FUNCTION public.get_my_cabang_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT id_cabang
  FROM public.karyawan_cabang_pivot
  WHERE id_karyawan = auth.uid()
$function$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
    AND _user_id = auth.uid()
  LIMIT 1
$function$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
      AND _user_id = auth.uid()
  )
$function$;

CREATE OR REPLACE FUNCTION public.is_account_active(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.karyawan
    WHERE id_karyawan = _user_id
      AND status_akun = 'Aktif'
      AND _user_id = auth.uid()
  )
$function$;

GRANT EXECUTE ON FUNCTION public.get_my_cabang_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_account_active(uuid) TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_my_cabang_ids() TO anon;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon;
GRANT EXECUTE ON FUNCTION public.is_account_active(uuid) TO anon;