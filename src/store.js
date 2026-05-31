const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../data/channels.json');
const DATA_DIR = path.dirname(DATA_FILE);

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(["xqc", "erobb221", "zoil"]));
}

function getChannels() {
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error("Error reading channels:", err);
    return [];
  }
}

function addChannel(channel) {
  const channels = getChannels();
  if (!channels.includes(channel)) {
    channels.push(channel);
    fs.writeFileSync(DATA_FILE, JSON.stringify(channels, null, 2));
  }
}

function removeChannel(channel) {
  let channels = getChannels();
  channels = channels.filter(c => c !== channel);
  fs.writeFileSync(DATA_FILE, JSON.stringify(channels, null, 2));
}

module.exports = {
  getChannels,
  addChannel,
  removeChannel
};
