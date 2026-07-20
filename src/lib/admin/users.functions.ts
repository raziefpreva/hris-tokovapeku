import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { nikToEmail } from "@/lib/nik";

const createSchema = z.object({
  nik: z.string().min(2).max(50),
  nama_karyawan: z.string().min(1).max(120),
  password: z.string().min(6).max(72).default("123456"),
  role: z.enum(["Manager", "Captain", "Vaporista"]),
  cabang_ids: z.array(z.string().uuid()).default([]),
  no_hp: z.string().max(30).optional().nullable(),
  divisi: z.string().max(60).optional().nullable(),
  jabatan: z.string().max(60).optional().nullable(),
  email: z.string().email().optional().nullable(),
  gaji_pokok: z.number().int().optional().nullable(),
  jatah_cuti: z.number().int().optional().nullable(),
  tanggal_mulai_kerja: z.string().optional().nullable(),
  status_kontrak: z.string().optional().nullable(),
  tanggal_berakhir_kontrak: z.string().optional().nullable(),
});

async function assertManager(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "Manager")
    .maybeSingle();
  if (!data) throw new Error("Hanya Manager yang boleh melakukan aksi ini.");
}

export const createKaryawan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cleanNik = data.nik.trim();
    const cleanNama = data.nama_karyawan.trim();
    const email = nikToEmail(cleanNik);

    // 1. Buat akun auth
    const { data: created, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: { nik: cleanNik, nama_karyawan: cleanNama, role: data.role },
    });
    if (authErr || !created?.user) {
      throw new Error(`CREATE_AUTH_FAILED: ${authErr?.message ?? "Gagal membuat akun auth"}`);
    }
    const uid = created.user.id;

    // 2. Upsert baris karyawan secara eksplisit (jangan andalkan trigger)
    const karyawanRow = {
      id_karyawan: uid,
      nik: cleanNik,
      nama_karyawan: cleanNama,
      role: data.role,
      status_akun: "Aktif" as const,
      no_hp: data.no_hp?.trim() || null,
      divisi: data.divisi?.trim() || null,
      jabatan: data.jabatan?.trim() || null,
      email: data.email?.trim() || null,
      gaji_pokok: data.gaji_pokok ?? null,
      jatah_cuti: data.jatah_cuti ?? 12,
      tanggal_mulai_kerja: data.tanggal_mulai_kerja || null,
      status_kontrak: data.status_kontrak || "Tetap",
      tanggal_berakhir_kontrak: data.tanggal_berakhir_kontrak || null,
    };
    const { error: karErr } = await supabaseAdmin
      .from("karyawan")
      .upsert(karyawanRow, { onConflict: "id_karyawan" });
    if (karErr) {
      // rollback auth user agar tidak orphan
      await supabaseAdmin.auth.admin.deleteUser(uid).catch(() => null);
      throw new Error(`INSERT_KARYAWAN_FAILED: ${karErr.message}${karErr.details ? ` | ${karErr.details}` : ""}${karErr.hint ? ` | hint: ${karErr.hint}` : ""}`);
    }

    // 3. Upsert user_roles
    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: uid, role: data.role }, { onConflict: "user_id,role" });
    if (roleErr && roleErr.code !== "23505") {
      throw new Error(`INSERT_ROLE_FAILED: ${roleErr.message}`);
    }

    // 4. Pivot cabang
    if (data.cabang_ids.length > 0) {
      const { error: pivErr } = await supabaseAdmin
        .from("karyawan_cabang_pivot")
        .insert(data.cabang_ids.map((c) => ({ id_karyawan: uid, id_cabang: c })));
      if (pivErr) throw new Error(`INSERT_PIVOT_FAILED: ${pivErr.message}`);
    }

    return { ok: true, id_karyawan: uid };
  });

