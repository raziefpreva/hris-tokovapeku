import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app/AppShell";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { saveCabangOperational } from "@/lib/admin/users.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, MapPin, Archive, ArchiveRestore } from "lucide-react";

export const Route = createFileRoute("/app/master/cabang")({
  ssr: false,
  component: CabangPage,
});

function CabangPage() {
  const { data } = useCurrentUser();
  const saveCabang = useServerFn(saveCabangOperational);
  type Cabang = {
    id_cabang: string;
    nama_cabang: string;
    alamat: string | null;
    latitude: number | null;
    longitude: number | null;
    aktif: boolean;
  };
  const [list, setList] = useState<Cabang[]>([]);
  const [filterArsip, setFilterArsip] = useState(false);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [nama, setNama] = useState("");
  const [alamat, setAlamat] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [locBusy, setLocBusy] = useState(false);
  const [busy, setBusy] = useState(false);

  async function reload() {
    const { data: l } = await supabase.from("cabang").select("*").order("nama_cabang");
    setList((l ?? []) as unknown as Cabang[]);
  }
  useEffect(() => { reload(); }, []);

  if (!data?.karyawan || data.karyawan.role !== "Manager") {
    return <ForbiddenPage data={data} />;
  }

  async function save() {
    if (!nama.trim()) { toast.error("Nama cabang wajib diisi"); return; }
    setBusy(true);
    try {
      const latNum = lat.trim() === "" ? null : parseFloat(lat);
      const lngNum = lng.trim() === "" ? null : parseFloat(lng);
      if (latNum !== null && (!Number.isFinite(latNum) || latNum < -90 || latNum > 90)) {
        throw new Error("Latitude tidak valid (-90 sampai 90).");
      }
      if (lngNum !== null && (!Number.isFinite(lngNum) || lngNum < -180 || lngNum > 180)) {
        throw new Error("Longitude tidak valid (-180 sampai 180).");
      }
      const payload = {
        id_cabang: editId,
        nama_cabang: nama.trim(),
        alamat: alamat.trim() || null,
        latitude: latNum,
        longitude: lngNum,
      };
      console.log("[Master Cabang] payload simpan", payload);
      const result = await saveCabang({ data: payload });
      console.log("[Master Cabang] hasil simpan", result);
      toast.success("Data berhasil disimpan!");
      setOpen(false); resetForm(); reload();
    } catch (error) {
      console.error("[Master Cabang] gagal simpan", error);
      toast.error("Gagal menyimpan: " + (error instanceof Error ? error.message : "Gagal menyimpan cabang"));
    } finally {
      setBusy(false);
    }
  }

  function resetForm() {
    setEditId(null); setNama(""); setAlamat("");
    setLat(""); setLng("");
  }
  function openCreate() { resetForm(); setOpen(true); }
  function openEdit(c: Cabang) {
    setEditId(c.id_cabang);
    setNama(c.nama_cabang);
    setAlamat(c.alamat ?? "");
    setLat(c.latitude != null ? String(c.latitude) : "");
    setLng(c.longitude != null ? String(c.longitude) : "");
    setOpen(true);
  }

  function ambilLokasi() {
    if (!navigator.geolocation) {
      toast.error("Browser/HP Anda tidak mendukung GPS.");
      return;
    }
    setLocBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(7));
        setLng(pos.coords.longitude.toFixed(7));
        setLocBusy(false);
        toast.success(`Lokasi diambil (±${Math.round(pos.coords.accuracy)}m).`);
      },
      (err) => {
        setLocBusy(false);
        toast.error("Gagal ambil lokasi: " + err.message);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  async function arsip(id: string) {
    if (!confirm("Arsipkan cabang ini? Tugas tidak akan digenerate dan karyawan tidak bisa ditugaskan ke cabang ini.")) return;
    const { error } = await supabase.from("cabang").update({ aktif: false }).eq("id_cabang", id);
    if (error) return toast.error(error.message);
    toast.success("Cabang diarsipkan"); reload();
  }

  async function pulihkan(id: string) {
    const { error } = await supabase.from("cabang").update({ aktif: true }).eq("id_cabang", id);
    if (error) return toast.error(error.message);
    toast.success("Cabang dipulihkan"); reload();
  }

  return (
    <AppShell role={data.karyawan.role} nama={data.karyawan.nama_karyawan} nik={data.karyawan.nik}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Master Cabang</h1>
            <p className="text-sm text-muted-foreground">Kelola seluruh cabang Tokovapeku.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={filterArsip ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterArsip(!filterArsip)}
            >
              <Archive className="mr-1.5 h-3.5 w-3.5" />
              {filterArsip ? "Lihat Aktif" : "Lihat Arsip"}
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Tambah Cabang</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] max-w-lg gap-0 overflow-hidden p-0">
              <DialogHeader className="px-6 pb-3 pt-6"><DialogTitle>{editId ? "Edit Cabang" : "Cabang Baru"}</DialogTitle></DialogHeader>
              <div className="max-h-[calc(90vh-8rem)] space-y-4 overflow-y-auto px-6 pb-4">
                <div className="space-y-1.5">
                  <Label>Nama Cabang</Label>
                  <Input className="h-11" value={nama} onChange={e => setNama(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Alamat</Label>
                  <Input className="h-11" value={alamat} onChange={e => setAlamat(e.target.value)} />
                </div>

                <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">Pinpoint Lokasi Toko (GPS)</p>
                    <Button type="button" size="sm" variant="outline" className="h-8" onClick={ambilLokasi} disabled={locBusy}>
                      {locBusy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <MapPin className="mr-1 h-3.5 w-3.5" />}
                      Ambil Lokasi Saya
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Latitude</Label>
                      <Input className="h-10" inputMode="decimal" placeholder="-6.2000000" value={lat} onChange={e => setLat(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Longitude</Label>
                      <Input className="h-10" inputMode="decimal" placeholder="106.8166667" value={lng} onChange={e => setLng(e.target.value)} />
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Karyawan tetap bisa upload tugas dari mana saja, namun bila berada di luar radius toko sistem mencatat tanda peringatan untuk Manager.
                  </p>
                </div>
              </div>
              <DialogFooter className="sticky bottom-0 border-t bg-background px-6 py-4">
                <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
                <Button type="button" onClick={save} disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Simpan</Button>
              </DialogFooter>
            </DialogContent>
            </Dialog>
          </div>
        </div>
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>Alamat</TableHead>
                  <TableHead>Pinpoint GPS</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.filter(c => c.aktif === !filterArsip).map(c => (
                  <TableRow key={c.id_cabang} className={!c.aktif ? "opacity-60" : ""}>
                    <TableCell className="font-medium">{c.nama_cabang}</TableCell>
                    <TableCell className="text-muted-foreground">{c.alamat ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {c.latitude != null && c.longitude != null
                        ? <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3 text-emerald-600" />{Number(c.latitude).toFixed(5)}, {Number(c.longitude).toFixed(5)}</span>
                        : <span className="text-amber-600">Belum di-pin</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={c.aktif ? "default" : "secondary"}>
                        {c.aktif ? "Aktif" : "Diarsipkan"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {c.aktif ? (
                        <>
                          <Button size="icon" variant="ghost" onClick={() => openEdit(c)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => arsip(c.id_cabang)}>
                            <Archive className="h-4 w-4 text-amber-500" />
                          </Button>
                        </>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => pulihkan(c.id_cabang)}>
                          <ArchiveRestore className="mr-1.5 h-3.5 w-3.5" /> Pulihkan
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {list.filter(c => c.aktif === !filterArsip).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      {filterArsip ? "Tidak ada cabang yang diarsipkan." : "Belum ada cabang aktif."}
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

function ForbiddenPage({ data }: { data: any }) {
  if (!data?.karyawan) return null;
  return (
    <AppShell role={data.karyawan.role} nama={data.karyawan.nama_karyawan} nik={data.karyawan.nik}>
      <Card><CardHeader><CardTitle>Akses ditolak</CardTitle></CardHeader><CardContent>Hanya Manager.</CardContent></Card>
    </AppShell>
  );
}