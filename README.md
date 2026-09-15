# Twitch Tracker

Twitch Tracker watches a list of Twitch channels and turns their live and offline changes into an RSS feed.
Every two minutes it asks Twitch's public GraphQL endpoint whether each channel is streaming, adds an item when a channel goes live, and adds another with the stream duration when it goes offline.
The feed keeps the latest 50 items in memory, so it starts empty again after a restart.

## Running it

The server is plain TypeScript run directly by Node 26, with pnpm as the package manager.

```sh
pnpm install
pnpm start
```

The feed is then served at /rss on port 3000.
Running pnpm dev restarts the server whenever a file changes, and CI runs these checks:

```sh
pnpm lint && pnpm fmt:check && pnpm typecheck && pnpm test
```

## Docker

Tagged releases publish an image to ghcr.io/xsaveopt/twitch-tracker, and every push to main updates the dev tag.
To build one yourself, mount /app/data to keep the channel list across restarts.
The container runs as the node user, so the mounted folder has to be writable by uid 1000.

```sh
docker build -t twitch-tracker .
docker run -p 3000:3000 -v "$(pwd)/data:/app/data" twitch-tracker
```

## Configuration

Tracked channels live in data/channels.json as a JSON array of login names.
The file is created with a few sample channels on first start, and it is read again on every poll, so edits take effect at the next check.

| Variable   | Default | Description                    |
| :--------- | :------ | :----------------------------- |
| `PORT`     | `3000`  | Port the server listens on     |
| `RSS_PATH` | `/rss`  | URL path the feed is served at |

## License

Twitch Tracker is licensed under the GPL-2.0, see LICENSE.
