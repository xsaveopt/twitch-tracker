import express from "express";
import routes from "./routes.ts";
import * as tracker from "./tracker.ts";

const app = express();
const port = process.env.PORT || 3000;

tracker.startTracking(2);

app.use("/", routes);

app.listen(port, () => {
  const rssPath = process.env.RSS_PATH || "/rss";
  console.log(`Server listening on port ${port}`);
  console.log(`RSS Feed available at http://localhost:${port}${rssPath}`);
});
