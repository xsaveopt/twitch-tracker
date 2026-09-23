import { Router } from "express";
import type { Request, Response } from "express";
import * as tracker from "./tracker.ts";

const router = Router();

export function healthPathFor(rssPath: string): string {
  const normalized = rssPath.replace(/\/+$/, "");
  return normalized === "" ? "/health" : `${normalized}/health`;
}

const rssPath = process.env.RSS_PATH || "/rss";
export const healthPath = healthPathFor(rssPath);

router.get(healthPath, (_req: Request, res: Response) => {
  const healthy = tracker.isHealthy();
  res
    .status(healthy ? 200 : 503)
    .type("text/plain")
    .send(healthy ? "up" : "degraded");
});

router.get(rssPath, async (req: Request, res: Response) => {
  try {
    const protocol = req.protocol;
    const host = req.get("host");
    const selfLink = `${protocol}://${host}${req.originalUrl}`;
    const xml = tracker.generateRSS(selfLink);
    res.set("Content-Type", "application/rss+xml");
    res.send(xml);
  } catch (error) {
    console.error("RSS Error:", error);
    res.status(500).send("Error generating RSS feed");
  }
});

export default router;
