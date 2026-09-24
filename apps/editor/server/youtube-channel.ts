import type { YouTubeChannelProfileResponse } from "../shared/api-types.ts";

interface ChannelApiResponse {
  items?: Array<{
    id?: string;
    snippet?: {
      title?: string;
      thumbnails?: Record<string, { url?: string }>;
    };
  }>;
  error?: { message?: string };
}

type ChannelLookup =
  | { kind: "id"; value: string }
  | { kind: "handle"; value: string }
  | { kind: "username"; value: string };

function parseChannelLookup(input: string): ChannelLookup {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Enter a YouTube channel URL.");

  if (/^UC[A-Za-z0-9_-]{20,}$/.test(trimmed)) return { kind: "id", value: trimmed };
  if (/^@[A-Za-z0-9._-]+$/.test(trimmed)) return { kind: "handle", value: trimmed };

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("Enter a valid YouTube channel URL, handle, or channel ID.");
  }

  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  if (host !== "youtube.com" && host !== "m.youtube.com") {
    throw new Error("Channel profiles must come from youtube.com.");
  }

  const parts = url.pathname.split("/").filter(Boolean);
  const first = parts[0] ?? "";
  const second = parts[1] ?? "";

  if (first.startsWith("@")) return { kind: "handle", value: first };
  if (first === "channel" && second) return { kind: "id", value: second };
  if (first === "user" && second) return { kind: "username", value: second };

  throw new Error(
    "Use a YouTube @handle URL, /channel/UC… URL, or legacy /user/… URL so the channel can be resolved reliably.",
  );
}

export async function importYouTubeChannelProfile(
  input: string,
  apiKey: string | undefined,
): Promise<YouTubeChannelProfileResponse> {
  if (!apiKey) {
    throw new Error("YouTube channel import needs YOUTUBE_API_KEY in .env.local.");
  }

  const lookup = parseChannelLookup(input);
  const endpoint = new URL("https://www.googleapis.com/youtube/v3/channels");
  endpoint.searchParams.set("part", "snippet");
  endpoint.searchParams.set("key", apiKey);
  if (lookup.kind === "id") endpoint.searchParams.set("id", lookup.value);
  if (lookup.kind === "handle") endpoint.searchParams.set("forHandle", lookup.value);
  if (lookup.kind === "username") endpoint.searchParams.set("forUsername", lookup.value);

  const response = await fetch(endpoint);
  const payload = (await response.json()) as ChannelApiResponse;
  if (!response.ok) {
    throw new Error(
      payload.error?.message ?? `YouTube channel lookup failed (${response.status}).`,
    );
  }

  const channel = payload.items?.[0];
  const channelId = channel?.id;
  const title = channel?.snippet?.title;
  const thumbnails = channel?.snippet?.thumbnails;
  const avatarUrl = thumbnails?.high?.url ?? thumbnails?.medium?.url ?? thumbnails?.default?.url;
  if (!channelId || !title || !avatarUrl) {
    throw new Error("YouTube returned no usable channel profile for that URL.");
  }

  return {
    channelId,
    title,
    channelUrl: `https://www.youtube.com/channel/${channelId}`,
    avatarUrl,
  };
}