const updateSchema = z.object({
  id_karyawan: z.string().uuid(),
  nik: z.string().min(2).max(50).optional(),
  original_nik: z.string().min(2).max(50).optional(),
  nama_karyawan: z.string().min(1).max(120).optional(),
  role: z.enum(["Manager", "Captain", "Vaporista"]).optional(),
  status_akun: z.enum(["Aktif", "Nonaktif"]).optional(),
  cabang_ids: z.array(z.string().uuid()).optional(),
  new_password: z.string().min(6).max(72).optional(),
  no_hp: z.string().max(30).optional().nullable(),
  divisi: z.string().max(60).optional().nullable(),
  jabatan: z.string().max(60).optional().nullable(),
  email: z.string().email().optional().nullable(),
  gaji_pokok: z.number().int().optional().nullable(),
  jatah_cuti: z.number().int().optional().nullable(),
  tanggal_mulai_kerja: z.string().optional().nullable(),
  status_kontrak: z.string().optional().nullable(),
  tanggal_berakhir_kontrak: z.string().optional().nullable(),
});

export const updateKaryawan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => updateSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const nextNik = data.nik?.trim();
    const lookupNik = (data.original_nik?.trim() || nextNik || "");
    if (!lookupNik) throw new Error("UPDATE_KARYAWAN_FAILED: NIK lama tidak ditemukan sebagai filter update.");
    const patch = {
      ...(nextNik ? { nik: nextNik } : {}),
      ...(data.nama_karyawan !== undefined ? { nama_karyawan: data.nama_karyawan.trim() } : {}),
      ...(data.role !== undefined ? { role: data.role } : {}),
      ...(data.status_akun !== undefined ? { status_akun: data.status_akun } : {}),
      ...(data.no_hp !== undefined ? { no_hp: data.no_hp?.trim() || null } : {}),
      ...(data.divisi !== undefined ? { divisi: data.divisi?.trim() || null } : {}),
      ...(data.jabatan !== undefined ? { jabatan: data.jabatan?.trim() || null } : {}),
      ...(data.email !== undefined ? { email: data.email?.trim() || null } : {}),
      ...(data.gaji_pokok !== undefined ? { gaji_pokok: data.gaji_pokok ?? null } : {}),
      ...(data.jatah_cuti !== undefined ? { jatah_cuti: data.jatah_cuti ?? null } : {}),
      ...(data.tanggal_mulai_kerja !== undefined ? { tanggal_mulai_kerja: data.tanggal_mulai_kerja || null } : {}),
      ...(data.status_kontrak !== undefined ? { status_kontrak: data.status_kontrak || null } : {}),
      ...(data.tanggal_berakhir_kontrak !== undefined ? { tanggal_berakhir_kontrak: data.tanggal_berakhir_kontrak || null } : {}),
    };
    const { data: updatedRow, error: updErr } = await supabaseAdmin
      .from("karyawan")
      .update(patch)
      .eq("nik", lookupNik)
      .eq("id_karyawan", data.id_karyawan)
      .select("id_karyawan,nik")
      .single();
    if (updErr) throw new Error(`UPDATE_KARYAWAN_FAILED: ${updErr.message}`);
    if (!updatedRow) throw new Error("UPDATE_KARYAWAN_FAILED: Data karyawan tidak ditemukan.");
    if (data.role) {
      const { error: roleDeleteErr } = await supabaseAdmin.from("user_roles").delete().eq("user_id", data.id_karyawan);
      if (roleDeleteErr) throw new Error(`UPDATE_ROLE_DELETE_FAILED: ${roleDeleteErr.message}`);
      const { error: roleInsertErr } = await supabaseAdmin.from("user_roles").insert({ user_id: data.id_karyawan, role: data.role });
      if (roleInsertErr) throw new Error(`UPDATE_ROLE_INSERT_FAILED: ${roleInsertErr.message}`);
    }
    if (data.cabang_ids) {
      const { error: pivotDeleteErr } = await supabaseAdmin
        .from("karyawan_cabang_pivot")
        .delete()
        .eq("id_karyawan", data.id_karyawan);
      if (pivotDeleteErr) throw new Error(`UPDATE_CABANG_DELETE_FAILED: ${pivotDeleteErr.message}`);
      if (data.cabang_ids.length) {
        const { error: pivotInsertErr } = await supabaseAdmin
          .from("karyawan_cabang_pivot")
          .insert(data.cabang_ids.map((c) => ({ id_karyawan: data.id_karyawan, id_cabang: c })));
        if (pivotInsertErr) throw new Error(`UPDATE_CABANG_INSERT_FAILED: ${pivotInsertErr.message}`);
      }
    }
    const authPatch: { email?: string; password?: string; user_metadata?: Record<string, string> } = {};
    if (nextNik && nextNik !== lookupNik) authPatch.email = nikToEmail(nextNik);
    if (data.new_password) authPatch.password = data.new_password;
    if (nextNik || data.nama_karyawan || data.role) {
      authPatch.user_metadata = {
        ...(nextNik ? { nik: nextNik } : {}),
        ...(data.nama_karyawan ? { nama_karyawan: data.nama_karyawan } : {}),
        ...(data.role ? { role: data.role } : {}),
      };
    }
    if (Object.keys(authPatch).length) {
      const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(data.id_karyawan, authPatch);
      if (authErr) throw new Error(`UPDATE_AUTH_USER_FAILED: ${authErr.message}`);
    }
    return { ok: true };
  });

