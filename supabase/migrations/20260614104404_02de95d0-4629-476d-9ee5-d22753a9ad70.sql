CREATE OR REPLACE FUNCTION public.set_status_upload_and_poin()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_batas TIME;
  v_bobot INTEGER;
  v_jam   TIME;
BEGIN
  SELECT batas_jam_upload, bobot_poin INTO v_batas, v_bobot
  FROM public.master_ceklist_sop WHERE id_sop = NEW.id_sop;

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

  IF NEW.status_tugas = 'Disetujui (Murni)' THEN
    NEW.poin_didapat := v_bobot;
  ELSIF NEW.status_tugas = 'Disetujui dengan Penalti' THEN
    NEW.poin_didapat := ROUND(v_bobot * 0.8, 2);
  ELSIF NEW.status_tugas = 'Ditolak' OR NEW.status_upload = 'ALFA' THEN
    NEW.poin_didapat := 0;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;