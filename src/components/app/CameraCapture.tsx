import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Camera, Video, RefreshCw, X, Check, RotateCcw, Square } from "lucide-react";
import { toast } from "sonner";

type CapturedItem = { file: File; url: string; kind: "image" | "video" };

export function CameraCapture({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (files: File[]) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<Blob[]>([]);

  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [supported, setSupported] = useState(true);
  const [starting, setStarting] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [items, setItems] = useState<CapturedItem[]>([]);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const startStream = useCallback(async (mode: "environment" | "user") => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setSupported(false);
      return;
    }
    setStarting(true);
    try {
      stopStream();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: mode } },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (err) {
      console.error("getUserMedia error", err);
      setSupported(false);
      toast.error("Tidak bisa mengakses kamera. Gunakan pilih file.");
    } finally {
      setStarting(false);
    }
  }, [stopStream]);

  useEffect(() => {
    if (!open) return;
    setItems([]);
    setSupported(true);
    startStream(facing);
    return () => {
      stopStream();
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        try { recorderRef.current.stop(); } catch {}
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    startStream(facing);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facing]);

  useEffect(() => {
    if (!recording) return;
    setRecordSeconds(0);
    const id = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [recording]);

  const takePhoto = async () => {
    const video = videoRef.current;
    if (!video || !streamRef.current) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    const blob: Blob | null = await new Promise((res) =>
      canvas.toBlob((b) => res(b), "image/jpeg", 0.9),
    );
    if (!blob) return;
    const file = new File([blob], `foto-${Date.now()}.jpg`, { type: "image/jpeg" });
    setItems((arr) => [...arr, { file, url: URL.createObjectURL(blob), kind: "image" }]);
  };

  const startRecording = () => {
    const stream = streamRef.current;
    if (!stream) return;
    const mime = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"]
      .find((m) => (window as any).MediaRecorder?.isTypeSupported?.(m));
    try {
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      recordChunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordChunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const type = rec.mimeType || "video/webm";
        const blob = new Blob(recordChunksRef.current, { type });
        const ext = type.includes("mp4") ? "mp4" : "webm";
        const file = new File([blob], `video-${Date.now()}.${ext}`, { type });
        setItems((arr) => [...arr, { file, url: URL.createObjectURL(blob), kind: "video" }]);
      };
      recorderRef.current = rec;
      rec.start();
      setRecording(true);
    } catch (e) {
      console.error(e);
      toast.error("Perekaman tidak didukung di perangkat ini.");
    }
  };

  const stopRecording = () => {
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
    setRecording(false);
  };

  const removeItem = (idx: number) => {
    setItems((arr) => {
      const it = arr[idx];
      if (it) URL.revokeObjectURL(it.url);
      return arr.filter((_, i) => i !== idx);
    });
  };

  const handleClose = () => {
    stopStream();
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      try { recorderRef.current.stop(); } catch {}
    }
    setRecording(false);
    items.forEach((i) => URL.revokeObjectURL(i.url));
    setItems([]);
    onClose();
  };

  const handleConfirm = () => {
    if (items.length === 0) return;
    onConfirm(items.map((i) => i.file));
    items.forEach((i) => URL.revokeObjectURL(i.url));
    setItems([]);
    stopStream();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="flex items-center justify-between">
            <span>Ambil Bukti</span>
            <Button variant="ghost" size="icon" onClick={handleClose} className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="relative bg-black aspect-[3/4] w-full">
          {supported ? (
            <>
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className="absolute inset-0 w-full h-full object-cover"
              />
              {starting && (
                <div className="absolute inset-0 grid place-items-center text-white/80 text-sm">
                  Menyalakan kamera...
                </div>
              )}
              {recording && (
                <div className="absolute top-3 left-3 flex items-center gap-2 rounded-full bg-red-600/90 px-3 py-1 text-xs text-white">
                  <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                  REC {String(Math.floor(recordSeconds / 60)).padStart(2, "0")}:
                  {String(recordSeconds % 60).padStart(2, "0")}
                </div>
              )}
              <button
                type="button"
                onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))}
                className="absolute top-3 right-3 grid place-items-center h-10 w-10 rounded-full bg-black/50 text-white"
                aria-label="Ganti kamera"
              >
                <RefreshCw className="h-5 w-5" />
              </button>
            </>
          ) : (
            <div className="absolute inset-0 grid place-items-center px-6 text-center text-white/90 text-sm gap-3">
              <p>Kamera tidak tersedia di browser ini.</p>
              <p className="text-xs text-white/60">Mohon izinkan akses kamera di pengaturan browser Anda.</p>
            </div>
          )}
        </div>

        {supported && (
          <div className="flex items-center justify-around bg-black py-4">
            <div className="h-12 w-12" />{/* spacer */}

            <button
              type="button"
              onClick={takePhoto}
              disabled={recording}
              className="grid place-items-center h-16 w-16 rounded-full bg-white ring-4 ring-white/30 disabled:opacity-40"
              aria-label="Ambil foto"
            >
              <Camera className="h-6 w-6 text-black" />
            </button>

            <button
              type="button"
              onClick={recording ? stopRecording : startRecording}
              className={`grid place-items-center h-12 w-12 rounded-full text-white ${
                recording ? "bg-red-600" : "bg-white/10"
              }`}
              aria-label={recording ? "Stop rekam" : "Rekam video"}
            >
              {recording ? <Square className="h-5 w-5 fill-white" /> : <Video className="h-5 w-5" />}
            </button>
          </div>
        )}

        {items.length > 0 && (
          <div className="border-t p-3 space-y-3 bg-background">
            <div className="flex gap-2 overflow-x-auto">
              {items.map((it, idx) => (
                <div key={idx} className="relative shrink-0">
                  {it.kind === "image" ? (
                    <img src={it.url} alt="preview" className="h-20 w-20 object-cover rounded-md border" />
                  ) : (
                    <video src={it.url} className="h-20 w-20 object-cover rounded-md border bg-black" muted />
                  )}
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    className="absolute -top-1 -right-1 grid place-items-center h-5 w-5 rounded-full bg-black/80 text-white"
                    aria-label="Hapus"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  items.forEach((i) => URL.revokeObjectURL(i.url));
                  setItems([]);
                }}
              >
                <RotateCcw className="h-4 w-4 mr-2" /> Ulangi
              </Button>
              <Button className="flex-1" onClick={handleConfirm}>
                <Check className="h-4 w-4 mr-2" /> Kirim ({items.length})
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