const bootstrapSchema = z.object({
  nik: z.string().min(2),
  nama_karyawan: z.string().min(1),
  password: z.string().min(6),
});

// Bootstrap Manager pertama bila belum ada satu pun karyawan di database
export const bootstrapManager = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => bootstrapSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("karyawan")
      .select("*", { count: "exact", head: true });
    if ((count ?? 0) > 0) {
      throw new Error("Bootstrap sudah ditutup. Akun pertama sudah ada — silakan minta Manager.");
    }
    const email = `${data.nik.trim().toLowerCase()}@vapehris.internal`;
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: { nik: data.nik, nama_karyawan: data.nama_karyawan, role: "Manager" },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Gagal bootstrap");
    return { ok: true };
  });

export const getBootstrapStatus = createServerFn({ method: "GET" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("karyawan")
      .select("*", { count: "exact", head: true });
    return { open: (count ?? 0) === 0, count: count ?? 0 };
  });

// Reset bootstrap: hapus seluruh karyawan + akun auth + role + pivot
// agar setup Manager pertama bisa diulang. Dilindungi confirm-token sederhana.
const resetSchema = z.object({ confirm: z.literal("RESET") });

export const resetBootstrap = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => resetSchema.parse(d))
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Hapus tabel turunan dulu
    await supabaseAdmin.from("karyawan_cabang_pivot").delete().not("id_karyawan", "is", null);
    await supabaseAdmin.from("user_roles").delete().not("user_id", "is", null);
    // Ambil semua karyawan agar bisa hapus akun auth-nya
    const { data: rows } = await supabaseAdmin.from("karyawan").select("id_karyawan");
    await supabaseAdmin.from("karyawan").delete().not("id_karyawan", "is", null);
    for (const r of rows ?? []) {
      await supabaseAdmin.auth.admin.deleteUser((r as { id_karyawan: string }).id_karyawan).catch(() => null);
    }
    return { ok: true, deleted: rows?.length ?? 0 };
  });

