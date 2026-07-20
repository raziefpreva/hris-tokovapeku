import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app/AppShell";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { MultiSelectCabang, type CabangOption } from "@/components/app/MultiSelectCabang";
import { useServerFn } from "@tanstack/react-start";
import { createKaryawan, updateKaryawan } from "@/lib/admin/users.functions";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/master/karyawan")({
  ssr: false,
  component: KaryawanPage,
});

interface Karyawan {
  id_karyawan: string;
  nik: string;
  nama_karyawan: string;
  role: "Manager" | "Captain" | "Vaporista";
  status_akun: "Aktif" | "Nonaktif";
  no_hp: string | null;
  divisi: string | null;
  jabatan: string | null;
  email: string | null;
  gaji_pokok: number | null;
  jatah_cuti: number | null;
  tanggal_mulai_kerja: string | null;
  status_kontrak: string | null;
  tanggal_berakhir_kontrak: string | null;
  // Step 2: Data Personal
  nomor_ktp: string | null;
  nomor_kk: string | null;
  tempat_lahir: string | null;
  tanggal_lahir: string | null;
  alamat_tinggal: string | null;
  alamat_ktp: string | null;
  nomor_telepon_2: string | null;
  deskripsi: string | null;
  jenis_kelamin: string | null;
  status_pernikahan: string | null;
  agama: string | null;
  golongan_darah: string | null;
  tinggi_badan: number | null;
  berat_badan: number | null;
  nama_orang_tua_ayah: string | null;
  nama_orang_tua_ibu: string | null;
  jumlah_anggota_kk: number | null;
  kontak_darurat_nama: string | null;
  kontak_darurat_telepon: string | null;
  kontak_darurat_status: string | null;
  status_pegawai: string | null;
  tingkat_resiko: string | null;
  // Step 3: Pendidikan
  pendidikan: { nama_sekolah: string; jenjang: string; jurusan: string; tahun_masuk: string; tahun_selesai: string }[];
  // Step 4: Arsip File
  arsip_file: { nama_dokumen: string; url: string }[];
  // Step 5: Data Keuangan
  npwp_nomor: string | null;
  npwp_nama: string | null;
  npwp_alamat: string | null;
  bank_nama: string | null;
  bank_nomor_rekening: string | null;
  bank_nama_pemilik: string | null;
}

type SortKey = "nik" | "nama_karyawan" | "divisi" | "jabatan" | "role" | "cabang" | "status_akun";

