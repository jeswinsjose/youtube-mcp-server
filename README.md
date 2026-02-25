# YouTube MCP Server

A remote [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server that gives Claude (and any MCP client) access to YouTube data — transcripts, video metadata, search, channel info, and comments. Runs on [Cloudflare Workers](https://workers.cloudflare.com/) with zero infrastructure to manage.

## Features

- **Remote MCP server** — connects directly to Claude.ai web, Claude Desktop, and any MCP-compatible client
- **SSE + Streamable HTTP transport** — powered by Cloudflare's `McpAgent` with automatic transport negotiation
- **5 YouTube tools** — transcripts, video details, search, channel info, comments
- **All YouTube URL formats** — `youtube.com/watch?v=`, `youtu.be/`, `/shorts/`, `/live/`, `/embed/`, and raw video IDs
- **Multi-language transcripts** — fetch captions in any language YouTube provides
- **No Node.js runtime needed** — runs entirely on Cloudflare's edge network with global low-latency access
- **Durable Objects** — per-session state management for reliable MCP connections

## Quick Start

### Connect to Claude.ai (Web)

1. Open [claude.ai](https://claude.ai)
2. Go to **Settings → Integrations → Add MCP Server**
3. Enter the server URL:
   ```
   https://youtube-mcp-server.jeswinsamueljose.workers.dev/sse
   ```
4. The 5 YouTube tools will appear in your Claude conversation

### Connect to Claude Desktop

Add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "youtube": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://youtube-mcp-server.jeswinsamueljose.workers.dev/sse"
      ]
    }
  }
}
```

Then restart Claude Desktop. Look for the tools icon in the chat interface.

## Tools

### `get_transcript`

Fetch the transcript/captions of a YouTube video.

| Parameter  | Type   | Required | Description                                      |
|------------|--------|----------|--------------------------------------------------|
| `url`      | string | Yes      | YouTube video URL or video ID                    |
| `language` | string | No       | Language code (e.g. `en`, `es`, `fr`). Default: `en` |

**Example prompt:**
> Get the transcript of https://www.youtube.com/watch?v=dQw4w9WgXcQ

---

### `get_video_details`

Get metadata for a YouTube video including title, description, view count, likes, duration, tags, and more.

| Parameter | Type   | Required | Description                   |
|-----------|--------|----------|-------------------------------|
| `url`     | string | Yes      | YouTube video URL or video ID |

**Example prompt:**
> What are the stats for this video? https://youtu.be/dQw4w9WgXcQ

**Returns:** title, description, channel, publish date, view count, like count, comment count, duration, tags, thumbnail URL, category ID.

---

### `search_videos`

Search YouTube for videos matching a query.

| Parameter    | Type   | Required | Description                              |
|--------------|--------|----------|------------------------------------------|
| `query`      | string | Yes      | Search query                             |
| `maxResults` | number | No       | Number of results, 1–25. Default: `5`    |

**Example prompt:**
> Search YouTube for "machine learning tutorial" and show me the top 10 results

---

### `get_channel_details`

Get information about a YouTube channel.

| Parameter | Type   | Required | Description                                |
|-----------|--------|----------|--------------------------------------------|
| `channel` | string | Yes      | Channel URL, channel ID, or `@handle`      |

**Example prompt:**
> Tell me about the channel @mkbhd

**Returns:** title, description, subscriber count, video count, total view count, country, thumbnail URL.

---

### `get_video_comments`

Get top comments on a YouTube video, sorted by relevance.

| Parameter    | Type   | Required | Description                              |
|--------------|--------|----------|------------------------------------------|
| `url`        | string | Yes      | YouTube video URL or video ID            |
| `maxResults` | number | No       | Number of comments, 1–100. Default: `20` |

**Example prompt:**
> Show me the top 30 comments on https://www.youtube.com/watch?v=dQw4w9WgXcQ

## Supported URL Formats

All tools that accept a URL handle these formats automatically:

- `https://www.youtube.com/watch?v=VIDEO_ID`
- `https://youtu.be/VIDEO_ID`
- `https://www.youtube.com/embed/VIDEO_ID`
- `https://www.youtube.com/shorts/VIDEO_ID`
- `https://www.youtube.com/live/VIDEO_ID`
- `https://www.youtube.com/v/VIDEO_ID`
- Raw video ID (e.g. `dQw4w9WgXcQ`)

Tracking parameters (`?si=`, `&t=`, etc.) are stripped automatically.

## API Endpoints

| Method  | Path        | Description                                  |
|---------|-------------|----------------------------------------------|
| `GET`   | `/`         | Health check — returns server info and status |
| `GET`   | `/sse`      | SSE connection for MCP clients               |
| `POST`  | `/sse`      | Streamable HTTP transport for MCP messages   |

## Deploy Your Own

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- A [Cloudflare account](https://dash.cloudflare.com/sign-up)
- A [YouTube Data API v3 key](https://console.cloud.google.com/apis/credentials)

### Setup

```bash
git clone https://github.com/jeswinsjose/youtube-mcp-server.git
cd youtube-mcp-server
npm install
```

### Configure Secrets

For local development, copy the example file and add your key:

```bash
cp .dev.vars.example .dev.vars
# Edit .dev.vars and set YOUTUBE_API_KEY=your_key_here
```

For production, set the secret via Wrangler:

```bash
npx wrangler secret put YOUTUBE_API_KEY
```

### Local Development

```bash
npm run dev
```

The server runs at `http://localhost:8787`. Test the health check:

```bash
curl http://localhost:8787/
```

### Deploy to Cloudflare

```bash
npx wrangler login    # first time only
npm run deploy
```

Your server will be available at `https://youtube-mcp-server.<your-subdomain>.workers.dev`.

## Project Structure

```
youtube-mcp-server/
├── src/
│   ├── index.ts              # MCP server, tool definitions, fetch handler
│   └── youtube.ts            # YouTube Data API v3 utility functions
├── package.json
├── wrangler.toml             # Cloudflare Workers + Durable Objects config
├── tsconfig.json
├── worker-configuration.d.ts # Env type declarations
├── .dev.vars.example         # Template for local secrets
└── .gitignore
```

## Architecture

- **Runtime:** Cloudflare Workers (V8 isolates, no Node.js)
- **Transport:** `McpAgent` from Cloudflare's [Agents SDK](https://developers.cloudflare.com/agents/) — supports both SSE and Streamable HTTP with automatic negotiation
- **State:** Durable Objects with SQLite backing for per-session MCP state
- **Transcript fetching:** [`youtube-transcript`](https://www.npmjs.com/package/youtube-transcript) package (scrapes captions, no API key needed)
- **Video/search/channel/comments:** [YouTube Data API v3](https://developers.google.com/youtube/v3) (requires API key)

## Troubleshooting

**"Error fetching transcript"**
- The video may not have captions enabled
- Try a different language code
- Some videos have creator-disabled captions

**"YouTube API error (403)"**
- Your `YOUTUBE_API_KEY` may be missing or invalid
- Check your API quota in the [Google Cloud Console](https://console.cloud.google.com/apis/dashboard)

**Can't connect from Claude Desktop**
- Make sure you have `mcp-remote` available: `npx mcp-remote --version`
- Restart Claude Desktop after editing the config file
- Check the URL ends with `/sse`

**Can't connect from Claude.ai web**
- Verify the server is running: visit the `/` health check endpoint in your browser
- Ensure the URL ends with `/sse` in the integration settings

## License

MIT