// Fallback: pastikan user yang sedang login punya baris karyawan + role.
// Dipanggil saat hook user mendeteksi profil hilang (mis. trigger gagal).
export const ensureMyKaryawan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const uid = context.userId;
    const { data: existing } = await supabaseAdmin
      .from("karyawan")
      .select("id_karyawan")
      .eq("id_karyawan", uid)
      .maybeSingle();
    if (existing) return { ok: true, created: false };

    // Ambil metadata dari auth user
    const { data: u, error: getUserErr } = await supabaseAdmin.auth.admin.getUserById(uid);
    if (getUserErr || !u?.user) {
      throw new Error(
        `STALE_SESSION: Akun auth (${uid}) tidak ditemukan di server. ` +
        `Sesi login Anda sudah kedaluwarsa karena akun dihapus. Silakan logout & login ulang.`
      );
    }
    const meta = (u.user.user_metadata ?? {}) as Record<string, string>;
    const email = u.user.email ?? "";
    const baseNik = meta.nik || email.split("@")[0] || uid.slice(0, 8);
    const nama = meta.nama_karyawan || baseNik;
    // Jika tabel karyawan kosong → otomatis Manager pertama
    const { count } = await supabaseAdmin
      .from("karyawan")
      .select("*", { count: "exact", head: true });
    const role = (meta.role as "Manager" | "Captain" | "Vaporista") ||
      ((count ?? 0) === 0 ? "Manager" : "Vaporista");

    // Coba insert; jika NIK bentrok, retry dengan suffix unik
    let nik = baseNik;
    let insertErr: { message: string; code?: string; details?: string; hint?: string } | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const { error } = await supabaseAdmin
        .from("karyawan")
        .insert({ id_karyawan: uid, nik, nama_karyawan: nama, role, status_akun: "Aktif" });
      if (!error) { insertErr = null; break; }
      insertErr = error;
      // 23505 = unique_violation → coba NIK lain
      if (error.code === "23505") {
        nik = `${baseNik}-${uid.slice(0, 4)}${attempt}`;
        continue;
      }
      break;
    }
    if (insertErr) {
      throw new Error(
        `INSERT_KARYAWAN_FAILED: ${insertErr.message}` +
        (insertErr.details ? ` | details: ${insertErr.details}` : "") +
        (insertErr.hint ? ` | hint: ${insertErr.hint}` : "") +
        (insertErr.code ? ` | code: ${insertErr.code}` : "")
      );
    }
    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: uid, role });
    if (roleErr && roleErr.code !== "23505") {
      throw new Error(`INSERT_ROLE_FAILED: ${roleErr.message}`);
    }
    return { ok: true, created: true, role, nik };
  });

const jadwalRow = z.object({
  tanggal: z.string(),
  id_karyawan: z.string().uuid(),
  id_cabang: z.string().uuid().nullable().optional(),
  status_hari: z.enum(["Masuk Kerja", "LIBUR", "CUTI"]),
  shift: z.enum(["Shift 1", "Shift 2", "Full Time"]).nullable().optional(),
  shifts: z.array(z.enum(["Shift 1", "Shift 2", "Full Time"])).optional(),
  id_cabang_list: z.array(z.string().uuid()).optional(),
});