function KaryawanPage() {
  const { data } = useCurrentUser();
  const create = useServerFn(createKaryawan);
  const update = useServerFn(updateKaryawan);
  const [list, setList] = useState<Karyawan[]>([]);
  const [cabang, setCabang] = useState<CabangOption[]>([]);
  const [pivot, setPivot] = useState<Record<string, string[]>>({});
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [originalNik, setOriginalNik] = useState("");
  const [divisiExtra, setDivisiExtra] = useState<string[]>([]);
  const [jabatanExtra, setJabatanExtra] = useState<string[]>([]);
  const emptyForm = {
    nik: "", nama: "", password: "", no_hp: "", role: "Vaporista" as Karyawan["role"],
    cabangIds: [] as string[], status: "Aktif" as Karyawan["status_akun"],
    divisi: "", jabatan: "", email: "", gaji_pokok: "", jatah_cuti: "12",
    tanggal_mulai_kerja: "", status_kontrak: "Tetap", tanggal_berakhir_kontrak: "",
    // Step 2
    nomor_ktp: "", nomor_kk: "", tempat_lahir: "", tanggal_lahir: "",
    alamat_tinggal: "", alamat_ktp: "", nomor_telepon_2: "", deskripsi: "",
    jenis_kelamin: "Laki-Laki", status_pernikahan: "Lajang", agama: "Islam",
    golongan_darah: "", tinggi_badan: "", berat_badan: "",
    nama_orang_tua_ayah: "", nama_orang_tua_ibu: "", jumlah_anggota_kk: "",
    kontak_darurat_nama: "", kontak_darurat_telepon: "", kontak_darurat_status: "Orang Tua",
    status_pegawai: "Penerima Upah", tingkat_resiko: "Sangat Rendah",
    // Step 3
    pendidikan: [] as { nama_sekolah: string; jenjang: string; jurusan: string; tahun_masuk: string; tahun_selesai: string }[],
    // Step 4
    arsip_file: [] as { nama_dokumen: string; file: File | null; url: string }[],
    // Step 5
    npwp_nomor: "", npwp_nama: "", npwp_alamat: "",
    bank_nama: "BCA", bank_nomor_rekening: "", bank_nama_pemilik: "",
  };
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(1);
  const STEPS = [
    { num: 1, label: "Data Kantor" },
    { num: 2, label: "Data Personal" },
    { num: 3, label: "Pendidikan" },
    { num: 4, label: "Arsip File" },
    { num: 5, label: "Data Keuangan" },
  ];
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("nama_karyawan");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [nikError, setNikError] = useState("");
  const [nikChecking, setNikChecking] = useState(false);

  async function generateNik(): Promise<string> {
    const tahun = new Date().getFullYear().toString().slice(-2); // "26"
    const prefix = tahun;
    // Ambil semua NIK yang diawali tahun ini
    const { data: rows } = await supabase
      .from("karyawan")
      .select("nik")
      .like("nik", `${prefix}%`)
      .order("nik", { ascending: false });
    const existing = (rows ?? []).map((r: any) => r.nik);
    // Cari nomor urut tertinggi
    let maxUrut = 0;
    for (const nik of existing) {
      const urut = parseInt(nik.slice(2));
      if (!isNaN(urut) && urut > maxUrut) maxUrut = urut;
    }
    const nextUrut = String(maxUrut + 1).padStart(5, "0");
    return `${prefix}${nextUrut}`;
  }

  async function validateNik(nik: string, currentId?: string | null) {
    if (!nik.trim()) { setNikError("NIK wajib diisi."); return false; }
    if (!/^\d{7}$/.test(nik)) { setNikError("NIK harus 7 digit angka."); return false; }
    setNikChecking(true);
    const { data: rows } = await supabase.from("karyawan").select("id_karyawan").eq("nik", nik);
    setNikChecking(false);
    const duplicate = (rows ?? []).find((r: any) => r.id_karyawan !== currentId);
    if (duplicate) { setNikError("NIK sudah digunakan karyawan lain."); return false; }
    setNikError("");
    return true;
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ChevronsUpDown className="ml-1 inline h-3 w-3 opacity-40" />;
    return sortDir === "asc"
      ? <ChevronUp className="ml-1 inline h-3 w-3" />
      : <ChevronDown className="ml-1 inline h-3 w-3" />;
  }

  async function reload() {
    const [{ data: kar }, { data: cab }, { data: piv }] = await Promise.all([
      supabase.from("karyawan").select("*").order("nama_karyawan"),
      supabase.from("cabang").select("id_cabang,nama_cabang").order("nama_cabang"),
      supabase.from("karyawan_cabang_pivot").select("id_karyawan,id_cabang"),
    ]);
    setList((kar ?? []) as Karyawan[]);
    setCabang((cab ?? []) as CabangOption[]);
    const map: Record<string, string[]> = {};
    (piv ?? []).forEach((p: any) => {
      (map[p.id_karyawan] ||= []).push(p.id_cabang);
    });
    setPivot(map);
  }
  useEffect(() => { reload(); }, []);

  if (!data?.karyawan) return null;
  if (data.karyawan.role !== "Manager") {
    return (
      <AppShell role={data.karyawan.role} nama={data.karyawan.nama_karyawan} nik={data.karyawan.nik}>
        <Card><CardHeader><CardTitle>Akses ditolak</CardTitle></CardHeader></Card>
      </AppShell>
    );
  }

  async function openCreate() {
    setEditId(null);
    setOriginalNik("");
    setStep(1);
    setNikError("");
    const autoNik = await generateNik();
    setForm({ ...emptyForm, nik: autoNik });
    setOpen(true);
  }
  function openEdit(k: Karyawan) {
    setEditId(k.id_karyawan);
    setOriginalNik(k.nik);
    setStep(1);
    setNikError("");
    setForm({
      ...emptyForm,
      nik: k.nik, nama: k.nama_karyawan, password: "",
      no_hp: k.no_hp ?? "", role: k.role,
      cabangIds: pivot[k.id_karyawan] ?? [],
      status: k.status_akun, divisi: k.divisi ?? "", jabatan: k.jabatan ?? k.role ?? "",
      email: k.email ?? "",
      gaji_pokok: k.gaji_pokok != null ? String(k.gaji_pokok) : "",
      jatah_cuti: k.jatah_cuti != null ? String(k.jatah_cuti) : "12",
      tanggal_mulai_kerja: k.tanggal_mulai_kerja ?? "",
      status_kontrak: k.status_kontrak ?? "Tetap",
      tanggal_berakhir_kontrak: k.tanggal_berakhir_kontrak ?? "",
      // Step 2
      nomor_ktp: k.nomor_ktp ?? "", nomor_kk: k.nomor_kk ?? "",
      tempat_lahir: k.tempat_lahir ?? "", tanggal_lahir: k.tanggal_lahir ?? "",
      alamat_tinggal: k.alamat_tinggal ?? "", alamat_ktp: k.alamat_ktp ?? "",
      nomor_telepon_2: k.nomor_telepon_2 ?? "", deskripsi: k.deskripsi ?? "",
      jenis_kelamin: k.jenis_kelamin ?? "Laki-Laki",
      status_pernikahan: k.status_pernikahan ?? "Lajang",
      agama: k.agama ?? "Islam", golongan_darah: k.golongan_darah ?? "",
      tinggi_badan: k.tinggi_badan != null ? String(k.tinggi_badan) : "",
      berat_badan: k.berat_badan != null ? String(k.berat_badan) : "",
      nama_orang_tua_ayah: k.nama_orang_tua_ayah ?? "",
      nama_orang_tua_ibu: k.nama_orang_tua_ibu ?? "",
      jumlah_anggota_kk: k.jumlah_anggota_kk != null ? String(k.jumlah_anggota_kk) : "",
      kontak_darurat_nama: k.kontak_darurat_nama ?? "",
      kontak_darurat_telepon: k.kontak_darurat_telepon ?? "",
      kontak_darurat_status: k.kontak_darurat_status ?? "Orang Tua",
      status_pegawai: k.status_pegawai ?? "Penerima Upah",
      tingkat_resiko: k.tingkat_resiko ?? "Sangat Rendah",
      // Step 3
      pendidikan: Array.isArray(k.pendidikan) ? k.pendidikan : [],
      // Step 4
      arsip_file: (Array.isArray(k.arsip_file) ? k.arsip_file : []).map((a: any) => ({ ...a, file: null })),
      // Step 5
      npwp_nomor: k.npwp_nomor ?? "", npwp_nama: k.npwp_nama ?? "",
      npwp_alamat: k.npwp_alamat ?? "", bank_nama: k.bank_nama ?? "BCA",
      bank_nomor_rekening: k.bank_nomor_rekening ?? "",
      bank_nama_pemilik: k.bank_nama_pemilik ?? "",
    });
    setOpen(true);
  }

  async function handleSubmit() {
    console.log("[KaryawanModal] Simpan diklik");
    console.log("[KaryawanModal] editId:", editId, "originalNik:", originalNik);
    console.log("[KaryawanModal] Data form:", form);
    setBusy(true);
    try {
      const cleanNik = form.nik.trim();
      const cleanNama = form.nama.trim();
      console.log("[KaryawanModal] cleanNik:", cleanNik, "cleanNama:", cleanNama);
      if (!cleanNama) throw new Error("Nama lengkap wajib diisi.");
      const nikValid = await validateNik(cleanNik, editId);
      if (!nikValid) { setBusy(false); return; }
      if (editId) {
        const payload = {
          data: {
            id_karyawan: editId,
            nik: cleanNik,
            original_nik: originalNik || cleanNik,
            nama_karyawan: cleanNama,
            role: form.role,
            status_akun: form.status,
            cabang_ids: form.cabangIds,
            new_password: form.password || undefined,
            no_hp: form.no_hp.trim() || null,
            divisi: form.divisi.trim() || null,
            jabatan: form.jabatan.trim() || null,
            email: form.email.trim() || null,
            gaji_pokok: form.gaji_pokok ? parseInt(form.gaji_pokok) : null,
            jatah_cuti: form.jatah_cuti ? parseInt(form.jatah_cuti) : 12,
            tanggal_mulai_kerja: form.tanggal_mulai_kerja || null,
            status_kontrak: form.status_kontrak || "Tetap",
            tanggal_berakhir_kontrak: form.tanggal_berakhir_kontrak || null,
            nomor_ktp: form.nomor_ktp || null,
            nomor_kk: form.nomor_kk || null,
            tempat_lahir: form.tempat_lahir || null,
            tanggal_lahir: form.tanggal_lahir || null,
            alamat_tinggal: form.alamat_tinggal || null,
            alamat_ktp: form.alamat_ktp || null,
            nomor_telepon_2: form.nomor_telepon_2 || null,
            deskripsi: form.deskripsi || null,
            jenis_kelamin: form.jenis_kelamin || null,
            status_pernikahan: form.status_pernikahan || null,
            agama: form.agama || null,
            golongan_darah: form.golongan_darah || null,
            tinggi_badan: form.tinggi_badan ? parseInt(String(form.tinggi_badan)) : null,
            berat_badan: form.berat_badan ? parseInt(String(form.berat_badan)) : null,
            nama_orang_tua_ayah: form.nama_orang_tua_ayah || null,
            nama_orang_tua_ibu: form.nama_orang_tua_ibu || null,
            jumlah_anggota_kk: form.jumlah_anggota_kk ? parseInt(String(form.jumlah_anggota_kk)) : null,
            kontak_darurat_nama: form.kontak_darurat_nama || null,
            kontak_darurat_telepon: form.kontak_darurat_telepon || null,
            kontak_darurat_status: form.kontak_darurat_status || null,
            status_pegawai: form.status_pegawai || null,
            tingkat_resiko: form.tingkat_resiko || null,
            pendidikan: form.pendidikan,
            arsip_file: form.arsip_file.map(({ file: _, ...rest }) => rest),
            npwp_nomor: form.npwp_nomor || null,
            npwp_nama: form.npwp_nama || null,
            npwp_alamat: form.npwp_alamat || null,
            bank_nama: form.bank_nama || null,
            bank_nomor_rekening: form.bank_nomor_rekening || null,
            bank_nama_pemilik: form.bank_nama_pemilik || null,
          },
        };
        console.log("[KaryawanModal] Menjalankan updateKaryawan dengan payload:", payload);
        const res = await update(payload as any);
        console.log("[KaryawanModal] Response updateKaryawan:", res);
        toast.success("Data karyawan berhasil diperbarui");
      } else {
        if (!form.password) { toast.error("Password wajib untuk akun baru"); setBusy(false); return; }
        if (form.password.length < 6) { toast.error("Password minimal 6 karakter"); setBusy(false); return; }
        const createPayload = {
          data: {
            nik: cleanNik,
            nama_karyawan: cleanNama,
            password: form.password || "123456",
            role: form.role,
            cabang_ids: form.cabangIds,
            no_hp: form.no_hp.trim() || null,
            divisi: form.divisi.trim() || null,
            jabatan: form.jabatan.trim() || null,
            email: form.email.trim() || null,
            gaji_pokok: form.gaji_pokok ? parseInt(form.gaji_pokok) : null,
            jatah_cuti: form.jatah_cuti ? parseInt(form.jatah_cuti) : 12,
            tanggal_mulai_kerja: form.tanggal_mulai_kerja || null,
            status_kontrak: form.status_kontrak || "Tetap",
            tanggal_berakhir_kontrak: form.tanggal_berakhir_kontrak || null,
            nomor_ktp: form.nomor_ktp || null,
            nomor_kk: form.nomor_kk || null,
            tempat_lahir: form.tempat_lahir || null,
            tanggal_lahir: form.tanggal_lahir || null,
            alamat_tinggal: form.alamat_tinggal || null,
            alamat_ktp: form.alamat_ktp || null,
            nomor_telepon_2: form.nomor_telepon_2 || null,
            deskripsi: form.deskripsi || null,
            jenis_kelamin: form.jenis_kelamin || null,
            status_pernikahan: form.status_pernikahan || null,
            agama: form.agama || null,
            golongan_darah: form.golongan_darah || null,
            tinggi_badan: form.tinggi_badan ? parseInt(String(form.tinggi_badan)) : null,
            berat_badan: form.berat_badan ? parseInt(String(form.berat_badan)) : null,
            nama_orang_tua_ayah: form.nama_orang_tua_ayah || null,
            nama_orang_tua_ibu: form.nama_orang_tua_ibu || null,
            jumlah_anggota_kk: form.jumlah_anggota_kk ? parseInt(String(form.jumlah_anggota_kk)) : null,
            kontak_darurat_nama: form.kontak_darurat_nama || null,
            kontak_darurat_telepon: form.kontak_darurat_telepon || null,
            kontak_darurat_status: form.kontak_darurat_status || null,
            status_pegawai: form.status_pegawai || null,
            tingkat_resiko: form.tingkat_resiko || null,
            pendidikan: form.pendidikan,
            arsip_file: form.arsip_file.map(({ file: _, ...rest }) => rest),
            npwp_nomor: form.npwp_nomor || null,
            npwp_nama: form.npwp_nama || null,
            npwp_alamat: form.npwp_alamat || null,
            bank_nama: form.bank_nama || null,
            bank_nomor_rekening: form.bank_nomor_rekening || null,
            bank_nama_pemilik: form.bank_nama_pemilik || null,
          },
        };
        console.log("[KaryawanModal] Menjalankan createKaryawan dengan payload:", createPayload);
        const res = await create(createPayload as any);
        console.log("[KaryawanModal] Response createKaryawan:", res);
        toast.success("Karyawan baru berhasil ditambahkan");
      }
      setOpen(false);
      await reload();
      setOriginalNik(cleanNik);
      console.log("[KaryawanModal] Selesai sukses, modal ditutup & reload dipanggil");
    } catch (e: any) {
      console.error("[KaryawanModal] ERROR saat simpan:", e);
      toast.error(e?.message ?? "Gagal");
    } finally {
      setBusy(false);
    }
  }

  const isManager = data?.karyawan?.role === "Manager";

  const filteredAndSorted = (() => {
    const q = search.toLowerCase().trim();
    const filtered = q
      ? list.filter(k => {
          const cIds = pivot[k.id_karyawan] ?? [];
          const cNames = cabang.filter(c => cIds.includes(c.id_cabang)).map(c => c.nama_cabang.toLowerCase());
          return (
            k.nik.toLowerCase().includes(q) ||
            k.nama_karyawan.toLowerCase().includes(q) ||
            (k.divisi ?? "").toLowerCase().includes(q) ||
            (k.jabatan ?? "").toLowerCase().includes(q) ||
            k.role.toLowerCase().includes(q) ||
            k.status_akun.toLowerCase().includes(q) ||
            cNames.some(n => n.includes(q))
          );
        })
      : list;

    return [...filtered].sort((a, b) => {
      let valA = "";
      let valB = "";
      if (sortKey === "cabang") {
        const cA = cabang.filter(c => (pivot[a.id_karyawan] ?? []).includes(c.id_cabang)).map(c => c.nama_cabang).join(", ");
        const cB = cabang.filter(c => (pivot[b.id_karyawan] ?? []).includes(c.id_cabang)).map(c => c.nama_cabang).join(", ");
        valA = cA; valB = cB;
      } else {
        valA = String((a as any)[sortKey] ?? "");
        valB = String((b as any)[sortKey] ?? "");
      }
      return sortDir === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
    });
  })();
  const divisiOptions = Array.from(
    new Set([
      "Retail",
      ...list.map((k) => k.divisi).filter((v): v is string => !!v),
      ...divisiExtra,
      ...(form.divisi ? [form.divisi] : []),
    ]),
  );
  const jabatanOptions = Array.from(
    new Set([
      "Vaporista",
      "Captain",
      "Manager",
      ...list.map((k) => k.jabatan).filter((v): v is string => !!v),
      ...jabatanExtra,
      ...(form.jabatan ? [form.jabatan] : []),
    ]),
  );

  function handleDivisiChange(v: string) {
    if (v === "__add__") {
      const nv = window.prompt("Nama divisi baru:")?.trim();
      if (!nv) return;
      setDivisiExtra((prev) => Array.from(new Set([...prev, nv])));
      setForm((f) => ({ ...f, divisi: nv }));
      return;
    }
    setForm((f) => ({ ...f, divisi: v }));
  }
  function handleJabatanChange(v: string) {
    if (v === "__add__") {
      if (!isManager) { toast.error("Hanya Manager yang dapat menambah jabatan baru."); return; }
      const nv = window.prompt("Nama jabatan baru:")?.trim();
      if (!nv) return;
      setJabatanExtra((prev) => Array.from(new Set([...prev, nv])));
      setForm((f) => ({ ...f, jabatan: nv }));
      return;
    }
    setForm((f) => ({ ...f, jabatan: v }));
  }

  return (
    <AppShell role={data.karyawan.role} nama={data.karyawan.nama_karyawan} nik={data.karyawan.nik}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Master Karyawan</h1>
            <p className="text-sm text-muted-foreground">Akun, role, dan penempatan cabang.</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Tambah Karyawan</Button></DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] p-0 gap-0">
              <DialogHeader className="px-6 pt-6 pb-0">
                <DialogTitle>{editId ? "Edit Karyawan" : "Karyawan Baru"}</DialogTitle>
              </DialogHeader>

              {/* Step indicator */}
              <div className="flex border-b mt-4 overflow-x-auto">
                {STEPS.map((s) => (
                  <button
                    key={s.num}
                    type="button"
                    disabled={s.num > 1 && !form.nik || s.num > 1 && !form.nama}
                    onClick={() => setStep(s.num)}
                    className={cn(
                      "flex items-center gap-1.5 px-4 py-3 text-xs font-semibold whitespace-nowrap border-b-2 transition",
                      step === s.num
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <span className={cn(
                      "inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold",
                      step === s.num ? "bg-primary text-white" : s.num < step ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground",
                    )}>{s.num}</span>
                    {s.label}
                  </button>
                ))}
              </div>

              {/* Step 1: Data Kantor */}
              {step === 1 && (
                <div className="space-y-3 overflow-y-auto max-h-[55vh] px-6 py-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>NIK</Label>
                      <div className="relative">
                        <Input
                          type="text"
                          value={form.nik}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, "").slice(0, 7);
                            setForm((prev) => ({ ...prev, nik: val }));
                            setNikError("");
                            if (val.length === 7) validateNik(val, editId);
                          }}
                          autoComplete="off"
                          maxLength={7}
                          className={cn(nikError ? "border-destructive focus-visible:ring-destructive" : "")}
                          placeholder="Auto-generate"
                        />
                        {nikChecking && <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
                      </div>
                      {nikError && <p className="text-xs text-destructive mt-1">{nikError}</p>}
                      <p className="text-[11px] text-muted-foreground mt-1">Format: 2 digit tahun + 5 digit urutan (contoh: 2600010)</p>
                    </div>
                    <div>
                      <Label>Nama Lengkap</Label>
                      <Input value={form.nama} onChange={(e) => setForm((prev) => ({ ...prev, nama: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Email</Label>
                      <Input type="email" value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} placeholder="email@contoh.com" />
                    </div>
                    <div>
                      <Label>No. HP</Label>
                      <Input value={form.no_hp} onChange={(e) => setForm((prev) => ({ ...prev, no_hp: e.target.value }))} placeholder="08xxxxxxxxxx" />
                    </div>
                    <div>
                      <Label>Divisi</Label>
                      <Select value={form.divisi || undefined} onValueChange={handleDivisiChange}>
                        <SelectTrigger><SelectValue placeholder="Pilih divisi" /></SelectTrigger>
                        <SelectContent>
                          {divisiOptions.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                          <SelectItem value="__add__" className="text-primary font-medium">+ Tambah Divisi Baru</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Jabatan</Label>
                      <Select value={form.jabatan || undefined} onValueChange={handleJabatanChange}>
                        <SelectTrigger><SelectValue placeholder="Pilih jabatan" /></SelectTrigger>
                        <SelectContent>
                          {jabatanOptions.map((j) => <SelectItem key={j} value={j}>{j}</SelectItem>)}
                          {isManager && <SelectItem value="__add__" className="text-primary font-medium">+ Tambah Jabatan Baru</SelectItem>}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Gaji Pokok</Label>
                      <Input type="number" value={form.gaji_pokok} onChange={(e) => setForm((prev) => ({ ...prev, gaji_pokok: e.target.value }))} placeholder="0" className="tabular-nums" />
                    </div>
                    <div>
                      <Label>Jatah Cuti / Tahun</Label>
                      <Input type="number" value={form.jatah_cuti} onChange={(e) => setForm((prev) => ({ ...prev, jatah_cuti: e.target.value }))} placeholder="12" className="tabular-nums" />
                    </div>
                    <div>
                      <Label>Tanggal Mulai Kerja</Label>
                      <Input type="date" value={form.tanggal_mulai_kerja} onChange={(e) => setForm((prev) => ({ ...prev, tanggal_mulai_kerja: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Status Kontrak</Label>
                      <Select value={form.status_kontrak} onValueChange={(v) => setForm((prev) => ({ ...prev, status_kontrak: v, tanggal_berakhir_kontrak: v === "Tetap" ? "" : prev.tanggal_berakhir_kontrak }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Tetap">Tetap</SelectItem>
                          <SelectItem value="Kontrak">Kontrak</SelectItem>
                          <SelectItem value="Magang">Magang</SelectItem>
                          <SelectItem value="Freelance">Freelance</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {form.status_kontrak !== "Tetap" && (
                      <div>
                        <Label>Tanggal Berakhir Kontrak</Label>
                        <Input type="date" value={form.tanggal_berakhir_kontrak} onChange={(e) => setForm((prev) => ({ ...prev, tanggal_berakhir_kontrak: e.target.value }))} />
                      </div>
                    )}
                  </div>
                  <div className="border-t pt-3 space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Akun & Akses</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Role</Label>
                        <Select value={form.role} onValueChange={(v) => setForm((prev) => ({ ...prev, role: v as Karyawan["role"] }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Vaporista">Vaporista</SelectItem>
                            <SelectItem value="Captain">Captain</SelectItem>
                            <SelectItem value="Manager">Manager</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Status Akun</Label>
                        <Select value={form.status} onValueChange={(v) => setForm((prev) => ({ ...prev, status: v as Karyawan["status_akun"] }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Aktif">Aktif</SelectItem>
                            <SelectItem value="Nonaktif">Nonaktif</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label>{editId ? "Password Baru (kosongkan jika tidak diubah)" : "Password"}</Label>
                      <Input type="password" value={form.password} onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))} placeholder="Minimal 6 karakter" />
                    </div>
                    <div>
                      <Label>Penempatan Cabang</Label>
                      <MultiSelectCabang options={cabang} value={form.cabangIds} onChange={(v) => setForm((prev) => ({ ...prev, cabangIds: v }))} />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Data Personal */}
              {step === 2 && (
                <div className="space-y-4 overflow-y-auto max-h-[55vh] px-6 py-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Nomor KTP</Label>
                      <Input value={form.nomor_ktp} onChange={e => setForm(p => ({ ...p, nomor_ktp: e.target.value }))} placeholder="3175011812990002" maxLength={16} />
                    </div>
                    <div>
                      <Label>Nomor KK</Label>
                      <Input value={form.nomor_kk} onChange={e => setForm(p => ({ ...p, nomor_kk: e.target.value }))} placeholder="3175010801094472" maxLength={16} />
                    </div>
                    <div>
                      <Label>Tempat Lahir</Label>
                      <Input value={form.tempat_lahir} onChange={e => setForm(p => ({ ...p, tempat_lahir: e.target.value }))} placeholder="Jakarta" />
                    </div>
                    <div>
                      <Label>Tanggal Lahir</Label>
                      <Input type="date" value={form.tanggal_lahir} onChange={e => setForm(p => ({ ...p, tanggal_lahir: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <Label>Alamat Tinggal</Label>
                    <Textarea value={form.alamat_tinggal} onChange={e => setForm(p => ({ ...p, alamat_tinggal: e.target.value }))} placeholder="Jl. ..." rows={2} />
                  </div>
                  <div>
                    <Label>Alamat KTP</Label>
                    <Textarea value={form.alamat_ktp} onChange={e => setForm(p => ({ ...p, alamat_ktp: e.target.value }))} placeholder="Jl. ..." rows={2} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>No. Telepon 2</Label>
                      <Input value={form.nomor_telepon_2} onChange={e => setForm(p => ({ ...p, nomor_telepon_2: e.target.value }))} placeholder="08xxxxxxxxxx" />
                    </div>
                    <div>
                      <Label>Jenis Kelamin</Label>
                      <Select value={form.jenis_kelamin} onValueChange={v => setForm(p => ({ ...p, jenis_kelamin: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Laki-Laki">Laki-Laki</SelectItem>
                          <SelectItem value="Perempuan">Perempuan</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Status Pernikahan</Label>
                      <Select value={form.status_pernikahan} onValueChange={v => setForm(p => ({ ...p, status_pernikahan: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["Lajang", "Nikah", "Janda", "Duda"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Agama</Label>
                      <Select value={form.agama} onValueChange={v => setForm(p => ({ ...p, agama: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["Islam", "Kristen", "Katolik", "Hindu", "Budha"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Golongan Darah</Label>
                      <Select value={form.golongan_darah || undefined} onValueChange={v => setForm(p => ({ ...p, golongan_darah: v }))}>
                        <SelectTrigger><SelectValue placeholder="Pilih..." /></SelectTrigger>
                        <SelectContent>
                          {["O", "A", "B", "AB"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Tinggi Badan (cm)</Label>
                      <Input type="number" value={form.tinggi_badan} onChange={e => setForm(p => ({ ...p, tinggi_badan: e.target.value }))} placeholder="170" />
                    </div>
                    <div>
                      <Label>Berat Badan (kg)</Label>
                      <Input type="number" value={form.berat_badan} onChange={e => setForm(p => ({ ...p, berat_badan: e.target.value }))} placeholder="65" />
                    </div>
                    <div>
                      <Label>Nama Ayah</Label>
                      <Input value={form.nama_orang_tua_ayah} onChange={e => setForm(p => ({ ...p, nama_orang_tua_ayah: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Nama Ibu</Label>
                      <Input value={form.nama_orang_tua_ibu} onChange={e => setForm(p => ({ ...p, nama_orang_tua_ibu: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Jumlah Anggota KK</Label>
                      <Input type="number" value={form.jumlah_anggota_kk} onChange={e => setForm(p => ({ ...p, jumlah_anggota_kk: e.target.value }))} />
                    </div>
                  </div>
                  <div className="border-t pt-3 space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Kontak Darurat</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Nama</Label>
                        <Input value={form.kontak_darurat_nama} onChange={e => setForm(p => ({ ...p, kontak_darurat_nama: e.target.value }))} />
                      </div>
                      <div>
                        <Label>No. Telepon</Label>
                        <Input value={form.kontak_darurat_telepon} onChange={e => setForm(p => ({ ...p, kontak_darurat_telepon: e.target.value }))} />
                      </div>
                      <div>
                        <Label>Hubungan</Label>
                        <Select value={form.kontak_darurat_status} onValueChange={v => setForm(p => ({ ...p, kontak_darurat_status: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["Orang Tua", "Pasangan", "Saudara", "Teman", "Lainnya"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Status Pegawai</Label>
                        <Select value={form.status_pegawai} onValueChange={v => setForm(p => ({ ...p, status_pegawai: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["Penerima Upah", "Bukan Penerima Upah"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Tingkat Risiko Pekerjaan</Label>
                        <Select value={form.tingkat_resiko} onValueChange={v => setForm(p => ({ ...p, tingkat_resiko: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["Sangat Rendah", "Rendah", "Sedang", "Tinggi", "Sangat Tinggi"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  <div>
                    <Label>Deskripsi</Label>
                    <Textarea value={form.deskripsi} onChange={e => setForm(p => ({ ...p, deskripsi: e.target.value }))} rows={3} />
                  </div>
                </div>
              )}

              {/* Step 3: Pendidikan */}
              {step === 3 && (
                <div className="space-y-3 overflow-y-auto max-h-[55vh] px-6 py-4">
                  {form.pendidikan.map((p, i) => (
                    <div key={i} className="grid grid-cols-5 gap-2 rounded-md border p-3 relative">
                      <Input placeholder="Nama Sekolah / Universitas" value={p.nama_sekolah} className="col-span-5" onChange={e => {
                        const arr = [...form.pendidikan]; arr[i] = { ...arr[i], nama_sekolah: e.target.value }; setForm(f => ({ ...f, pendidikan: arr }));
                      }} />
                      <Select value={p.jenjang || undefined} onValueChange={v => {
                        const arr = [...form.pendidikan]; arr[i] = { ...arr[i], jenjang: v }; setForm(f => ({ ...f, pendidikan: arr }));
                      }}>
                        <SelectTrigger className="col-span-2"><SelectValue placeholder="Jenjang" /></SelectTrigger>
                        <SelectContent>
                          {["SD", "SMP", "SMA/SMK", "D1", "D2", "D3", "S1", "S2", "S3"].map(j => <SelectItem key={j} value={j}>{j}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Input placeholder="Jurusan" value={p.jurusan} onChange={e => {
                        const arr = [...form.pendidikan]; arr[i] = { ...arr[i], jurusan: e.target.value }; setForm(f => ({ ...f, pendidikan: arr }));
                      }} />
                      <Input placeholder="Tahun Masuk" value={p.tahun_masuk} maxLength={4} onChange={e => {
                        const arr = [...form.pendidikan]; arr[i] = { ...arr[i], tahun_masuk: e.target.value }; setForm(f => ({ ...f, pendidikan: arr }));
                      }} />
                      <Input placeholder="Tahun Selesai" value={p.tahun_selesai} maxLength={4} onChange={e => {
                        const arr = [...form.pendidikan]; arr[i] = { ...arr[i], tahun_selesai: e.target.value }; setForm(f => ({ ...f, pendidikan: arr }));
                      }} />
                      <button type="button" className="absolute top-2 right-2 text-destructive text-xs" onClick={() => setForm(f => ({ ...f, pendidikan: f.pendidikan.filter((_, j) => j !== i) }))}>✕</button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={() => setForm(f => ({ ...f, pendidikan: [...f.pendidikan, { nama_sekolah: "", jenjang: "", jurusan: "", tahun_masuk: "", tahun_selesai: "" }] }))}>
                    + Tambah Pendidikan
                  </Button>
                </div>
              )}

              {/* Step 4: Arsip File */}
              {step === 4 && (
                <div className="space-y-3 overflow-y-auto max-h-[55vh] px-6 py-4">
                  {form.arsip_file.map((f, i) => (
                    <div key={i} className="rounded-md border p-3 space-y-2 relative">
                      <Input placeholder="Nama Dokumen (contoh: KTP, Ijazah)" value={f.nama_dokumen} onChange={e => {
                        const arr = [...form.arsip_file]; arr[i] = { ...arr[i], nama_dokumen: e.target.value }; setForm(p => ({ ...p, arsip_file: arr }));
                      }} />
                      <input type="file" accept="image/*,application/pdf" className="text-xs" onChange={e => {
                        const arr = [...form.arsip_file]; arr[i] = { ...arr[i], file: e.target.files?.[0] ?? null }; setForm(p => ({ ...p, arsip_file: arr }));
                      }} />
                      {f.url && <p className="text-xs text-muted-foreground">File tersimpan: <a href={f.url} target="_blank" rel="noreferrer" className="underline">Lihat</a></p>}
                      <button type="button" className="absolute top-2 right-2 text-destructive text-xs" onClick={() => setForm(p => ({ ...p, arsip_file: p.arsip_file.filter((_, j) => j !== i) }))}>✕</button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={() => setForm(p => ({ ...p, arsip_file: [...p.arsip_file, { nama_dokumen: "", file: null, url: "" }] }))}>
                    + Tambah Dokumen
                  </Button>
                </div>
              )}

              {/* Step 5: Data Keuangan */}
              {step === 5 && (
                <div className="space-y-4 overflow-y-auto max-h-[55vh] px-6 py-4">
                  <div className="rounded-md border p-3 space-y-3">
                    <p className="text-sm font-semibold">NPWP</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Nomor NPWP</Label>
                        <Input value={form.npwp_nomor} onChange={e => setForm(p => ({ ...p, npwp_nomor: e.target.value }))} placeholder="XX.XXX.XXX.X-XXX.XXX" />
                      </div>
                      <div>
                        <Label>Nama NPWP</Label>
                        <Input value={form.npwp_nama} onChange={e => setForm(p => ({ ...p, npwp_nama: e.target.value }))} />
                      </div>
                    </div>
                    <div>
                      <Label>Alamat NPWP</Label>
                      <Textarea value={form.npwp_alamat} onChange={e => setForm(p => ({ ...p, npwp_alamat: e.target.value }))} rows={2} />
                    </div>
                  </div>
                  <div className="rounded-md border p-3 space-y-3">
                    <p className="text-sm font-semibold">Bank</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Bank</Label>
                        <Select value={form.bank_nama} onValueChange={v => setForm(p => ({ ...p, bank_nama: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["BCA", "BRI", "BNI", "Mandiri", "BSI", "CIMB", "Danamon", "Permata", "BTN", "Lainnya"].map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Nomor Rekening</Label>
                        <Input value={form.bank_nomor_rekening} onChange={e => setForm(p => ({ ...p, bank_nomor_rekening: e.target.value }))} placeholder="3420249810" />
                      </div>
                      <div className="col-span-2">
                        <Label>Nama Pemilik Rekening</Label>
                        <Input value={form.bank_nama_pemilik} onChange={e => setForm(p => ({ ...p, bank_nama_pemilik: e.target.value }))} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="border-t px-6 py-4 flex justify-between items-center">
                <Button variant="outline" onClick={() => step === 1 ? setOpen(false) : setStep(s => s - 1)}>
                  {step === 1 ? "Batal" : "← Kembali"}
                </Button>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    onClick={() => { handleSubmit(); }}
                    disabled={busy || !form.nik || !form.nama || !!nikError || nikChecking}
                    variant={step < STEPS.length ? "outline" : "default"}
                  >
                    {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Simpan
                  </Button>
                  {step < STEPS.length && (
                    <Button type="button" onClick={() => setStep(s => s + 1)} disabled={!form.nik || !form.nama || !!nikError}>
                      Lanjut →
                    </Button>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-3">
            <Input
              placeholder="Cari nama, NIK, cabang, role, status..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="max-w-sm"
            />
            <Table>
              <TableHeader><TableRow>
                <TableHead className="cursor-pointer select-none whitespace-nowrap" onClick={() => toggleSort("nama_karyawan")}>
                  Nama<SortIcon col="nama_karyawan" />
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("divisi")}>
                  Divisi<SortIcon col="divisi" />
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("jabatan")}>
                  Jabatan<SortIcon col="jabatan" />
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("tanggal_mulai_kerja" as SortKey)}>
                  Tanggal Masuk<SortIcon col={"tanggal_mulai_kerja" as SortKey} />
                </TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filteredAndSorted.map(k => (
                  <TableRow key={k.id_karyawan}>
                    <TableCell>
                      <p className="font-medium">{k.nama_karyawan}</p>
                      <p className="text-xs text-muted-foreground font-mono">{k.nik}</p>
                    </TableCell>
                    <TableCell className="text-sm">{k.divisi ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-sm">{k.jabatan ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-sm">
                      {k.tanggal_mulai_kerja
                        ? new Date(k.tanggal_mulai_kerja).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
                        : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" onClick={() => openEdit(k)}><Pencil className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredAndSorted.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      {search ? `Tidak ada hasil untuk "${search}"` : "Belum ada karyawan."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}