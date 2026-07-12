import * as store from "./store.ts";

const CLIENT_ID = "kimne78kx3ncx6brgo4mv6wki5h1ko";
const GQL_URL = "https://gql.twitch.tv/gql";

interface GqlResponse {
  errors?: unknown;
  data?: {
    user?: {
      stream?: {
        id?: string;
        title?: string;
        createdAt?: string;
      } | null;
    } | null;
  };
}

type ChannelStatus =
  | {
      name: string;
      id: string;
      title: string;
      startTime?: string;
      link: string;
      isLive: true;
    }
  | { name: string; isLive: false };

interface StreamSession {
  id: string;
  startTime: Date;
}

interface RssItem {
  title: string;
  channel: string;
  guid: string;
  link: string;
  description: string;
  pubDate: string;
}

let rssHistory: RssItem[] = [];
const activeStreams = new Map<string, StreamSession>();

async function checkChannel(channelName: string): Promise<ChannelStatus | null> {
  const query = `query { user(login: "${channelName}") { stream { id title createdAt } } }`;

  try {
    const response = await fetch(GQL_URL, {
      method: "POST",
      headers: {
        "Client-ID": CLIENT_ID,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      return null;
    }

    const json = (await response.json()) as GqlResponse;
    if (json.errors) {
      return null;
    }

    const stream = json.data?.user?.stream;

    if (stream && stream.id) {
      return {
        name: channelName,
        id: stream.id,
        title: stream.title || "No Title",
        startTime: stream.createdAt,
        link: `https://www.twitch.tv/${channelName}`,
        isLive: true,
      };
    }

    return { name: channelName, isLive: false };
  } catch (error) {
    console.error(`Error checking ${channelName}:`, error);
    return null;
  }
}

export async function updateFeeds(): Promise<void> {
  const channels = store.getChannels();
  const now = new Date();

  const results = await Promise.all(channels.map(checkChannel));

  for (const status of results) {
    if (!status) continue;

    const lastSession = activeStreams.get(status.name);

    if (status.isLive) {
      if (!lastSession || lastSession.id !== status.id) {
        const startTime = status.startTime ? new Date(status.startTime) : now;

        activeStreams.set(status.name, { id: status.id, startTime });

        console.log(`[${now.toISOString()}] ${status.name} went live`);

        rssHistory.unshift({
          title: `LIVE: ${status.name} - ${status.title}`,
          channel: status.name,
          guid: `twitch:${status.name}:${status.id}`,
          link: status.link,
          description: `<p><strong>${status.name}</strong> is live playing: ${status.title}</p>`,
          pubDate: startTime.toUTCString(),
        });
      }
    } else if (lastSession) {
      const durationMs = now.getTime() - lastSession.startTime.getTime();
      const hours = Math.floor(durationMs / 3600000);
      const minutes = Math.floor((durationMs % 3600000) / 60000);
      const durationStr = `${hours}h ${minutes}m`;

      console.log(`[${now.toISOString()}] ${status.name} went offline (Duration: ${durationStr})`);

      rssHistory.unshift({
        title: `OFFLINE: ${status.name} (Streamed for ${durationStr})`,
        channel: status.name,
        guid: `twitch:${status.name}:offline:${now.getTime()}`,
        link: `https://www.twitch.tv/${status.name}`,
        description: `<p>${status.name} has gone offline.</p><p>Total stream duration: ${durationStr}</p>`,
        pubDate: now.toUTCString(),
      });

      activeStreams.delete(status.name);
    }
  }

  if (rssHistory.length > 50) {
    rssHistory = rssHistory.slice(0, 50);
  }
}

export function startTracking(intervalMinutes = 2): void {
  console.log(`Starting Twitch tracker (poll every ${intervalMinutes} mins)...`);
  void updateFeeds();
  setInterval(() => void updateFeeds(), intervalMinutes * 60 * 1000);
}

export function generateRSS(selfLink?: string): string {
  const now = new Date().toUTCString();
  const atomLink = selfLink
    ? `\n  <atom:link href="${selfLink}" rel="self" type="application/rss+xml" />`
    : "";

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>Twitch Live Status</title>
  <link>https://www.twitch.tv/</link>
  <description>Live status feed for tracked Twitch channels</description>${atomLink}
  <lastBuildDate>${now}</lastBuildDate>
  <language>en-US</language>
`;

  for (const item of rssHistory) {
    const safeTitle = item.title.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    xml += `
  <item>
    <title>${safeTitle}</title>
    <guid isPermaLink="false">${item.guid}</guid>
    <link>${item.link}</link>
    <description><![CDATA[${item.description}]]></description>
    <pubDate>${item.pubDate}</pubDate>
  </item>`;
  }

  xml += `
</channel>
</rss>`;

  return xml;
}