// Helper: auto-generate transaksi_ceklist_harian untuk jadwal yang baru
// disimpan, agar tugas langsung muncul di halaman "Tugas Saya" karyawan
// tanpa perlu klik Sinkron. Aman dipanggil berulang (dedup per cabang|sop).
async function generateTugasForJadwal(
  supabaseAdmin: any,
  params: {
    id_karyawan: string;
    tanggal: string; // YYYY-MM-DD
    assignments: { shift: string; id_cabang: string }[];
  },
) {
  if (!params.assignments || params.assignments.length === 0) return;
  // skip past dates (Asia/Jakarta)
  const todayJkt = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
  if (params.tanggal < todayJkt) return;

  const { data: kar } = await supabaseAdmin
    .from("karyawan")
    .select("role")
    .eq("id_karyawan", params.id_karyawan)
    .maybeSingle();
  const role = String(kar?.role ?? "").toLowerCase();
  if (role !== "captain" && role !== "vaporista") return;

  const { data: pivotHome } = await supabaseAdmin
    .from("karyawan_cabang_pivot")
    .select("id_cabang")
    .eq("id_karyawan", params.id_karyawan);
  const homeCabang = new Set((pivotHome ?? []).map((p: any) => p.id_cabang));
  const isBackupFor = (idc: string) => homeCabang.size > 0 && !homeCabang.has(idc);
  const allowedRolesFor = (idc: string): string[] =>
    role === "captain"
      ? isBackupFor(idc) ? ["vaporista"] : ["captain", "vaporista"]
      : ["vaporista"];

  const dow = new Date(params.tanggal + "T00:00:00+07:00").getUTCDay();
  const roleMatches = (target: string, allowed: string[]) => {
    const tr = String(target ?? "").toLowerCase();
    return allowed.some((a) => tr.includes(a) || a.includes(tr));
  };
  const shiftMatches = (
    arr: string[] | null | undefined,
    legacy: string | null | undefined,
    cur: string,
  ) => {
    const list = (Array.isArray(arr) && arr.length > 0 ? arr : legacy ? [legacy] : [])
      .map((s) => String(s).toLowerCase());
    const c = String(cur).toLowerCase();
    if (list.length === 0) return true;
    if (c === "full time") return true;
    return list.some((s) => s === c || s.includes(c) || c.includes(s));
  };
  const hariMatches = (hari: number[] | null | undefined) =>
    !Array.isArray(hari) || hari.length === 0 || hari.includes(dow);

  const byCabang = new Map<string, Set<string>>();
  for (const a of params.assignments) {
    if (!a?.id_cabang || !a?.shift) continue;
    if (!byCabang.has(a.id_cabang)) byCabang.set(a.id_cabang, new Set());
    byCabang.get(a.id_cabang)!.add(a.shift);
  }

  const { data: existing } = await supabaseAdmin
    .from("transaksi_ceklist_harian")
    .select("id_sop,id_cabang")
    .eq("id_karyawan", params.id_karyawan)
    .eq("tanggal", params.tanggal);
  const existingKeys = new Set(
    (existing ?? []).map((e: any) => `${e.id_cabang}|${e.id_sop}`),
  );

  const toInsert: any[] = [];
  for (const [idc, shiftSet] of byCabang) {
    const allowed = allowedRolesFor(idc);
    const backup = isBackupFor(idc);
    const shifts = Array.from(shiftSet);

    const sopIds = new Set<string>();
    const { data: pivot } = await supabaseAdmin
      .from("sop_cabang_pivot")
      .select(
        "id_sop, master_ceklist_sop!inner(id_sop, target_role, aktif, tipe_shift, tipe_shifts, hari_berlaku, target_karyawan_id)",
      )
      .eq("id_cabang", idc);
    for (const p of (pivot ?? []) as any[]) {
      const sop = p.master_ceklist_sop;
      if (!sop?.aktif) continue;
      if (!roleMatches(sop.target_role, allowed)) continue;
      if (!hariMatches(sop.hari_berlaku)) continue;
      if (sop.target_karyawan_id && sop.target_karyawan_id !== params.id_karyawan) continue;
      if (shifts.some((sh) => shiftMatches(sop.tipe_shifts, sop.tipe_shift, sh))) {
        sopIds.add(p.id_sop);
      }
    }
    // Fallback: pivot kosong → ambil semua SOP aktif
    if (sopIds.size === 0) {
      const { data: allSops } = await supabaseAdmin
        .from("master_ceklist_sop")
        .select(
          "id_sop, target_role, aktif, tipe_shift, tipe_shifts, hari_berlaku, target_karyawan_id",
        )
        .eq("aktif", true);
      for (const s of (allSops ?? []) as any[]) {
        if (!roleMatches(s.target_role, allowed)) continue;
        if (!hariMatches(s.hari_berlaku)) continue;
        if (s.target_karyawan_id && s.target_karyawan_id !== params.id_karyawan) continue;
        if (shifts.some((sh) => shiftMatches(s.tipe_shifts, s.tipe_shift, sh))) {
          sopIds.add(s.id_sop);
        }
      }
    }

    for (const id_sop of sopIds) {
      const key = `${idc}|${id_sop}`;
      if (existingKeys.has(key)) continue;
      toInsert.push({
        tanggal: params.tanggal,
        id_karyawan: params.id_karyawan,
        id_cabang: idc,
        id_sop,
        is_backup_mode: backup,
      });
      existingKeys.add(key);
    }
  }
  if (toInsert.length) {
    const { error } = await supabaseAdmin
      .from("transaksi_ceklist_harian")
      .insert(toInsert);
    if (error) console.error("generateTugasForJadwal insert failed", error);
  }
}

