
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('Manager', 'Captain', 'Vaporista');
CREATE TYPE public.status_akun_enum AS ENUM ('Aktif', 'Nonaktif');
CREATE TYPE public.status_hari_enum AS ENUM ('Masuk Kerja', 'LIBUR');
CREATE TYPE public.shift_enum AS ENUM ('Shift 1', 'Shift 2', 'Full Time');
CREATE TYPE public.status_upload_enum AS ENUM ('Tepat Waktu', 'TELAT', 'ALFA');
CREATE TYPE public.status_tugas_enum AS ENUM ('Menunggu Verifikasi', 'Disetujui (Murni)', 'Disetujui dengan Penalti', 'Ditolak', 'Belum Dikerjakan');

-- ============ CABANG ============
CREATE TABLE public.cabang (
  id_cabang UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama_cabang TEXT NOT NULL UNIQUE,
  alamat TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cabang TO authenticated;
GRANT ALL ON public.cabang TO service_role;
ALTER TABLE public.cabang ENABLE ROW LEVEL SECURITY;

-- ============ KARYAWAN ============
CREATE TABLE public.karyawan (
  id_karyawan UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nik TEXT NOT NULL UNIQUE,
  nama_karyawan TEXT NOT NULL,
  role public.app_role NOT NULL,
  status_akun public.status_akun_enum NOT NULL DEFAULT 'Aktif',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.karyawan TO authenticated;
GRANT ALL ON public.karyawan TO service_role;
ALTER TABLE public.karyawan ENABLE ROW LEVEL SECURITY;

-- ============ USER ROLES (separate, secure) ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ============ PIVOT KARYAWAN <-> CABANG ============
CREATE TABLE public.karyawan_cabang_pivot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_karyawan UUID NOT NULL REFERENCES public.karyawan(id_karyawan) ON DELETE CASCADE,
  id_cabang UUID NOT NULL REFERENCES public.cabang(id_cabang) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(id_karyawan, id_cabang)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.karyawan_cabang_pivot TO authenticated;
GRANT ALL ON public.karyawan_cabang_pivot TO service_role;
ALTER TABLE public.karyawan_cabang_pivot ENABLE ROW LEVEL SECURITY;

-- ============ MASTER CEKLIST SOP ============
CREATE TABLE public.master_ceklist_sop (
  id_sop UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama_sop TEXT NOT NULL,
  deskripsi TEXT,
  target_role public.app_role NOT NULL,
  batas_jam_upload TIME NOT NULL,
  bobot_poin INTEGER NOT NULL DEFAULT 10 CHECK (bobot_poin > 0),
  tipe_shift public.shift_enum NOT NULL,
  aktif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.master_ceklist_sop TO authenticated;
GRANT ALL ON public.master_ceklist_sop TO service_role;
ALTER TABLE public.master_ceklist_sop ENABLE ROW LEVEL SECURITY;

-- ============ JADWAL KERJA ============
CREATE TABLE public.jadwal_kerja (
  id_jadwal UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tanggal DATE NOT NULL,
  id_karyawan UUID NOT NULL REFERENCES public.karyawan(id_karyawan) ON DELETE CASCADE,
  id_cabang UUID REFERENCES public.cabang(id_cabang) ON DELETE SET NULL,
  status_hari public.status_hari_enum NOT NULL,
  shift public.shift_enum,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tanggal, id_karyawan)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jadwal_kerja TO authenticated;
GRANT ALL ON public.jadwal_kerja TO service_role;
ALTER TABLE public.jadwal_kerja ENABLE ROW LEVEL SECURITY;

-- ============ TRANSAKSI CEKLIST HARIAN ============
CREATE TABLE public.transaksi_ceklist_harian (
  id_tugas UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
  id_karyawan UUID NOT NULL REFERENCES public.karyawan(id_karyawan) ON DELETE CASCADE,
  id_cabang UUID NOT NULL REFERENCES public.cabang(id_cabang) ON DELETE CASCADE,
  id_sop UUID NOT NULL REFERENCES public.master_ceklist_sop(id_sop) ON DELETE CASCADE,
  jam_upload TIMESTAMPTZ,
  status_upload public.status_upload_enum,
  alasan_telat TEXT,
  file_bukti TEXT[] NOT NULL DEFAULT '{}',
  status_tugas public.status_tugas_enum NOT NULL DEFAULT 'Belum Dikerjakan',
  diverifikasi_oleh UUID REFERENCES public.karyawan(id_karyawan),
  catatan_atasan TEXT,
  poin_didapat NUMERIC(6,2) NOT NULL DEFAULT 0,
  is_backup_mode BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transaksi_ceklist_harian TO authenticated;
GRANT ALL ON public.transaksi_ceklist_harian TO service_role;
ALTER TABLE public.transaksi_ceklist_harian ENABLE ROW LEVEL SECURITY;

-- ============ AUDIT LOG (foto ditolak) ============
CREATE TABLE public.tugas_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_tugas UUID NOT NULL REFERENCES public.transaksi_ceklist_harian(id_tugas) ON DELETE CASCADE,
  file_bukti_salah TEXT[] NOT NULL DEFAULT '{}',
  catatan_penolakan TEXT,
  rejected_by UUID REFERENCES public.karyawan(id_karyawan),
  rejected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tugas_audit_log TO authenticated;
GRANT ALL ON public.tugas_audit_log TO service_role;
ALTER TABLE public.tugas_audit_log ENABLE ROW LEVEL SECURITY;

-- ============ SECURITY DEFINER HELPERS ============
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS public.app_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.has_cabang_access(_user_id UUID, _id_cabang UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'Manager')
    OR EXISTS (
      SELECT 1 FROM public.karyawan_cabang_pivot
      WHERE id_karyawan = _user_id AND id_cabang = _id_cabang
    )
$$;

CREATE OR REPLACE FUNCTION public.is_account_active(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.karyawan WHERE id_karyawan = _user_id AND status_akun = 'Aktif'
  )
$$;

-- ============ RLS POLICIES ============

-- cabang: semua authenticated boleh baca; hanya Manager boleh tulis
CREATE POLICY "cabang_select_all_authenticated" ON public.cabang
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "cabang_manager_write" ON public.cabang
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'Manager'))
  WITH CHECK (public.has_role(auth.uid(), 'Manager'));

-- karyawan: Manager lihat semua, Captain lihat karyawan di cabang yg ia jaga + dirinya, Vaporista lihat dirinya
CREATE POLICY "karyawan_self_select" ON public.karyawan
  FOR SELECT TO authenticated USING (id_karyawan = auth.uid());
CREATE POLICY "karyawan_manager_select" ON public.karyawan
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'Manager'));
CREATE POLICY "karyawan_captain_select" ON public.karyawan
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'Captain')
    AND EXISTS (
      SELECT 1 FROM public.karyawan_cabang_pivot kcp
      WHERE kcp.id_karyawan = karyawan.id_karyawan
        AND kcp.id_cabang IN (
          SELECT id_cabang FROM public.karyawan_cabang_pivot WHERE id_karyawan = auth.uid()
        )
    )
  );
