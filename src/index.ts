import { Server } from "./server";
import http from "http";
import { normalizePort, onError } from "./serverHandler";
import fs from 'fs';
import { CONFIG } from "./config/environment";
import "./services/cronJob/fetchInstance.cron";
import { AzureAdService } from "./services/azureAdService";
import { initSessionCleanupCron } from "./cron/sessionCleanupCron";

import { Client } from "ssh2";
import { WebSocketServer } from "ws";

const SERVER = new Server();
const PORT = normalizePort(process.env.PORT || 3000);
SERVER.app.set("post", PORT);

// Validate Azure AD configuration
AzureAdService.validateConfig();

// Initialize session cleanup cron jobs
initSessionCleanupCron();

const server = http.createServer(SERVER.app);

// -------------------------
// WebSocket SSH Bridge START
// -------------------------
const wss = new WebSocketServer({ server });

wss.on("connection", ws => {
  console.log("[WS] New connection");
  let sshStream: any;
  let conn: Client;

  ws.on("message", raw => {
    // First JSON message: handshake with credentials and size
    if (!sshStream) {
      let msg: any;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        ws.send("Invalid handshake");
        return ws.close();
      }

      const { ip, username, sshKey, cols = 80, rows = 24 } = msg;
      console.log(`[WS] Handshake ip=${ip}, user=${username}, size=${cols}×${rows}`);

      conn = new Client();
      conn
        .on("ready", () => {
          console.log("[WS] SSH connected, requesting PTY");
          conn.shell(
            {
              term: 'xterm-256color',
              cols,
              rows,
              modes: {
                ECHO: 1,
                TTY_OP_ISPEED: 14400,
                TTY_OP_OSPEED: 14400
              }
            },
            (err, stream) => {
              if (err) {
                ws.send("SSH Error: " + err.message);
                return ws.close();
              }
              sshStream = stream;
              // Send newline to trigger prompt
              stream.write('\n');

              // Forward SSH output to browser
              stream.on('data', (d: Buffer) => ws.send(d));
              stream.stderr.on('data', (d: Buffer) => ws.send(d));
              stream.on('close', () => {
                conn.end();
                ws.close();
              });
            }
          );
        })
        .on("error", err => {
          console.error("[WS] SSH connection error", err);
          ws.send("SSH Error: " + err.message);
          ws.close();
        })
        .connect({ host: ip, username, privateKey: sshKey });
      return;
    }

    // Subsequent messages: user keystrokes or resize commands
    if (sshStream) {
      // Try parse resize
      try {
        const obj = JSON.parse(raw.toString());
        if (obj.resize && sshStream.setWindow) {
          const { cols, rows } = obj;
          console.log(`[WS] Resize PTY to ${cols}×${rows}`);
          sshStream.setWindow(rows, cols, rows * 16, cols * 8);
          return;
        }
      } catch {}
      // Otherwise, raw keystroke
      sshStream.write(raw);
    }
  });

  ws.on('close', () => {
    if (conn) conn.end();
  });
});
// -------------------------
// WebSocket SSH Bridge END
// -------------------------

server.listen(PORT);
server.on("error", error => onError(error, PORT));
server.on("listening", () => {
  const addr: any = server.address();
  console.log(`Listening on ${typeof addr === 'string' ? addr : addr.port}`);
});

// Ensure required folders exist
[CONFIG.uploadsFolderPath, CONFIG.agentStatusFolderPath].forEach(path => {
  if (!fs.existsSync(path)) {
    fs.mkdirSync(path);
    console.log("Created folder:", path);
  } else {
    console.log("Folder exists:", path);
  }
});
