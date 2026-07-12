# Twitch RSS Tracker

A lightweight TypeScript service that tracks Twitch channels and generates an RSS feed when they go live.
It polls Twitch's public GraphQL endpoint on an interval and records live and offline events into a feed.

The code is plain TypeScript run directly by Node's type stripping, so there is no build step.

## Prerequisites

- [Node.js](https://nodejs.org/) 24 or newer, which is what enables running `.ts` files without a build.
- [pnpm](https://pnpm.io/) as the package manager.

## Local development

Install the dependencies once.

```bash
pnpm install
```

Then run the server, optionally in watch mode while you work.

```bash
pnpm start
pnpm dev
```

The full check suite mirrors what CI runs.

```bash
pnpm lint && pnpm fmt:check && pnpm typecheck && pnpm test
```

## Docker

Build the image and run it, mounting `data/` if you want channel changes to persist across restarts.

```bash
docker build -t twitch-tracker .
docker run -p 3000:3000 -v "$(pwd)/data:/app/data" twitch-tracker
```

## Configuration

The service reads two environment variables.

| Variable   | Default | Description                     |
| :--------- | :------ | :------------------------------ |
| `PORT`     | `3000`  | The port the server listens on. |
| `RSS_PATH` | `/rss`  | The URL path for the RSS feed.  |

## Usage

The RSS feed is served at `http://localhost:3000/rss`, or whatever `RSS_PATH` you set.
Tracked channels live in `data/channels.json`, which you can edit directly to add or remove channels.