CREATE POLICY "karyawan_manager_write" ON public.karyawan
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'Manager'))
  WITH CHECK (public.has_role(auth.uid(), 'Manager'));

-- user_roles: hanya baca; tulis lewat service_role saja
CREATE POLICY "user_roles_self_select" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "user_roles_manager_select" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'Manager'));

-- pivot: dilihat oleh ybs, Manager, atau Captain di cabang yg sama
CREATE POLICY "pivot_self_select" ON public.karyawan_cabang_pivot
  FOR SELECT TO authenticated USING (id_karyawan = auth.uid());
CREATE POLICY "pivot_manager_select" ON public.karyawan_cabang_pivot
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'Manager'));
CREATE POLICY "pivot_captain_select" ON public.karyawan_cabang_pivot
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'Captain')
    AND id_cabang IN (
      SELECT id_cabang FROM public.karyawan_cabang_pivot WHERE id_karyawan = auth.uid()
    )
  );
CREATE POLICY "pivot_manager_write" ON public.karyawan_cabang_pivot
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'Manager'))
  WITH CHECK (public.has_role(auth.uid(), 'Manager'));

-- master_ceklist_sop: semua baca, Manager tulis
CREATE POLICY "sop_select_all" ON public.master_ceklist_sop
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "sop_manager_write" ON public.master_ceklist_sop
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'Manager'))
  WITH CHECK (public.has_role(auth.uid(), 'Manager'));

