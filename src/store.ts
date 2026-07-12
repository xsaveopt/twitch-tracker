import fs from "node:fs";
import path from "node:path";

const DATA_FILE = path.join(import.meta.dirname, "../data/channels.json");
const DATA_DIR = path.dirname(DATA_FILE);

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(["xqc", "erobb221", "zoil"]));
}

export function getChannels(): string[] {
  try {
    const data = fs.readFileSync(DATA_FILE, "utf8");
    return JSON.parse(data) as string[];
  } catch (err) {
    console.error("Error reading channels:", err);
    return [];
  }
}

export function addChannel(channel: string): void {
  const channels = getChannels();
  if (!channels.includes(channel)) {
    channels.push(channel);
    fs.writeFileSync(DATA_FILE, JSON.stringify(channels, null, 2));
  }
}

export function removeChannel(channel: string): void {
  const channels = getChannels().filter((c) => c !== channel);
  fs.writeFileSync(DATA_FILE, JSON.stringify(channels, null, 2));
}
