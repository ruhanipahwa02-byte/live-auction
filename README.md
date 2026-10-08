# Live Auction

## Run
```
npm install
npm start
```
Open http://localhost:3000 in two browser tabs and bid from both.

Test simultaneous bids (with the server running): `npm test`

To start the auction over, stop the server and delete `auction.db`.

## Files
- `server.js` – the backend: database, bidding logic, WebSocket updates
- `public/index.html` – the web page bidders use
- `race-test.js` – sends 50 bids at the same time and checks the highest one wins

## How it works
- **Live updates:** WebSockets. When a bid is accepted, the server sends the new state to every connected browser.
- **Simultaneous bids:** Each bid runs in a database transaction with
  `UPDATE ... WHERE highest_bid < newAmount`. The database checks bids one at a time,
  so the highest bid wins and lower ones are rejected.
- **Saved state:** Everything is stored in SQLite (`auction.db`). Refreshing the page
  or restarting the server shows the correct highest bid.
- **Disconnects:** The browser reconnects automatically and gets the latest state from
  the database. A disconnect can't break anything because no shared data is kept in
  the connection.

## "Node runs one thing at a time, so why do you need a transaction?"
In this single server, Node does handle one bid at a time. But the check
("is this bid higher?") is done by the database, inside a locked transaction,
not in JavaScript. So it stays correct even if two copies of the server share
the same `auction.db`. Without the lock, both could read the old highest bid and both
accept, and the last one saved would win.