-- jadwal_kerja
CREATE POLICY "jadwal_self_select" ON public.jadwal_kerja
  FOR SELECT TO authenticated USING (id_karyawan = auth.uid());
CREATE POLICY "jadwal_manager_select" ON public.jadwal_kerja
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'Manager'));
CREATE POLICY "jadwal_captain_select" ON public.jadwal_kerja
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'Captain')
    AND (id_cabang IS NULL OR public.has_cabang_access(auth.uid(), id_cabang))
  );
CREATE POLICY "jadwal_manager_write" ON public.jadwal_kerja
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'Manager'))
  WITH CHECK (public.has_role(auth.uid(), 'Manager'));

-- transaksi_ceklist_harian
CREATE POLICY "tugas_self_select" ON public.transaksi_ceklist_harian
  FOR SELECT TO authenticated USING (id_karyawan = auth.uid());
CREATE POLICY "tugas_manager_select" ON public.transaksi_ceklist_harian
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'Manager'));
CREATE POLICY "tugas_captain_select" ON public.transaksi_ceklist_harian
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'Captain')
    AND public.has_cabang_access(auth.uid(), id_cabang)
  );

-- Vaporista insert tugas miliknya pada cabang yg ia jaga
CREATE POLICY "tugas_self_insert" ON public.transaksi_ceklist_harian
  FOR INSERT TO authenticated
  WITH CHECK (
    id_karyawan = auth.uid()
    AND public.has_cabang_access(auth.uid(), id_cabang)
  );

-- Captain juga boleh insert (mode backup) atas namanya sendiri di cabangnya
-- (sudah tercover oleh tugas_self_insert)

-- Karyawan boleh update tugas miliknya bila masih Menunggu Verifikasi atau Ditolak (re-upload)
CREATE POLICY "tugas_self_update" ON public.transaksi_ceklist_harian
  FOR UPDATE TO authenticated
  USING (
    id_karyawan = auth.uid()
    AND status_tugas IN ('Belum Dikerjakan', 'Menunggu Verifikasi', 'Ditolak')
  )
  WITH CHECK (id_karyawan = auth.uid());

-- Captain/Manager verifikasi (update) tugas — TIDAK boleh memverifikasi tugas yg ia kerjakan sendiri
CREATE POLICY "tugas_captain_verify" ON public.transaksi_ceklist_harian
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'Captain')
    AND id_karyawan <> auth.uid()
    AND public.has_cabang_access(auth.uid(), id_cabang)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'Captain')
    AND id_karyawan <> auth.uid()
    AND public.has_cabang_access(auth.uid(), id_cabang)
  );

CREATE POLICY "tugas_manager_verify" ON public.transaksi_ceklist_harian
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'Manager') AND id_karyawan <> auth.uid())
  WITH CHECK (public.has_role(auth.uid(), 'Manager') AND id_karyawan <> auth.uid());

-- Manager bisa hapus apa pun
CREATE POLICY "tugas_manager_delete" ON public.transaksi_ceklist_harian
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'Manager'));

