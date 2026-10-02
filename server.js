// รอดในป่าลึก - เซิร์ฟเวอร์เชื่อมต่อผู้เล่นร่วมกัน (WebSocket relay)
// รันด้วย: node server.js
const http = require('http');
const WebSocket = require('ws');

const server = http.createServer((req, res) => {
  res.writeHead(200, {'Content-Type': 'text/plain; charset=utf-8'});
  res.end('รอดในป่าลึก - เซิร์ฟเวอร์ทำงานปกติ (' + Object.keys(rooms).length + ' ห้องออนไลน์)');
});

const wss = new WebSocket.Server({ server });
const rooms = {}; // roomCode -> Set of ws clients

function broadcast(room, exceptWs, msg) {
  const set = rooms[room];
  if (!set) return;
  const data = JSON.stringify(msg);
  for (const client of set) {
    if (client !== exceptWs && client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

let nextId = 1;

wss.on('connection', (ws) => {
  ws.id = nextId++;
  ws.room = null;

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch (e) { return; }
    if (!msg || !msg.t) return;

    if (msg.t === 'join') {
      ws.room = String(msg.room || '').slice(0, 40);
      ws.name = String(msg.name || 'player').slice(0, 40);
      if (!ws.room) return;
      if (!rooms[ws.room]) rooms[ws.room] = new Set();
      rooms[ws.room].add(ws);
      ws.send(JSON.stringify({ t: 'joined', id: ws.id }));
      broadcast(ws.room, ws, { t: 'peer-join', id: ws.id, name: ws.name });
      return;
    }

    if (!ws.room) return;

    if (msg.t === 'presence') {
      broadcast(ws.room, ws, { t: 'peer', id: ws.id, data: msg.data });
    } else if (msg.t === 'sync') {
      broadcast(ws.room, ws, { t: 'sync', data: msg.data });
    } else if (msg.t === 'dmg') {
      broadcast(ws.room, ws, { t: 'dmg', data: msg.data });
    }
  });

  ws.on('close', () => {
    if (ws.room && rooms[ws.room]) {
      rooms[ws.room].delete(ws);
      broadcast(ws.room, ws, { t: 'peer-leave', id: ws.id });
      if (rooms[ws.room].size === 0) delete rooms[ws.room];
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Co-op relay server running on port ' + PORT));
