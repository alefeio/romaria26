"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { ImageUploadField } from "@/components/admin/ImageUploadField";
import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { ApiResponse } from "@/lib/api-types";

function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

export default function NovoPacotePage() {
  const toast = useToast();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [price, setPrice] = useState("0");
  const [childPrice, setChildPrice] = useState("0");
  const [breakfastKitAvailable, setBreakfastKitAvailable] = useState(false);
  const [breakfastKitPrice, setBreakfastKitPrice] = useState("0");
  const [kitsDeliveryInfo, setKitsDeliveryInfo] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const [departureTime, setDepartureTime] = useState("07:00");
  const [boardingLocation, setBoardingLocation] = useState("");
  const [capacity, setCapacity] = useState("40");
  const [status, setStatus] = useState<"DRAFT" | "SOON" | "OPEN" | "SOLD_OUT" | "CLOSED">("DRAFT");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [galleryText, setGalleryText] = useState("");
  const [isActive, setIsActive] = useState(true);

  const syncSlugFromName = useCallback(() => {
    setSlug(slugify(name));
  }, [name]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const galleryImages = galleryText
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      const res = await fetch("/api/admin/packages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
          description: description.trim() || null,
          shortDescription: shortDescription.trim() || null,
          price,
          childPrice,
          breakfastKitAvailable,
          breakfastKitPrice,
          kitsDeliveryInfo: kitsDeliveryInfo.trim() || null,
          departureDate,
          departureTime: departureTime.trim(),
          boardingLocation: boardingLocation.trim(),
          capacity: Number.parseInt(capacity, 10),
          status,
          coverImageUrl: coverImageUrl.trim() || null,
          galleryImages,
          isActive,
        }),
      });
      const json = (await res.json()) as ApiResponse<{ item: { id: string } }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao salvar.");
        return;
      }
      toast.push("success", "Pacote criado.");
      router.push(`/admin/pacotes/${json.data.item.id}/edit`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl py-6">
      <Link href="/admin/pacotes" className="text-sm text-[var(--igh-primary)] hover:underline">
        ← Pacotes
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-[var(--text-primary)]">Novo pacote</h1>
      <form onSubmit={save} className="mt-6 space-y-4">
        <div>
          <label className="text-sm font-medium text-[var(--text-primary)]">Nome</label>
          <Input
            required
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!slugTouched) setSlug(slugify(e.target.value));
            }}
            className="mt-1"
          />
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-0 flex-1">
            <label className="text-sm font-medium text-[var(--text-primary)]">Slug (URL)</label>
            <Input
              required
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
              className="mt-1 font-mono text-sm"
            />
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={syncSlugFromName}>
            Gerar do nome
          </Button>
        </div>
        <div>
          <label className="text-sm font-medium text-[var(--text-primary)]">Resumo curto</label>
          <Input value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} className="mt-1" />
        </div>
        <div>
          <label className="text-sm font-medium text-[var(--text-primary)]">Descrição</label>
          <textarea
            rows={6}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 w-full rounded-md border border-[var(--card-border)] bg-[var(--background)] px-3 py-2 text-sm"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-[var(--text-primary)]">Preço adulto (R$)</label>
            <Input required value={price} onChange={(e) => setPrice(e.target.value)} className="mt-1" />
          </div>
          <div>
            <label className="text-sm font-medium text-[var(--text-primary)]">Preço criança (R$)</label>
            <Input required value={childPrice} onChange={(e) => setChildPrice(e.target.value)} className="mt-1" />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-[var(--text-primary)]">Capacidade (vagas)</label>
          <Input required type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} className="mt-1" />
        </div>
        <label className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
          <input type="checkbox" checked={breakfastKitAvailable} onChange={(e) => setBreakfastKitAvailable(e.target.checked)} />
          Oferece kit café
        </label>
        {breakfastKitAvailable ? (
          <div>
            <label className="text-sm font-medium text-[var(--text-primary)]">Preço kit café (R$ / pessoa)</label>
            <Input value={breakfastKitPrice} onChange={(e) => setBreakfastKitPrice(e.target.value)} className="mt-1" />
          </div>
        ) : null}
        <div>
          <label className="text-sm font-medium text-[var(--text-primary)]">Entrega dos kits (exibido na reserva)</label>
          <textarea
            rows={4}
            value={kitsDeliveryInfo}
            onChange={(e) => setKitsDeliveryInfo(e.target.value)}
            placeholder="Ex.: Entrega dos kits no dia 10/10, 18h, na sede..."
            className="mt-1 w-full rounded-md border border-[var(--card-border)] bg-[var(--background)] px-3 py-2 text-sm"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-[var(--text-primary)]">Data de saída</label>
            <Input required type="date" value={departureDate} onChange={(e) => setDepartureDate(e.target.value)} className="mt-1" />
          </div>
          <div>
            <label className="text-sm font-medium text-[var(--text-primary)]">Horário de saída</label>
            <Input required value={departureTime} onChange={(e) => setDepartureTime(e.target.value)} placeholder="07:00" className="mt-1" />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-[var(--text-primary)]">Local de embarque</label>
          <Input required value={boardingLocation} onChange={(e) => setBoardingLocation(e.target.value)} className="mt-1" />
        </div>
        <div>
          <label className="text-sm font-medium text-[var(--text-primary)]">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
            className="mt-1 w-full rounded-md border border-[var(--card-border)] bg-[var(--background)] px-3 py-2 text-sm"
          >
            <option value="DRAFT">Rascunho</option>
            <option value="SOON">Em breve</option>
            <option value="OPEN">Aberto (reservas)</option>
            <option value="SOLD_OUT">Esgotado</option>
            <option value="CLOSED">Encerrado</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          Ativo no sistema
        </label>
        <ImageUploadField kind="packages" label="Capa do pacote" currentUrl={coverImageUrl || undefined} onUploaded={setCoverImageUrl} />
        {coverImageUrl ? (
          <Input value={coverImageUrl} onChange={(e) => setCoverImageUrl(e.target.value)} className="font-mono text-xs" />
        ) : null}
        <div>
          <label className="text-sm font-medium text-[var(--text-primary)]">Galeria (uma URL por linha)</label>
          <textarea
            rows={4}
            value={galleryText}
            onChange={(e) => setGalleryText(e.target.value)}
            className="mt-1 w-full rounded-md border border-[var(--card-border)] bg-[var(--background)] px-3 py-2 font-mono text-xs"
          />
        </div>
        <div className="flex gap-2 pt-4">
          <Button type="submit" disabled={saving}>
            {saving ? "Salvando…" : "Criar pacote"}
          </Button>
          <Link href="/admin/pacotes">
            <Button type="button" variant="secondary">
              Cancelar
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