-- tugas_audit_log
CREATE POLICY "audit_self_select" ON public.tugas_audit_log
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.transaksi_ceklist_harian t
      WHERE t.id_tugas = tugas_audit_log.id_tugas
        AND (
          t.id_karyawan = auth.uid()
          OR public.has_role(auth.uid(), 'Manager')
          OR (public.has_role(auth.uid(), 'Captain') AND public.has_cabang_access(auth.uid(), t.id_cabang))
        )
    )
  );
CREATE POLICY "audit_captain_manager_insert" ON public.tugas_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'Manager')
    OR public.has_role(auth.uid(), 'Captain')
  );

-- ============ TRIGGERS ============

-- Auto-set status_upload (Tepat Waktu / TELAT) berdasarkan jam upload vs batas SOP
CREATE OR REPLACE FUNCTION public.set_status_upload_and_poin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batas TIME;
  v_bobot INTEGER;
  v_jam   TIME;
BEGIN
  SELECT batas_jam_upload, bobot_poin INTO v_batas, v_bobot
  FROM public.master_ceklist_sop WHERE id_sop = NEW.id_sop;

  -- Saat upload pertama kali (jam_upload baru terisi)
  IF NEW.jam_upload IS NOT NULL AND (OLD.jam_upload IS NULL OR OLD.jam_upload <> NEW.jam_upload) THEN
    v_jam := (NEW.jam_upload AT TIME ZONE 'Asia/Jakarta')::TIME;
    IF v_jam <= v_batas THEN
      NEW.status_upload := 'Tepat Waktu';
    ELSE
      NEW.status_upload := 'TELAT';
    END IF;
    IF NEW.status_tugas = 'Belum Dikerjakan' OR NEW.status_tugas = 'Ditolak' THEN
      NEW.status_tugas := 'Menunggu Verifikasi';
    END IF;
  END IF;

  -- Hitung poin saat status diverifikasi
  IF NEW.status_tugas = 'Disetujui (Murni)' THEN
    NEW.poin_didapat := v_bobot;
  ELSIF NEW.status_tugas = 'Disetujui dengan Penalti' THEN
    NEW.poin_didapat := ROUND(v_bobot * 0.8, 2); -- potongan personal 20%
  ELSIF NEW.status_tugas = 'Ditolak' OR NEW.status_tugas = 'ALFA' THEN
    NEW.poin_didapat := 0;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_tugas_compute
BEFORE INSERT OR UPDATE ON public.transaksi_ceklist_harian
FOR EACH ROW EXECUTE FUNCTION public.set_status_upload_and_poin();

-- Anti-ACC sendiri: hard guard via trigger (defense in depth + UI hide)
CREATE OR REPLACE FUNCTION public.guard_anti_self_verify()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status_tugas IN ('Disetujui (Murni)', 'Disetujui dengan Penalti', 'Ditolak')
     AND NEW.diverifikasi_oleh IS NOT NULL
     AND NEW.diverifikasi_oleh = NEW.id_karyawan THEN
    RAISE EXCEPTION 'Anti-ACC: Anda tidak dapat memverifikasi tugas yang Anda kerjakan sendiri.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_tugas_anti_self_verify
BEFORE UPDATE ON public.transaksi_ceklist_harian
FOR EACH ROW EXECUTE FUNCTION public.guard_anti_self_verify();

-- Auto-create user_roles + karyawan ketika user baru dibuat (lewat metadata)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.app_role;
  v_nik  TEXT;
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
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ PG_CRON: tandai ALFA tugas yang lewat batas tanpa upload ============
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.mark_alfa_tasks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.transaksi_ceklist_harian
  SET status_upload = 'ALFA',
      status_tugas  = 'Ditolak',
      poin_didapat  = 0,
      updated_at    = now()
  WHERE status_tugas = 'Belum Dikerjakan'
    AND jam_upload IS NULL
    AND tanggal <= (CURRENT_DATE);
END;
$$;

SELECT cron.schedule(
  'hris-mark-alfa-midnight',
  '55 16 * * *',  -- 23:55 WIB = 16:55 UTC
  $$ SELECT public.mark_alfa_tasks(); $$
);
