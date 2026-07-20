DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill: pastikan setiap auth user yang belum punya baris karyawan dibuatkan
INSERT INTO public.karyawan (id_karyawan, nik, nama_karyawan, role, status_akun)
SELECT u.id,
       COALESCE(u.raw_user_meta_data->>'nik', split_part(u.email, '@', 1)),
       COALESCE(u.raw_user_meta_data->>'nama_karyawan', split_part(u.email, '@', 1)),
       COALESCE((u.raw_user_meta_data->>'role')::public.app_role, 'Manager'::public.app_role),
       'Aktif'
FROM auth.users u
LEFT JOIN public.karyawan k ON k.id_karyawan = u.id
WHERE k.id_karyawan IS NULL
ON CONFLICT (id_karyawan) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT u.id,
       COALESCE((u.raw_user_meta_data->>'role')::public.app_role, 'Manager'::public.app_role)
FROM auth.users u
LEFT JOIN public.user_roles r ON r.user_id = u.id
WHERE r.user_id IS NULL
ON CONFLICT (user_id, role) DO NOTHING;