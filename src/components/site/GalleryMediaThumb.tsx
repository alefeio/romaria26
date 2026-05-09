import { isVideoUrl } from "@/lib/media-url";

type Props = {
  src: string;
  alt?: string;
  /** Classes no container externo (ex.: altura fixa). */
  className?: string;
  /** Classes na tag img ou video. */
  mediaClassName?: string;
  /** Mostrar etiqueta “Vídeo” sobre miniaturas de vídeo. */
  showVideoBadge?: boolean;
};

/**
 * Miniatura da galeria: imagem ou vídeo (preview silencioso), com selo opcional para vídeo.
 */
export function GalleryMediaThumb({
  src,
  alt = "",
  className = "",
  mediaClassName = "",
  showVideoBadge = true,
}: Props) {
  if (isVideoUrl(src)) {
    return (
      <div className={`relative overflow-hidden ${className}`}>
        <video
          src={src}
          className={`w-full object-cover bg-black/5 ${mediaClassName}`}
          muted
          playsInline
          preload="metadata"
          aria-hidden
          tabIndex={-1}
        />
        {showVideoBadge ? (
          <span className="pointer-events-none absolute bottom-2 right-2 rounded bg-black/65 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
            Vídeo
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className={`w-full object-cover ${mediaClassName}`} loading="lazy" />
    </div>
  );
}
