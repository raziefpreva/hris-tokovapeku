import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CabangProgress {
  id_cabang: string;
  nama_cabang: string;
  total: number;
  done: number;
}

/**
 * Status tugas yang dihitung sebagai "selesai / acc" (sudah disetujui Manager).
 * Konsisten dipakai di seluruh dashboard (Manager, Captain, Vaporista).
 */
export const STATUS_SELESAI = [
  "Disetujui (Murni)",
  "Disetujui dengan Penalti",
] as const;

/**
 * Shared hook untuk hitung Progress Cabang Hari Ini.
 *
 * Formula seragam untuk semua role:
 *   progress = COUNT(status_tugas IN ('Disetujui (Murni)','Disetujui dengan Penalti'))
 *            / COUNT(*) tugas cabang pada tanggal tsb
 *            * 100
 *
 * @param cabangIds daftar id_cabang yang ingin ditampilkan.
 *                  Lewatkan `null` agar mengambil SEMUA cabang (Manager view).
 * @param tanggal   tanggal WIB format YYYY-MM-DD.
 */
export function useProgressCabang(
  cabangIds: string[] | null,
  tanggal: string,
): { data: CabangProgress[]; loading: boolean; reload: () => void } {
  const [data, setData] = useState<CabangProgress[]>([]);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);

  const key = cabangIds === null ? "ALL" : [...cabangIds].sort().join(",");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      // Ambil daftar cabang
      let cabQuery = supabase.from("cabang").select("id_cabang,nama_cabang").order("nama_cabang");
      if (cabangIds !== null) {
        if (cabangIds.length === 0) {
          if (!cancelled) { setData([]); setLoading(false); }
          return;
        }
        cabQuery = cabQuery.in("id_cabang", cabangIds) as typeof cabQuery;
      }
      // Ambil transaksi hari ini
      let txQuery = supabase
        .from("transaksi_ceklist_harian")
        .select("id_cabang,status_tugas")
        .eq("tanggal", tanggal);
      if (cabangIds !== null && cabangIds.length > 0) {
        txQuery = txQuery.in("id_cabang", cabangIds) as typeof txQuery;
      }
      const [{ data: cab }, { data: tx }] = await Promise.all([cabQuery, txQuery]);
      if (cancelled) return;

      const map = new Map<string, { total: number; done: number }>();
      for (const c of (cab ?? []) as { id_cabang: string }[]) {
        map.set(c.id_cabang, { total: 0, done: 0 });
      }
      for (const t of (tx ?? []) as { id_cabang: string; status_tugas: string }[]) {
        const m = map.get(t.id_cabang);
        if (!m) continue;
        m.total += 1;
        if ((STATUS_SELESAI as readonly string[]).includes(t.status_tugas)) {
          m.done += 1;
        }
      }
      setData(
        ((cab ?? []) as { id_cabang: string; nama_cabang: string }[]).map((c) => ({
          id_cabang: c.id_cabang,
          nama_cabang: c.nama_cabang,
          total: map.get(c.id_cabang)?.total ?? 0,
          done: map.get(c.id_cabang)?.done ?? 0,
        })),
      );
      setLoading(false);
    }
    load();
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tanggal, tick]);

  return { data, loading, reload: () => setTick((x) => x + 1) };
}

/**
 * Helper: tone warna berdasarkan persentase progress.
 *   <50%  → merah
 *   50-79 → kuning
 *   ≥80%  → hijau
 */
export function progressTone(pct: number): {
  text: string;
  bar: string;
} {
  if (pct >= 80) return { text: "text-emerald-700", bar: "bg-emerald-500" };
  if (pct >= 50) return { text: "text-amber-700", bar: "bg-amber-500" };
  return { text: "text-red-700", bar: "bg-red-500" };
}