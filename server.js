const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const Database = require('better-sqlite3');

// Open the database file (created if missing) and set up the tables
const db = new Database('auction.db');
db.exec(`
  CREATE TABLE IF NOT EXISTS auction (
    id INTEGER PRIMARY KEY,
    item TEXT NOT NULL,
    highest_bid INTEGER NOT NULL,
    highest_bidder TEXT
  );
  CREATE TABLE IF NOT EXISTS bids (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bidder TEXT NOT NULL,
    amount INTEGER NOT NULL,
    time TEXT DEFAULT CURRENT_TIMESTAMP
  );
  INSERT OR IGNORE INTO auction VALUES (1, 'Vintage Guitar', 100, NULL);
`);

// Read the current auction and the last 10 bids from the database
function getState() {
  const auction = db.prepare('SELECT * FROM auction WHERE id = 1').get();
  const recentBids = db.prepare('SELECT * FROM bids ORDER BY id DESC LIMIT 10').all();
  return { type: 'state', auction, recentBids };
}

// Save the bid only if it is higher than the current highest bid
const placeBid = db.transaction((bidder, amount) => {
  const result = db
    .prepare('UPDATE auction SET highest_bid = ?, highest_bidder = ? WHERE id = 1 AND highest_bid < ?')
    .run(amount, bidder, amount);

  if (result.changes === 0) {
    return { ok: false, message: 'Bid too low' };
  }
  db.prepare('INSERT INTO bids (bidder, amount) VALUES (?, ?)').run(bidder, amount);
  return { ok: true, message: 'Bid accepted' };
});

// Check the bid is valid, then save it with the database locked
function tryBid(bidder, amount) {
  if (typeof bidder !== 'string' || !bidder.trim() || !Number.isSafeInteger(amount) || amount <= 0) {
    return { ok: false, message: 'Invalid bid' };
  }
  const result = placeBid.immediate(bidder.trim(), amount);
  if (result.ok) broadcast(getState());
  return result;
}

// HTTP server: serves the web page plus /state and /bid
const app = express();
app.use(express.json());
app.use(express.static('public'));

app.get('/state', (req, res) => res.json(getState()));
app.post('/bid', (req, res) => res.json(tryBid(req.body.bidder, req.body.amount)));

const server = http.createServer(app);

// WebSocket server for live updates
const wss = new WebSocketServer({ server });

// Send a message to every connected browser
function broadcast(data) {
  const message = JSON.stringify(data);
  for (const client of wss.clients) {
    if (client.readyState === client.OPEN) client.send(message);
  }
}

// A new or reconnecting browser gets the saved state right away
wss.on('connection', (ws) => {
  ws.send(JSON.stringify(getState()));

  ws.isAlive = true;
  ws.on('pong', () => (ws.isAlive = true));

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (msg.type === 'bid') {
      ws.send(JSON.stringify({ type: 'result', ...tryBid(msg.bidder, msg.amount) }));
    }
  });
});

// Every 30 seconds, drop connections that stopped responding
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
}, 30000);

server.listen(3000, () => console.log('Open http://localhost:3000'));
