const express = require("express");
const router = express.Router();

const tracker = require("./tracker");

const rssPath = process.env.RSS_PATH || "/rss";
router.get(rssPath, async (req, res) => {
  try {
    const protocol = req.protocol;
    const host = req.get("host");
    const selfLink = `${protocol}://${host}${req.originalUrl}`;
    const xml = await tracker.generateRSS(selfLink);
    res.set("Content-Type", "application/rss+xml");
    res.send(xml);
  } catch (error) {
    console.error("RSS Error:", error);
    res.status(500).send("Error generating RSS feed");
  }
});

module.exports = router;
