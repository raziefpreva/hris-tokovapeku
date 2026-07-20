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

CREATE OR REPLACE FUNCTION public.has_cabang_access(_user_id uuid, _id_cabang uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
$function$;