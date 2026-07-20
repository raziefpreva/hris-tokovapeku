
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('Manager', 'Captain', 'Vaporista');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS public.cabang (
  id_cabang UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama_cabang TEXT NOT NULL UNIQUE,
  alamat TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cabang TO authenticated;
GRANT ALL ON public.cabang TO service_role;
ALTER TABLE public.cabang ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.karyawan (
  id_karyawan UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nik TEXT NOT NULL UNIQUE,
  nama_karyawan TEXT NOT NULL,
  role public.app_role NOT NULL DEFAULT 'Vaporista',
  status_akun TEXT NOT NULL DEFAULT 'Aktif' CHECK (status_akun IN ('Aktif','Nonaktif')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.karyawan TO authenticated;
GRANT ALL ON public.karyawan TO service_role;
ALTER TABLE public.karyawan ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.karyawan_cabang_pivot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_karyawan UUID NOT NULL REFERENCES public.karyawan(id_karyawan) ON DELETE CASCADE,
  id_cabang UUID NOT NULL REFERENCES public.cabang(id_cabang) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(id_karyawan, id_cabang)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.karyawan_cabang_pivot TO authenticated;
GRANT ALL ON public.karyawan_cabang_pivot TO service_role;
ALTER TABLE public.karyawan_cabang_pivot ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_account_active(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.karyawan WHERE id_karyawan = _user_id AND status_akun = 'Aktif')
$$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS public.app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role public.app_role;
  v_nik TEXT;
  v_nama TEXT;
BEGIN
  v_role := COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'Vaporista');
  v_nik  := COALESCE(NEW.raw_user_meta_data->>'nik', NEW.email);
  v_nama := COALESCE(NEW.raw_user_meta_data->>'nama_karyawan', v_nik);
  INSERT INTO public.karyawan (id_karyawan, nik, nama_karyawan, role, status_akun)
  VALUES (NEW.id, v_nik, v_nama, v_role, 'Aktif')
  ON CONFLICT (id_karyawan) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_cabang_updated ON public.cabang;
CREATE TRIGGER trg_cabang_updated BEFORE UPDATE ON public.cabang
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_karyawan_updated ON public.karyawan;
CREATE TRIGGER trg_karyawan_updated BEFORE UPDATE ON public.karyawan
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Reset policies idempoten
DROP POLICY IF EXISTS "cabang_select_auth" ON public.cabang;
DROP POLICY IF EXISTS "cabang_manager_write" ON public.cabang;
CREATE POLICY "cabang_select_auth" ON public.cabang FOR SELECT TO authenticated USING (true);
CREATE POLICY "cabang_manager_write" ON public.cabang FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'Manager'))
  WITH CHECK (public.has_role(auth.uid(), 'Manager'));

DROP POLICY IF EXISTS "karyawan_select_auth" ON public.karyawan;
DROP POLICY IF EXISTS "karyawan_manager_write" ON public.karyawan;
DROP POLICY IF EXISTS "karyawan_self_update" ON public.karyawan;
CREATE POLICY "karyawan_select_auth" ON public.karyawan FOR SELECT TO authenticated USING (true);
CREATE POLICY "karyawan_manager_write" ON public.karyawan FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'Manager'))
  WITH CHECK (public.has_role(auth.uid(), 'Manager'));
CREATE POLICY "karyawan_self_update" ON public.karyawan FOR UPDATE TO authenticated
  USING (auth.uid() = id_karyawan) WITH CHECK (auth.uid() = id_karyawan);

DROP POLICY IF EXISTS "user_roles_self_read" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_manager_write" ON public.user_roles;
CREATE POLICY "user_roles_self_read" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'Manager'));
CREATE POLICY "user_roles_manager_write" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'Manager'))
  WITH CHECK (public.has_role(auth.uid(), 'Manager'));

DROP POLICY IF EXISTS "pivot_select_self_or_manager" ON public.karyawan_cabang_pivot;
DROP POLICY IF EXISTS "pivot_manager_write" ON public.karyawan_cabang_pivot;
CREATE POLICY "pivot_select_self_or_manager" ON public.karyawan_cabang_pivot FOR SELECT TO authenticated
  USING (id_karyawan = auth.uid() OR public.has_role(auth.uid(), 'Manager'));
CREATE POLICY "pivot_manager_write" ON public.karyawan_cabang_pivot FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'Manager'))
  WITH CHECK (public.has_role(auth.uid(), 'Manager'));
