// apps/web/src/components/CloudflareVideoPlayer.tsx
//
// Web video player using Cloudflare Stream iframe embed.
// On MOBILE, use expo-av with the HLS URL instead.
// This component is web-only and lives in apps/web, not shared-logic.

interface Props {
  cfVideoId: string;        // The raw Cloudflare video UID (cfVideoId from Firestore)
  autoplay?: boolean;
  muted?: boolean;
  className?: string;
}

const CF_CUSTOMER_CODE = process.env.NEXT_PUBLIC_CF_CUSTOMER_CODE ?? "";

export function CloudflareVideoPlayer({ cfVideoId, autoplay = false, muted = false, className }: Props) {
  const params = new URLSearchParams();
  if (autoplay) params.set("autoplay", "true");
  if (muted)    params.set("muted",    "true");
  params.set("preload", "metadata");

  const src = `https://iframe.cloudflarestream.com/${cfVideoId}?${params.toString()}`;

  return (
    <div className={`relative aspect-video w-full overflow-hidden rounded-xl bg-black ${className ?? ""}`}>
      <iframe
        src={src}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="absolute inset-0 w-full h-full border-0"
        title="Gloows Video"
      />
    </div>
  );
}

// Thumbnail utility — Cloudflare Stream provides thumbnails at this URL pattern
export function getCfThumbnailUrl(cfVideoId: string, time = 1): string {
  return `https://videodelivery.net/${cfVideoId}/thumbnails/thumbnail.jpg?time=${time}s&width=480`;
}
