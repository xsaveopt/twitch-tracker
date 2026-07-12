import { Router } from "express";
import type { Request, Response } from "express";
import * as tracker from "./tracker.ts";

const router = Router();

const rssPath = process.env.RSS_PATH || "/rss";

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
