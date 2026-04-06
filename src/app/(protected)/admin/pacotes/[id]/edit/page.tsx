"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
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

type Item = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  shortDescription: string | null;
  price: string;
  breakfastKitAvailable: boolean;
  breakfastKitPrice: string;
  departureDate: string;
  departureTime: string;
  boardingLocation: string;
  capacity: number;
  status: "DRAFT" | "OPEN" | "SOLD_OUT" | "CLOSED";
  coverImageUrl: string | null;
  galleryImages: string[];
  isActive: boolean;
};

export default function EditarPacotePage() {
  const toast = useToast();
  const router = useRouter();
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [price, setPrice] = useState("0");
  const [breakfastKitAvailable, setBreakfastKitAvailable] = useState(false);
  const [breakfastKitPrice, setBreakfastKitPrice] = useState("0");
  const [departureDate, setDepartureDate] = useState("");
  const [departureTime, setDepartureTime] = useState("");
  const [boardingLocation, setBoardingLocation] = useState("");
  const [capacity, setCapacity] = useState("40");
  const [status, setStatus] = useState<Item["status"]>("DRAFT");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [galleryText, setGalleryText] = useState("");
  const [isActive, setIsActive] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/packages/${id}`);
      const json = (await res.json()) as ApiResponse<{ item: Item }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Pacote não encontrado.");
        router.push("/admin/pacotes");
        return;
      }
      const p = json.data.item;
      setName(p.name);
      setSlug(p.slug);
      setSlugTouched(true);
      setDescription(p.description ?? "");
      setShortDescription(p.shortDescription ?? "");
      setPrice(p.price);
      setBreakfastKitAvailable(p.breakfastKitAvailable);
      setBreakfastKitPrice(p.breakfastKitPrice);
      const d = typeof p.departureDate === "string" ? p.departureDate : new Date(p.departureDate).toISOString();
      setDepartureDate(d.slice(0, 10));
      setDepartureTime(p.departureTime);
      setBoardingLocation(p.boardingLocation);
      setCapacity(String(p.capacity));
      setStatus(p.status);
      setCoverImageUrl(p.coverImageUrl ?? "");
      setGalleryText((p.galleryImages ?? []).join("\n"));
      setIsActive(p.isActive);
    } finally {
      setLoading(false);
    }
  }, [id, router, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    setSaving(true);
    try {
      const galleryImages = galleryText
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      const res = await fetch(`/api/admin/packages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
          description: description.trim() || null,
          shortDescription: shortDescription.trim() || null,
          price,
          breakfastKitAvailable,
          breakfastKitPrice,
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
      const json = (await res.json()) as ApiResponse<{ item: Item }>;
      if (!res.ok || !json.ok) {
        toast.push("error", !json.ok ? json.error.message : "Falha ao salvar.");
        return;
      }
      toast.push("success", "Pacote atualizado.");
    } finally {
      setSaving(false);
    }
  }

  if (!id) return null;
  if (loading) return <p className="py-8 text-[var(--text-secondary)]">Carregando…</p>;

  return (
    <div className="mx-auto max-w-3xl py-6">
      <Link href="/admin/pacotes" className="text-sm text-[var(--igh-primary)] hover:underline">
        ← Pacotes
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-[var(--text-primary)]">Editar pacote</h1>
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
          <Button type="button" variant="secondary" size="sm" onClick={() => setSlug(slugify(name))}>
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
            <label className="text-sm font-medium text-[var(--text-primary)]">Preço (R$)</label>
            <Input required value={price} onChange={(e) => setPrice(e.target.value)} className="mt-1" />
          </div>
          <div>
            <label className="text-sm font-medium text-[var(--text-primary)]">Capacidade</label>
            <Input required type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} className="mt-1" />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
          <input type="checkbox" checked={breakfastKitAvailable} onChange={(e) => setBreakfastKitAvailable(e.target.checked)} />
          Oferece kit café
        </label>
        {breakfastKitAvailable ? (
          <div>
            <label className="text-sm font-medium text-[var(--text-primary)]">Preço kit café</label>
            <Input value={breakfastKitPrice} onChange={(e) => setBreakfastKitPrice(e.target.value)} className="mt-1" />
          </div>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-[var(--text-primary)]">Data de saída</label>
            <Input required type="date" value={departureDate} onChange={(e) => setDepartureDate(e.target.value)} className="mt-1" />
          </div>
          <div>
            <label className="text-sm font-medium text-[var(--text-primary)]">Horário</label>
            <Input required value={departureTime} onChange={(e) => setDepartureTime(e.target.value)} className="mt-1" />
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
            onChange={(e) => setStatus(e.target.value as Item["status"])}
            className="mt-1 w-full rounded-md border border-[var(--card-border)] bg-[var(--background)] px-3 py-2 text-sm"
          >
            <option value="DRAFT">Rascunho</option>
            <option value="OPEN">Aberto</option>
            <option value="SOLD_OUT">Esgotado</option>
            <option value="CLOSED">Encerrado</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          Ativo
        </label>
        <ImageUploadField kind="packages" label="Capa" currentUrl={coverImageUrl || undefined} onUploaded={setCoverImageUrl} />
        {coverImageUrl ? (
          <Input value={coverImageUrl} onChange={(e) => setCoverImageUrl(e.target.value)} className="font-mono text-xs" />
        ) : null}
        <div>
          <label className="text-sm font-medium text-[var(--text-primary)]">Galeria (URL por linha)</label>
          <textarea
            rows={4}
            value={galleryText}
            onChange={(e) => setGalleryText(e.target.value)}
            className="mt-1 w-full rounded-md border border-[var(--card-border)] bg-[var(--background)] px-3 py-2 font-mono text-xs"
          />
        </div>
        <div className="flex gap-2 pt-4">
          <Button type="submit" disabled={saving}>
            {saving ? "Salvando…" : "Salvar alterações"}
          </Button>
          <Link href="/admin/pacotes">
            <Button type="button" variant="secondary">
              Voltar
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
