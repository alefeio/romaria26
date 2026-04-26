"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";

function extractVoucherCode(raw: string): string | null {
  try {
    const u = new URL(raw);
    const parts = u.pathname.split("/").filter(Boolean);
    const last = parts[parts.length - 1] ?? "";
    if (!last) return null;
    return decodeURIComponent(last);
  } catch {
    return raw?.trim() ? raw.trim() : null;
  }
}

export function VoucherScannerClient() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [lastText, setLastText] = useState<string | null>(null);

  const hasBarcodeDetector = useMemo(() => typeof window !== "undefined" && "BarcodeDetector" in window, []);

  useEffect(() => {
    if (!running) return;
    let stream: MediaStream | null = null;
    let raf = 0;
    let cancelled = false;

    async function start() {
      setError(null);
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (!videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        if (!("BarcodeDetector" in window)) {
          setError("Seu navegador não suporta leitura de QR Code nesta tela. Use Chrome/Edge no celular.");
          return;
        }

        const detector = new (window as any).BarcodeDetector({ formats: ["qr_code"] });
        const tick = async () => {
          if (cancelled) return;
          const video = videoRef.current;
          if (video && video.readyState >= 2) {
            try {
              const barcodes = await detector.detect(video);
              const raw = barcodes?.[0]?.rawValue as string | undefined;
              if (raw) {
                setLastText(raw);
                const code = extractVoucherCode(raw);
                if (code) {
                  router.push(`/admin/vouchers/${encodeURIComponent(code)}/checkin`);
                  return;
                }
              }
            } catch {
              /* ignore */
            }
          }
          raf = requestAnimationFrame(() => void tick());
        };
        raf = requestAnimationFrame(() => void tick());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Não foi possível acessar a câmera.");
      }
    }

    void start();

    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [router, running]);

  return (
    <div className="py-6">
      <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Validar voucher (câmera)</h1>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">
        Aponte a câmera para o QR Code do voucher. Ao detectar, você será redirecionado para o check-in.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" onClick={() => setRunning(true)} disabled={running}>
          {running ? "Câmera ativa" : "Iniciar câmera"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => setRunning(false)} disabled={!running}>
          Parar
        </Button>
      </div>

      {error ? (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100">
          {error}
        </div>
      ) : null}

      {!hasBarcodeDetector ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          Este navegador pode não suportar leitura de QR Code via câmera. Recomendo Chrome/Edge no celular.
        </div>
      ) : null}

      <div className="mt-6 overflow-hidden rounded-2xl border border-[var(--card-border)] bg-black">
        <video ref={videoRef} className="h-[420px] w-full object-cover" muted playsInline />
      </div>

      {lastText ? (
        <div className="mt-3 text-xs text-[var(--text-muted)] break-all">Último QR lido: {lastText}</div>
      ) : null}
    </div>
  );
}

