import { Server } from "./server";
import http from "http";
import { normalizePort, onError } from "./serverHandler";
import fs from 'fs';
import { CONFIG }  from "./config/environment";

const SERVER = new Server();

const PORT =   normalizePort(process.env.PORT || 3000);

SERVER.app.set("post", PORT);

let server = http.createServer(SERVER.app);

server.listen(PORT);

// server handler
server.on("error", error => onError(error, PORT));

server.on("listening", () => {
    const addr: any = server.address();
    const bind: string = (typeof addr === 'string') ? `pipe ${addr}` : `port ${addr.port}`;

    console.log(`Listening on ${bind}`);    
});

// Create uploads folder if does not exits
console.log(CONFIG.uploadsFolderPath, "CONFIG.uploadFolderPath");

if (!fs.existsSync(CONFIG.uploadsFolderPath)) {
    fs.mkdir(CONFIG.uploadsFolderPath, () => {
        console.log("upload folder created");
    })
} else {
    console.log("Uploads folders exists");
}