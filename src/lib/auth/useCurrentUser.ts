import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getMockSession } from "./mockSession";
import { ensureMyKaryawan } from "@/lib/admin/users.functions";
import { todayWIB } from "@/lib/date-wib";

export interface CurrentUserData {
  userId: string;
  email: string | null;
  karyawan: {
    id_karyawan: string;
    nik: string;
    nama_karyawan: string;
    role: "Manager" | "Captain" | "Vaporista";
    status_akun: "Aktif" | "Nonaktif";
  } | null;
  cabangIds: string[];
  jadwalHariIni: {
    id_jadwal: string;
    status_hari: "Masuk Kerja" | "LIBUR";
    shift: string | null;
    id_cabang: string | null;
    shifts: string[];
    id_cabang_list: string[];
    assignments: { shift: string; id_cabang: string }[];
  } | null;
}

export function useCurrentUser() {
  const [data, setData] = useState<CurrentUserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setProfileError(null);
      const mock = getMockSession();
      if (mock) {
        if (!cancelled) {
          setData({
            userId: mock.userId,
            email: null,
            karyawan: {
              id_karyawan: mock.userId,
              nik: mock.nik,
              nama_karyawan: mock.nama,
              role: mock.role,
              status_akun: "Aktif",
            },
            cabangIds: [],
            jadwalHariIni: null,
          });
          setLoading(false);
        }
        return;
      }
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        if (!cancelled) {
          setData(null);
          setLoading(false);
        }
        return;
      }
      const uid = userData.user.id;
      const today = todayWIB();
      let [{ data: kar }, { data: pivot }, { data: jad }] = await Promise.all([
        supabase.from("karyawan").select("*").eq("id_karyawan", uid).maybeSingle(),
        supabase.from("karyawan_cabang_pivot").select("id_cabang").eq("id_karyawan", uid),
        supabase
          .from("jadwal_kerja")
          .select("id_jadwal,status_hari,shift,id_cabang,shifts,id_cabang_list,assignments")
          .eq("id_karyawan", uid)
          .eq("tanggal", today)
          .maybeSingle(),
      ]);
      // Fallback: profil karyawan belum dibuat (trigger gagal/akun lama) → buat sekarang
      if (!kar) {
        try {
          await ensureMyKaryawan({ data: undefined });
          const { data: refetched } = await supabase
            .from("karyawan")
            .select("*")
            .eq("id_karyawan", uid)
            .maybeSingle();
          kar = refetched;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("ensureMyKaryawan failed", e);
          if (!cancelled) setProfileError(msg);
        }
      }
      if (cancelled) return;
      // Manager: tanggung jawabnya melekat 24/7. Jika tidak ada baris jadwal
      // hari ini (atau diatur OFF/CUTI), tetap perlakukan sebagai "Masuk Kerja"
      // Full Time agar tidak pernah terkunci dari Verifikasi / monitoring.
      let effectiveJadwal: CurrentUserData["jadwalHariIni"] = jad
        ? {
            id_jadwal: (jad as any).id_jadwal,
            status_hari: (jad as any).status_hari,
            shift: (jad as any).shift ?? null,
            id_cabang: (jad as any).id_cabang ?? null,
            shifts: Array.isArray((jad as any).shifts) && (jad as any).shifts.length > 0
              ? (jad as any).shifts
              : ((jad as any).shift ? [(jad as any).shift] : []),
            id_cabang_list: Array.isArray((jad as any).id_cabang_list) && (jad as any).id_cabang_list.length > 0
              ? (jad as any).id_cabang_list
              : ((jad as any).id_cabang ? [(jad as any).id_cabang] : []),
            assignments: Array.isArray((jad as any).assignments)
              ? ((jad as any).assignments as { shift: string; id_cabang: string }[]).filter(
                  (a) => a && a.shift && a.id_cabang,
                )
              : [],
          }
        : null;
      if (kar?.role === "Manager") {
        if (!effectiveJadwal) {
          effectiveJadwal = {
            id_jadwal: "manager-auto",
            status_hari: "Masuk Kerja",
            shift: "Full Time",
            id_cabang: null,
            shifts: ["Full Time"],
            id_cabang_list: [],
            assignments: [],
          };
        } else if (effectiveJadwal.status_hari !== "Masuk Kerja") {
          effectiveJadwal = {
            ...effectiveJadwal,
            status_hari: "Masuk Kerja",
            shift: effectiveJadwal.shift ?? "Full Time",
            shifts: effectiveJadwal.shifts.length > 0 ? effectiveJadwal.shifts : ["Full Time"],
          };
        }
      }
      setData({
        userId: uid,
        email: userData.user.email ?? null,
        karyawan: kar as CurrentUserData["karyawan"],
        cabangIds: (pivot ?? []).map((p: { id_cabang: string }) => p.id_cabang),
        jadwalHariIni: effectiveJadwal,
      });
      setLoading(false);
    }
    load();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        load();
      }
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [tick]);

  return { data, loading, profileError, reload: () => setTick((t) => t + 1) };
}