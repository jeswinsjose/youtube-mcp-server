import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { z } from "zod";
import { YoutubeTranscript } from "youtube-transcript";
import {
  extractVideoId,
  extractChannelIdentifier,
  getVideoDetails,
  searchVideos,
  getChannelInfo,
  getVideoComments,
} from "./youtube";

export class YouTubeMCP extends McpAgent<Env> {
  server = new McpServer({
    name: "youtube-mcp-server",
    version: "1.0.0",
  });

  async init() {
    const env = this.env;

    this.server.tool(
      "get_transcript",
      "Fetch the transcript/captions of a YouTube video",
      {
        url: z.string().describe("YouTube video URL or video ID"),
        language: z
          .string()
          .optional()
          .describe("Language code for the transcript (e.g. 'en', 'es'). Defaults to 'en'."),
      },
      async ({ url, language }) => {
        const videoId = extractVideoId(url);
        if (!videoId) {
          return {
            content: [{ type: "text" as const, text: "Error: Could not extract a valid video ID from the provided URL." }],
            isError: true,
          };
        }
        try {
          const lang = language ?? "en";
          const items = await YoutubeTranscript.fetchTranscript(videoId, { lang });
          const transcript = items.map((i) => i.text).join(" ");
          return {
            content: [{ type: "text" as const, text: transcript || "No transcript content found." }],
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          return {
            content: [{ type: "text" as const, text: `Error fetching transcript: ${msg}` }],
            isError: true,
          };
        }
      },
    );

    this.server.tool(
      "get_video_details",
      "Get metadata for a YouTube video including title, description, view count, likes, and more",
      {
        url: z.string().describe("YouTube video URL or video ID"),
      },
      async ({ url }) => {
        const videoId = extractVideoId(url);
        if (!videoId) {
          return {
            content: [{ type: "text" as const, text: "Error: Could not extract a valid video ID from the provided URL." }],
            isError: true,
          };
        }
        try {
          const details = await getVideoDetails(videoId, env.YOUTUBE_API_KEY);
          return {
            content: [{ type: "text" as const, text: JSON.stringify(details, null, 2) }],
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          return {
            content: [{ type: "text" as const, text: `Error fetching video details: ${msg}` }],
            isError: true,
          };
        }
      },
    );

    this.server.tool(
      "search_videos",
      "Search YouTube for videos matching a query",
      {
        query: z.string().describe("Search query"),
        maxResults: z
          .number()
          .min(1)
          .max(25)
          .optional()
          .describe("Maximum number of results to return (1-25, default 5)"),
      },
      async ({ query, maxResults }) => {
        try {
          const results = await searchVideos(query, env.YOUTUBE_API_KEY, maxResults ?? 5);
          return {
            content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }],
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          return {
            content: [{ type: "text" as const, text: `Error searching videos: ${msg}` }],
            isError: true,
          };
        }
      },
    );

    this.server.tool(
      "get_channel_details",
      "Get information about a YouTube channel",
      {
        channel: z
          .string()
          .describe("YouTube channel URL, channel ID, or @handle"),
      },
      async ({ channel }) => {
        const identifier = extractChannelIdentifier(channel);
        if (!identifier) {
          return {
            content: [{ type: "text" as const, text: "Error: Could not parse channel identifier." }],
            isError: true,
          };
        }
        try {
          const info = await getChannelInfo(identifier, env.YOUTUBE_API_KEY);
          return {
            content: [{ type: "text" as const, text: JSON.stringify(info, null, 2) }],
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          return {
            content: [{ type: "text" as const, text: `Error fetching channel info: ${msg}` }],
            isError: true,
          };
        }
      },
    );

    this.server.tool(
      "get_video_comments",
      "Get top comments on a YouTube video",
      {
        url: z.string().describe("YouTube video URL or video ID"),
        maxResults: z
          .number()
          .min(1)
          .max(100)
          .optional()
          .describe("Maximum number of comments to return (1-100, default 20)"),
      },
      async ({ url, maxResults }) => {
        const videoId = extractVideoId(url);
        if (!videoId) {
          return {
            content: [{ type: "text" as const, text: "Error: Could not extract a valid video ID from the provided URL." }],
            isError: true,
          };
        }
        try {
          const comments = await getVideoComments(videoId, env.YOUTUBE_API_KEY, maxResults ?? 20);
          return {
            content: [{ type: "text" as const, text: JSON.stringify(comments, null, 2) }],
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          return {
            content: [{ type: "text" as const, text: `Error fetching comments: ${msg}` }],
            isError: true,
          };
        }
      },
    );
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    if (url.pathname === "/") {
      return new Response(
        JSON.stringify({
          status: "ok",
          name: "youtube-mcp-server",
          version: "1.0.0",
          endpoints: { sse: "/sse", messages: "/sse" },
          tools: [
            "get_transcript",
            "get_video_details",
            "search_videos",
            "get_channel_details",
            "get_video_comments",
          ],
        }),
        {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }

    if (url.pathname === "/sse" || url.pathname === "/messages") {
      return YouTubeMCP.serve("/sse").fetch(request, env, ctx);
    }

    return new Response("Not Found", { status: 404 });
  },
};
