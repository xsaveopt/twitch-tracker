const store = require("./store");

const CLIENT_ID = "kimne78kx3ncx6brgo4mv6wki5h1ko";
const GQL_URL = "https://gql.twitch.tv/gql";

let rssHistory = [];
let activeStreams = new Map();

async function checkChannel(channelName) {
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

    const json = await response.json();
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

async function updateFeeds() {
  const channels = store.getChannels();
  const now = new Date();

  const results = await Promise.all(channels.map(checkChannel));

  results.forEach((status) => {
    if (!status) return;

    const lastSession = activeStreams.get(status.name);

    if (status.isLive) {
      if (!lastSession || lastSession.id !== status.id) {
        const startTime = status.startTime ? new Date(status.startTime) : now;

        activeStreams.set(status.name, { id: status.id, startTime });

        console.log(`[${now.toISOString()}] ${status.name} went live`);

        const item = {
          title: `LIVE: ${status.name} - ${status.title}`,
          channel: status.name,
          guid: `twitch:${status.name}:${status.id}`,
          link: status.link,
          description: `<p><strong>${status.name}</strong> is live playing: ${status.title}</p>`,
          pubDate: startTime.toUTCString(),
        };

        rssHistory.unshift(item);
      }
    } else {
      if (lastSession) {
        const durationMs = now - lastSession.startTime;
        const hours = Math.floor(durationMs / 3600000);
        const minutes = Math.floor((durationMs % 3600000) / 60000);
        const durationStr = `${hours}h ${minutes}m`;

        console.log(
          `[${now.toISOString()}] ${status.name} went offline (Duration: ${durationStr})`,
        );

        const item = {
          title: `OFFLINE: ${status.name} (Streamed for ${durationStr})`,
          channel: status.name,
          guid: `twitch:${status.name}:offline:${now.getTime()}`,
          link: `https://www.twitch.tv/${status.name}`,
          description: `<p>${status.name} has gone offline.</p><p>Total stream duration: ${durationStr}</p>`,
          pubDate: now.toUTCString(),
        };

        rssHistory.unshift(item);

        activeStreams.delete(status.name);
      }
    }
  });

  if (rssHistory.length > 50) {
    rssHistory = rssHistory.slice(0, 50);
  }
}

function startTracking(intervalMinutes = 2) {
  console.log(
    `Starting Twitch tracker (poll every ${intervalMinutes} mins)...`,
  );
  updateFeeds();
  setInterval(updateFeeds, intervalMinutes * 60 * 1000);
}

function generateRSS(selfLink) {
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

  rssHistory.forEach((item) => {
    const safeTitle = item.title
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    xml += `
  <item>
    <title>${safeTitle}</title>
    <guid isPermaLink="false">${item.guid}</guid>
    <link>${item.link}</link>
    <description><![CDATA[${item.description}]]></description>
    <pubDate>${item.pubDate}</pubDate>
  </item>`;
  });

  xml += `
</channel>
</rss>`;

  return xml;
}

module.exports = { generateRSS, startTracking, updateFeeds };
