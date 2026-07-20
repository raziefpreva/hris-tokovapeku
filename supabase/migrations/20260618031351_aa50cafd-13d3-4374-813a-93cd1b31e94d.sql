
DO $$ BEGIN
  CREATE TYPE public.flow_type_enum AS ENUM (
    'vaporista_to_captain',
    'captain_to_manager',
    'backup_to_captain_pic',
    'manager_direct'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.transaksi_ceklist_harian
  ADD COLUMN IF NOT EXISTS flow_type public.flow_type_enum;

CREATE OR REPLACE FUNCTION public.set_flow_type()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target uuid;
  v_role public.app_role;
BEGIN
  IF NEW.flow_type IS NOT NULL THEN
    RETURN NEW;
  END IF;
  SELECT target_karyawan_id INTO v_target FROM public.master_ceklist_sop WHERE id_sop = NEW.id_sop;
  SELECT role INTO v_role FROM public.karyawan WHERE id_karyawan = NEW.id_karyawan;

  IF v_target IS NOT NULL THEN
    NEW.flow_type := 'manager_direct';
  ELSIF v_role = 'Captain' AND COALESCE(NEW.is_backup_mode, false) = true THEN
    NEW.flow_type := 'backup_to_captain_pic';
  ELSIF v_role = 'Captain' THEN
    NEW.flow_type := 'captain_to_manager';
  ELSE
    NEW.flow_type := 'vaporista_to_captain';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_flow_type ON public.transaksi_ceklist_harian;
CREATE TRIGGER trg_set_flow_type
  BEFORE INSERT ON public.transaksi_ceklist_harian
  FOR EACH ROW EXECUTE FUNCTION public.set_flow_type();

-- Backfill
UPDATE public.transaksi_ceklist_harian t
SET flow_type = CASE
  WHEN s.target_karyawan_id IS NOT NULL THEN 'manager_direct'::public.flow_type_enum
  WHEN k.role = 'Captain' AND COALESCE(t.is_backup_mode,false) = true THEN 'backup_to_captain_pic'::public.flow_type_enum
  WHEN k.role = 'Captain' THEN 'captain_to_manager'::public.flow_type_enum
  ELSE 'vaporista_to_captain'::public.flow_type_enum
END
FROM public.master_ceklist_sop s, public.karyawan k
WHERE s.id_sop = t.id_sop AND k.id_karyawan = t.id_karyawan AND t.flow_type IS NULL;