export const bulkUpsertJadwal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ rows: z.array(jadwalRow) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("jadwal_kerja")
      .upsert(data.rows as never, { onConflict: "tanggal,id_karyawan" });
    if (error) throw new Error(error.message);
    // Auto-generate tugas untuk setiap baris yang Masuk Kerja.
    for (const r of data.rows) {
      if (r.status_hari !== "Masuk Kerja") continue;
      const shifts = (r.shifts && r.shifts.length > 0 ? r.shifts : r.shift ? [r.shift] : []) as string[];
      const cabangs = (r.id_cabang_list && r.id_cabang_list.length > 0 ? r.id_cabang_list : r.id_cabang ? [r.id_cabang] : []) as string[];
      const assignments = cabangs.flatMap((c) => shifts.map((s) => ({ shift: s, id_cabang: c })));
      try {
        await generateTugasForJadwal(supabaseAdmin, {
          id_karyawan: r.id_karyawan,
          tanggal: r.tanggal,
          assignments,
        });
      } catch (e) {
        console.error("bulkUpsertJadwal generate failed", e);
      }
    }
    return { ok: true, count: data.rows.length };
  });

const cellSchema = z.object({
  tanggal: z.string(),
  id_karyawan: z.string().uuid(),
  id_cabang: z.string().uuid().nullable().optional(),
  status_hari: z.enum(["Masuk Kerja", "LIBUR", "CUTI"]),
  shift: z.enum(["Shift 1", "Shift 2"]).nullable().optional(),
  shifts: z.array(z.enum(["Shift 1", "Shift 2"])).optional(),
  id_cabang_list: z.array(z.string().uuid()).optional(),
  assignments: z
    .array(
      z.object({
        shift: z.enum(["Shift 1", "Shift 2"]),
        id_cabang: z.string().uuid(),
      }),
    )
    .optional(),
});

export const upsertJadwalCell = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => cellSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Pasangan {shift, id_cabang} adalah sumber kebenaran (BKO silang).
    const assignments = (data.assignments ?? []).filter(
      (a) => a.shift && a.id_cabang,
    );
    const shifts = assignments.length > 0
      ? Array.from(new Set(assignments.map((a) => a.shift)))
      : (data.shifts && data.shifts.length > 0
          ? data.shifts
          : (data.shift ? [data.shift] : []));
    const cabangList = assignments.length > 0
      ? Array.from(new Set(assignments.map((a) => a.id_cabang)))
      : (data.id_cabang_list && data.id_cabang_list.length > 0
          ? data.id_cabang_list
          : (data.id_cabang ? [data.id_cabang] : []));
    const row = {
      tanggal: data.tanggal,
      id_karyawan: data.id_karyawan,
      status_hari: data.status_hari,
      // keep legacy single columns synced with first selection for back-compat
      shift: data.status_hari === "Masuk Kerja" ? (shifts[0] ?? null) : null,
      id_cabang: data.status_hari === "Masuk Kerja" ? (cabangList[0] ?? null) : null,
      shifts: data.status_hari === "Masuk Kerja" ? shifts : [],
      id_cabang_list: data.status_hari === "Masuk Kerja" ? cabangList : [],
      assignments: data.status_hari === "Masuk Kerja" ? assignments : [],
    };
    const { error } = await supabaseAdmin
      .from("jadwal_kerja")
      .upsert(row as never, { onConflict: "tanggal,id_karyawan" });
    if (error) throw new Error(error.message);
    if (data.status_hari === "Masuk Kerja" && assignments.length > 0) {
      try {
        await generateTugasForJadwal(supabaseAdmin, {
          id_karyawan: data.id_karyawan,
          tanggal: data.tanggal,
          assignments,
        });
      } catch (e) {
        console.error("upsertJadwalCell generate failed", e);
      }
    }
    return { ok: true };
  });

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Format jam harus HH:mm");
const operationalSlotSchema = z.object({
  days: z.array(z.number().int().min(0).max(6)).min(1),
  buka: timeSchema,
  tutup: timeSchema,
});

