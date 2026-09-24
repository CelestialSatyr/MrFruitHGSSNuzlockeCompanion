import type { YouTubeEpisodeMetadata } from "@nuzlocke/core";
function parseDuration(value: string) {
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(value);
  if (!m) throw new Error(`Unsupported YouTube duration: ${value}`);
  return (
    Number(m[1] ?? 0) * 86400 +
    Number(m[2] ?? 0) * 3600 +
    Number(m[3] ?? 0) * 60 +
    Number(m[4] ?? 0)
  );
}
export function extractYouTubeVideoId(input: string) {
  const t = input.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(t)) return t;
  let url: URL;
  try {
    url = new URL(t);
  } catch {
    throw new Error("Enter a valid YouTube video URL or video ID.");
  }
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0];
    if (id) return id;
  }
  if (host.endsWith("youtube.com")) {
    const q = url.searchParams.get("v");
    if (q) return q;
    const parts = url.pathname.split("/").filter(Boolean);
    if (["shorts", "live", "embed"].includes(parts[0] ?? "") && parts[1]) return parts[1];
  }
  throw new Error("Could not determine the YouTube video ID.");
}
interface ApiResponse {
  items?: Array<{
    id: string;
    snippet?: {
      title?: string;
      description?: string;
      channelTitle?: string;
      publishedAt?: string;
      thumbnails?: Record<string, { url?: string; width?: number; height?: number }>;
    };
    contentDetails?: { duration?: string };
  }>;
  error?: { message?: string };
}
export async function importYouTubeMetadata(
  input: string,
  apiKey: string | undefined,
): Promise<YouTubeEpisodeMetadata> {
  if (!apiKey)
    throw new Error(
      "YouTube import is not configured. Add YOUTUBE_API_KEY to .env.local and restart the editor.",
    );
  const videoId = extractYouTubeVideoId(input);
  const endpoint = new URL("https://www.googleapis.com/youtube/v3/videos");
  endpoint.searchParams.set("part", "snippet,contentDetails");
  endpoint.searchParams.set("id", videoId);
  endpoint.searchParams.set("key", apiKey);
  const response = await fetch(endpoint);
  const payload = (await response.json()) as ApiResponse;
  if (!response.ok)
    throw new Error(payload.error?.message ?? `YouTube request failed (${response.status}).`);
  const item = payload.items?.[0];
  if (!item?.snippet || !item.contentDetails?.duration)
    throw new Error("YouTube returned no metadata for that video.");
  const s = item.snippet;
  const thumb = ["maxres", "standard", "high", "medium", "default"]
    .map((k) => s.thumbnails?.[k])
    .find((v) => v?.url && v.width && v.height);
  if (!s.title || !s.channelTitle || !s.publishedAt || !thumb?.url || !thumb.width || !thumb.height)
    throw new Error("YouTube metadata was incomplete.");
  return {
    videoId,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    title: s.title,
    description: s.description ?? "",
    channelTitle: s.channelTitle,
    publishedAt: s.publishedAt,
    durationSeconds: parseDuration(item.contentDetails.duration),
    thumbnail: { url: thumb.url, width: thumb.width, height: thumb.height },
  };
}
