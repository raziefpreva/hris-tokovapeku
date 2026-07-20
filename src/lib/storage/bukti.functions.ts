import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getBuktiSignedUrls = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ paths: z.array(z.string()).max(20) }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const out: Record<string, string> = {};
    for (const p of data.paths) {
      const { data: s, error } = await supabaseAdmin.storage
        .from("bukti-tugas")
        .createSignedUrl(p, 600);
      if (error) {
        console.error("createSignedUrl failed", p, error);
        continue;
      }
      if (s?.signedUrl) out[p] = s.signedUrl;
    }
    return out;
  });