const saveCabangSchema = z.object({
  id_cabang: z.string().uuid().nullable().optional(),
  nama_cabang: z.string().min(1).max(120),
  alamat: z.string().max(500).nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
});

export const saveCabangOperational = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => saveCabangSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = {
      nama_cabang: data.nama_cabang.trim(),
      alamat: data.alamat?.trim() || null,
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
    };
    const result = data.id_cabang
      ? await supabaseAdmin.from("cabang").update(payload).eq("id_cabang", data.id_cabang).select("id_cabang").single()
      : await supabaseAdmin.from("cabang").insert(payload).select("id_cabang").single();
    if (result.error) throw new Error(result.error.message);
    return { ok: true, id_cabang: result.data.id_cabang };
  });

const shiftRuleSchema = z.object({
  days: z.array(z.number().int().min(0).max(6)).min(1),
  mulai: timeSchema,
  selesai: timeSchema,
});

const shiftPayloadSchema = z.object({
  "Shift 1": z.array(shiftRuleSchema).min(1),
  "Shift 2": z.array(shiftRuleSchema).min(1),
});

const saveMasterShiftSchema = z.object({
  id_cabang: z.string().uuid().nullable(),
  shifts_json: z.string().min(2),
});

export const saveMasterShiftCabang = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => saveMasterShiftSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, context.userId);
    let shifts: z.infer<typeof shiftPayloadSchema>;
    try {
      shifts = shiftPayloadSchema.parse(JSON.parse(data.shifts_json));
    } catch (error) {
      throw new Error(error instanceof Error ? `Format master shift tidak valid: ${error.message}` : "Format master shift tidak valid");
    }

    for (const [name, rules] of Object.entries(shifts)) {
      const usedDays = new Set<number>();
      for (const rule of rules) {
        for (const day of rule.days) {
          if (usedDays.has(day)) throw new Error(`${name}: ada hari yang dipakai di lebih dari satu aturan.`);
          usedDays.add(day);
        }
      }
    }

    const rows = Object.entries(shifts).flatMap(([nama_shift, rules]) =>
      rules.map((rule) => ({
        id_cabang: data.id_cabang,
        nama_shift,
        jam_mulai: `${rule.mulai}:00`,
        jam_selesai: `${rule.selesai}:00`,
        hari: rule.days,
      })),
    );

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const scopedDelete = supabaseAdmin
      .from("master_shift_cabang")
      .delete()
      .in("nama_shift", ["Shift 1", "Shift 2"]);
    const deleteResult = data.id_cabang
      ? await scopedDelete.eq("id_cabang", data.id_cabang)
      : await scopedDelete.is("id_cabang", null);
    if (deleteResult.error) throw new Error(deleteResult.error.message);

    const insertResult = await supabaseAdmin.from("master_shift_cabang").insert(rows).select("id_shift");
    if (insertResult.error) throw new Error(insertResult.error.message);
    return { ok: true, count: insertResult.data?.length ?? 0 };
  });

const delCellSchema = z.object({
  tanggal: z.string(),
  id_karyawan: z.string().uuid(),
});

export const deleteJadwalCell = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => delCellSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("jadwal_kerja")
      .delete()
      .eq("tanggal", data.tanggal)
      .eq("id_karyawan", data.id_karyawan);
    if (error) throw new Error(error.message);
    return { ok: true };
  });