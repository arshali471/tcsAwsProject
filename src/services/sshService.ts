import { Server as WebSocketServer } from 'ws';
import { Client } from 'ssh2';

export class SshService {
  static sessions: Record<string, { ip: string, username: string, sshKey: string }> = {};

  static async setupWebSocket(server: any) {
    const wss = new WebSocketServer({ noServer: true });
    server.on('upgrade', (request: any, socket: any, head: any) => {
      wss.handleUpgrade(request, socket, head, (ws) => {
        ws.once('message', (message: any) => {
          const { sessionId } = JSON.parse(message.toString());
          console.log('Received sessionId:', sessionId);
          console.log('Available sessions:', SshService.sessions);

          const session = SshService.sessions[sessionId];
          if (!session) {
            ws.send(JSON.stringify({ error: 'Session not found' }));
            return ws.close();
          }

          const { ip, username, sshKey } = session;
          const conn = new Client();
          conn.on('ready', () => {
            conn.shell((err: any, stream: any) => {
              if (err) return ws.close();
              ws.on('message', (msg: any) => stream.write(msg.toString()));
              stream.on('data', (data: any) => ws.send(data));
              stream.on('close', () => {
                conn.end();
                ws.close();
              });
            });
          }).on('error', (err) => {
            ws.send(`SSH connection error: ${err.message}`);
            ws.close();
          }).connect({ host: ip, username, privateKey: sshKey });
        });
      });
    });
  }

  static async createSession({ ip, username, sshKey }: { ip: string, username: string, sshKey: string }) {
    const sessionId = Date.now().toString();
    SshService.sessions[sessionId] = { ip, username, sshKey };
    console.log('Session created:', sessionId);
    return sessionId;
  }
}
