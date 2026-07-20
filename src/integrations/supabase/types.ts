export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      cabang: {
        Row: {
          alamat: string | null
          created_at: string
          id_cabang: string
          jam_buka_weekday: string | null
          jam_buka_weekend: string | null
          jam_operasional: Json | null
          jam_tutup_weekday: string | null
          jam_tutup_weekend: string | null
          latitude: number | null
          longitude: number | null
          nama_cabang: string
          updated_at: string
        }
        Insert: {
          alamat?: string | null
          created_at?: string
          id_cabang?: string
          jam_buka_weekday?: string | null
          jam_buka_weekend?: string | null
          jam_operasional?: Json | null
          jam_tutup_weekday?: string | null
          jam_tutup_weekend?: string | null
          latitude?: number | null
          longitude?: number | null
          nama_cabang: string
          updated_at?: string
        }
        Update: {
          alamat?: string | null
          created_at?: string
          id_cabang?: string
          jam_buka_weekday?: string | null
          jam_buka_weekend?: string | null
          jam_operasional?: Json | null
          jam_tutup_weekday?: string | null
          jam_tutup_weekend?: string | null
          latitude?: number | null
          longitude?: number | null
          nama_cabang?: string
          updated_at?: string
        }
        Relationships: []
      }
      jadwal_kerja: {
        Row: {
          assignments: Json
          created_at: string
          id_cabang: string | null
          id_cabang_list: string[]
          id_jadwal: string
          id_karyawan: string
          shift: Database["public"]["Enums"]["shift_enum"] | null
          shifts: string[]
          status_hari: Database["public"]["Enums"]["status_hari_enum"]
          tanggal: string
        }
        Insert: {
          assignments?: Json
          created_at?: string
          id_cabang?: string | null
          id_cabang_list?: string[]
          id_jadwal?: string
          id_karyawan: string
          shift?: Database["public"]["Enums"]["shift_enum"] | null
          shifts?: string[]
          status_hari: Database["public"]["Enums"]["status_hari_enum"]
          tanggal: string
        }
        Update: {
          assignments?: Json
          created_at?: string
          id_cabang?: string | null
          id_cabang_list?: string[]
          id_jadwal?: string
          id_karyawan?: string
          shift?: Database["public"]["Enums"]["shift_enum"] | null
          shifts?: string[]
          status_hari?: Database["public"]["Enums"]["status_hari_enum"]
          tanggal?: string
        }
        Relationships: [
          {
            foreignKeyName: "jadwal_kerja_id_cabang_fkey"
            columns: ["id_cabang"]
            isOneToOne: false
            referencedRelation: "cabang"
            referencedColumns: ["id_cabang"]
          },
          {
            foreignKeyName: "jadwal_kerja_id_karyawan_fkey"
            columns: ["id_karyawan"]
            isOneToOne: false
            referencedRelation: "karyawan"
            referencedColumns: ["id_karyawan"]
          },
        ]
      }
      karyawan: {
        Row: {
          created_at: string
          divisi: string | null
          id_karyawan: string
          jabatan: string | null
          nama_karyawan: string
          nik: string
          no_hp: string | null
          role: Database["public"]["Enums"]["app_role"]
          status_akun: Database["public"]["Enums"]["status_akun_enum"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          divisi?: string | null
          id_karyawan: string
          jabatan?: string | null
          nama_karyawan: string
          nik: string
          no_hp?: string | null
          role: Database["public"]["Enums"]["app_role"]
          status_akun?: Database["public"]["Enums"]["status_akun_enum"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          divisi?: string | null
          id_karyawan?: string
          jabatan?: string | null
          nama_karyawan?: string
          nik?: string
          no_hp?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status_akun?: Database["public"]["Enums"]["status_akun_enum"]
          updated_at?: string
        }
        Relationships: []
      }
      karyawan_cabang_pivot: {
        Row: {
          created_at: string
          id: string
          id_cabang: string
          id_karyawan: string
        }
        Insert: {
          created_at?: string
          id?: string
          id_cabang: string
          id_karyawan: string
        }
        Update: {
          created_at?: string
          id?: string
          id_cabang?: string
          id_karyawan?: string
        }
        Relationships: [
          {
            foreignKeyName: "karyawan_cabang_pivot_id_cabang_fkey"
            columns: ["id_cabang"]
            isOneToOne: false
            referencedRelation: "cabang"
            referencedColumns: ["id_cabang"]
          },
          {
            foreignKeyName: "karyawan_cabang_pivot_id_karyawan_fkey"
            columns: ["id_karyawan"]
            isOneToOne: false
            referencedRelation: "karyawan"
            referencedColumns: ["id_karyawan"]
          },
        ]
      }
      master_ceklist_sop: {
        Row: {
          aktif: boolean
          batas_jam_upload: string
          bobot_poin: number
          created_at: string
          deadline_tanggal: string | null
          deskripsi: string | null
          hari_berlaku: number[] | null
          id_sop: string
          kategori: Database["public"]["Enums"]["sop_kategori"]
          nama_sop: string
          target_karyawan_id: string | null
          target_role: Database["public"]["Enums"]["app_role"]
          tipe_shift: Database["public"]["Enums"]["shift_enum"] | null
          tipe_shifts: string[]
        }
        Insert: {
          aktif?: boolean
          batas_jam_upload: string
          bobot_poin?: number
          created_at?: string
          deadline_tanggal?: string | null
          deskripsi?: string | null
          hari_berlaku?: number[] | null
          id_sop?: string
          kategori?: Database["public"]["Enums"]["sop_kategori"]
          nama_sop: string
          target_karyawan_id?: string | null
          target_role: Database["public"]["Enums"]["app_role"]
          tipe_shift?: Database["public"]["Enums"]["shift_enum"] | null
          tipe_shifts?: string[]
        }
        Update: {
          aktif?: boolean
          batas_jam_upload?: string
          bobot_poin?: number
          created_at?: string
          deadline_tanggal?: string | null
          deskripsi?: string | null
          hari_berlaku?: number[] | null
          id_sop?: string
          kategori?: Database["public"]["Enums"]["sop_kategori"]
          nama_sop?: string
          target_karyawan_id?: string | null
          target_role?: Database["public"]["Enums"]["app_role"]
          tipe_shift?: Database["public"]["Enums"]["shift_enum"] | null
          tipe_shifts?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "master_ceklist_sop_target_karyawan_id_fkey"
            columns: ["target_karyawan_id"]
            isOneToOne: false
            referencedRelation: "karyawan"
            referencedColumns: ["id_karyawan"]
          },
        ]
      }
      master_shift_cabang: {
        Row: {
          created_at: string
          hari: number[]
          id_cabang: string | null
          id_shift: string
          jam_mulai: string
          jam_selesai: string
          nama_shift: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          hari?: number[]
          id_cabang?: string | null
          id_shift?: string
          jam_mulai: string
          jam_selesai: string
          nama_shift: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          hari?: number[]
          id_cabang?: string | null
          id_shift?: string
          jam_mulai?: string
          jam_selesai?: string
          nama_shift?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "master_shift_cabang_id_cabang_fkey"
            columns: ["id_cabang"]
            isOneToOne: false
            referencedRelation: "cabang"
            referencedColumns: ["id_cabang"]
          },
        ]
      }
      sop_cabang_pivot: {
        Row: {
          bobot_poin: number
          created_at: string
          id: string
          id_cabang: string
          id_sop: string
        }
        Insert: {
          bobot_poin?: number
          created_at?: string
          id?: string
          id_cabang: string
          id_sop: string
        }
        Update: {
          bobot_poin?: number
          created_at?: string
          id?: string
          id_cabang?: string
          id_sop?: string
        }
        Relationships: [
          {
            foreignKeyName: "sop_cabang_pivot_id_cabang_fkey"
            columns: ["id_cabang"]
            isOneToOne: false
            referencedRelation: "cabang"
            referencedColumns: ["id_cabang"]
          },
          {
            foreignKeyName: "sop_cabang_pivot_id_sop_fkey"
            columns: ["id_sop"]
            isOneToOne: false
            referencedRelation: "master_ceklist_sop"
            referencedColumns: ["id_sop"]
          },
        ]
      }
      transaksi_ceklist_harian: {
        Row: {
          alasan_telat: string | null
          catatan_atasan: string | null
          created_at: string
          diverifikasi_oleh: string | null
          file_bukti: string[]
          flow_type: Database["public"]["Enums"]["flow_type_enum"] | null
          id_cabang: string
          id_karyawan: string
          id_sop: string
          id_tugas: string
          is_backup_mode: boolean
          is_in_location: boolean | null
          jam_upload: string | null
          poin_didapat: number
          status_tugas: Database["public"]["Enums"]["status_tugas_enum"]
          status_upload:
            | Database["public"]["Enums"]["status_upload_enum"]
            | null
          tanggal: string
          updated_at: string
          upload_distance_m: number | null
          upload_latitude: number | null
          upload_longitude: number | null
        }
        Insert: {
          alasan_telat?: string | null
          catatan_atasan?: string | null
          created_at?: string
          diverifikasi_oleh?: string | null
          file_bukti?: string[]
          flow_type?: Database["public"]["Enums"]["flow_type_enum"] | null
          id_cabang: string
          id_karyawan: string
          id_sop: string
          id_tugas?: string
          is_backup_mode?: boolean
          is_in_location?: boolean | null
          jam_upload?: string | null
          poin_didapat?: number
          status_tugas?: Database["public"]["Enums"]["status_tugas_enum"]
          status_upload?:
            | Database["public"]["Enums"]["status_upload_enum"]
            | null
          tanggal?: string
          updated_at?: string
          upload_distance_m?: number | null
          upload_latitude?: number | null
          upload_longitude?: number | null
        }
        Update: {
          alasan_telat?: string | null
          catatan_atasan?: string | null
          created_at?: string
          diverifikasi_oleh?: string | null
          file_bukti?: string[]
          flow_type?: Database["public"]["Enums"]["flow_type_enum"] | null
          id_cabang?: string
          id_karyawan?: string
          id_sop?: string
          id_tugas?: string
          is_backup_mode?: boolean
          is_in_location?: boolean | null
          jam_upload?: string | null
          poin_didapat?: number
          status_tugas?: Database["public"]["Enums"]["status_tugas_enum"]
          status_upload?:
            | Database["public"]["Enums"]["status_upload_enum"]
            | null
          tanggal?: string
          updated_at?: string
          upload_distance_m?: number | null
          upload_latitude?: number | null
          upload_longitude?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "transaksi_ceklist_harian_diverifikasi_oleh_fkey"
            columns: ["diverifikasi_oleh"]
            isOneToOne: false
            referencedRelation: "karyawan"
            referencedColumns: ["id_karyawan"]
          },
          {
            foreignKeyName: "transaksi_ceklist_harian_id_cabang_fkey"
            columns: ["id_cabang"]
            isOneToOne: false
            referencedRelation: "cabang"
            referencedColumns: ["id_cabang"]
          },
          {
            foreignKeyName: "transaksi_ceklist_harian_id_karyawan_fkey"
            columns: ["id_karyawan"]
            isOneToOne: false
            referencedRelation: "karyawan"
            referencedColumns: ["id_karyawan"]
          },
          {
            foreignKeyName: "transaksi_ceklist_harian_id_sop_fkey"
            columns: ["id_sop"]
            isOneToOne: false
            referencedRelation: "master_ceklist_sop"
            referencedColumns: ["id_sop"]
          },
        ]
      }
      tugas_audit_log: {
        Row: {
          catatan_penolakan: string | null
          file_bukti_salah: string[]
          id: string
          id_tugas: string
          rejected_at: string
          rejected_by: string | null
        }
        Insert: {
          catatan_penolakan?: string | null
          file_bukti_salah?: string[]
          id?: string
          id_tugas: string
          rejected_at?: string
          rejected_by?: string | null
        }
        Update: {
          catatan_penolakan?: string | null
          file_bukti_salah?: string[]
          id?: string
          id_tugas?: string
          rejected_at?: string
          rejected_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tugas_audit_log_id_tugas_fkey"
            columns: ["id_tugas"]
            isOneToOne: false
            referencedRelation: "transaksi_ceklist_harian"
            referencedColumns: ["id_tugas"]
          },
          {
            foreignKeyName: "tugas_audit_log_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "karyawan"
            referencedColumns: ["id_karyawan"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_my_cabang_ids: { Args: never; Returns: string[] }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_cabang_access: {
        Args: { _id_cabang: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_account_active: { Args: { _user_id: string }; Returns: boolean }
      mark_alfa_tasks: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "Manager" | "Captain" | "Vaporista"
      flow_type_enum:
        | "vaporista_to_captain"
        | "captain_to_manager"
        | "backup_to_captain_pic"
        | "manager_direct"
      shift_enum: "Shift 1" | "Shift 2" | "Full Time"
      sop_kategori: "OPENING" | "BERJALAN_TOKO" | "CLOSING"
      status_akun_enum: "Aktif" | "Nonaktif"
      status_hari_enum: "Masuk Kerja" | "LIBUR" | "CUTI"
      status_tugas_enum:
        | "Menunggu Verifikasi"
        | "Disetujui (Murni)"
        | "Disetujui dengan Penalti"
        | "Ditolak"
        | "Belum Dikerjakan"
      status_upload_enum: "Tepat Waktu" | "TELAT" | "ALFA"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["Manager", "Captain", "Vaporista"],
      flow_type_enum: [
        "vaporista_to_captain",
        "captain_to_manager",
        "backup_to_captain_pic",
        "manager_direct",
      ],
      shift_enum: ["Shift 1", "Shift 2", "Full Time"],
      sop_kategori: ["OPENING", "BERJALAN_TOKO", "CLOSING"],
      status_akun_enum: ["Aktif", "Nonaktif"],
      status_hari_enum: ["Masuk Kerja", "LIBUR", "CUTI"],
      status_tugas_enum: [
        "Menunggu Verifikasi",
        "Disetujui (Murni)",
        "Disetujui dengan Penalti",
        "Ditolak",
        "Belum Dikerjakan",
      ],
      status_upload_enum: ["Tepat Waktu", "TELAT", "ALFA"],
    },
  },
} as const
