const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

const VIDEO_ID_PATTERNS = [
  /(?:youtube\.com\/watch\?.*v=)([a-zA-Z0-9_-]{11})/,
  /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
  /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  /(?:youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/,
  /(?:youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
];

export function extractVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  for (const pattern of VIDEO_ID_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export function extractChannelIdentifier(input: string): {
  type: "id" | "handle" | "username";
  value: string;
} | null {
  const trimmed = input.trim();

  const idMatch = trimmed.match(/youtube\.com\/channel\/([a-zA-Z0-9_-]+)/);
  if (idMatch) return { type: "id", value: idMatch[1] };

  const handleMatch = trimmed.match(/youtube\.com\/@([a-zA-Z0-9_.-]+)/);
  if (handleMatch) return { type: "handle", value: `@${handleMatch[1]}` };

  if (trimmed.startsWith("@")) return { type: "handle", value: trimmed };
  if (trimmed.startsWith("UC") && trimmed.length === 24) return { type: "id", value: trimmed };

  return { type: "handle", value: trimmed };
}

async function youtubeApiFetch(
  endpoint: string,
  params: Record<string, string>,
  apiKey: string,
): Promise<any> {
  const url = new URL(`${YOUTUBE_API_BASE}/${endpoint}`);
  url.searchParams.set("key", apiKey);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`YouTube API error (${res.status}): ${body}`);
  }
  return res.json();
}

export interface VideoDetails {
  title: string;
  description: string;
  channelTitle: string;
  channelId: string;
  publishedAt: string;
  viewCount: string;
  likeCount: string;
  commentCount: string;
  duration: string;
  tags: string[];
  thumbnailUrl: string;
  categoryId: string;
}

export async function getVideoDetails(
  videoId: string,
  apiKey: string,
): Promise<VideoDetails> {
  const data = await youtubeApiFetch("videos", {
    part: "snippet,statistics,contentDetails",
    id: videoId,
  }, apiKey);

  if (!data.items?.length) throw new Error("Video not found or is private.");
  const item = data.items[0];

  return {
    title: item.snippet.title,
    description: item.snippet.description,
    channelTitle: item.snippet.channelTitle,
    channelId: item.snippet.channelId,
    publishedAt: item.snippet.publishedAt,
    viewCount: item.statistics.viewCount ?? "N/A",
    likeCount: item.statistics.likeCount ?? "N/A",
    commentCount: item.statistics.commentCount ?? "N/A",
    duration: item.contentDetails.duration,
    tags: item.snippet.tags ?? [],
    thumbnailUrl: item.snippet.thumbnails?.high?.url ?? "",
    categoryId: item.snippet.categoryId,
  };
}

export interface SearchResult {
  videoId: string;
  title: string;
  description: string;
  channelTitle: string;
  publishedAt: string;
  thumbnailUrl: string;
}

export async function searchVideos(
  query: string,
  apiKey: string,
  maxResults: number = 5,
): Promise<SearchResult[]> {
  const data = await youtubeApiFetch("search", {
    part: "snippet",
    q: query,
    type: "video",
    maxResults: String(maxResults),
  }, apiKey);

  return (data.items ?? []).map((item: any) => ({
    videoId: item.id.videoId,
    title: item.snippet.title,
    description: item.snippet.description,
    channelTitle: item.snippet.channelTitle,
    publishedAt: item.snippet.publishedAt,
    thumbnailUrl: item.snippet.thumbnails?.high?.url ?? "",
  }));
}

export interface ChannelInfo {
  id: string;
  title: string;
  description: string;
  customUrl: string;
  publishedAt: string;
  subscriberCount: string;
  videoCount: string;
  viewCount: string;
  thumbnailUrl: string;
  country: string;
}

export async function getChannelInfo(
  identifier: { type: "id" | "handle" | "username"; value: string },
  apiKey: string,
): Promise<ChannelInfo> {
  const params: Record<string, string> = {
    part: "snippet,statistics",
  };

  if (identifier.type === "id") {
    params.id = identifier.value;
  } else if (identifier.type === "handle") {
    params.forHandle = identifier.value;
  } else {
    params.forUsername = identifier.value;
  }

  const data = await youtubeApiFetch("channels", params, apiKey);
  if (!data.items?.length) throw new Error("Channel not found.");

  const item = data.items[0];
  return {
    id: item.id,
    title: item.snippet.title,
    description: item.snippet.description,
    customUrl: item.snippet.customUrl ?? "",
    publishedAt: item.snippet.publishedAt,
    subscriberCount: item.statistics.subscriberCount ?? "hidden",
    videoCount: item.statistics.videoCount ?? "0",
    viewCount: item.statistics.viewCount ?? "0",
    thumbnailUrl: item.snippet.thumbnails?.high?.url ?? "",
    country: item.snippet.country ?? "N/A",
  };
}

export interface Comment {
  author: string;
  text: string;
  likeCount: number;
  publishedAt: string;
  replyCount: number;
}

export async function getVideoComments(
  videoId: string,
  apiKey: string,
  maxResults: number = 20,
): Promise<Comment[]> {
  const data = await youtubeApiFetch("commentThreads", {
    part: "snippet",
    videoId,
    maxResults: String(maxResults),
    order: "relevance",
    textFormat: "plainText",
  }, apiKey);

  return (data.items ?? []).map((item: any) => {
    const top = item.snippet.topLevelComment.snippet;
    return {
      author: top.authorDisplayName,
      text: top.textDisplay,
      likeCount: top.likeCount,
      publishedAt: top.publishedAt,
      replyCount: item.snippet.totalReplyCount,
    };
  });
}
