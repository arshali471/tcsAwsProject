import mongoose from 'mongoose';
import { IServer } from '../lib/interfaces';
import dotenv from 'dotenv';
import { CONFIG } from './environment';
dotenv.config();

interface connectOptions {
    autoReconnect: boolean;
    loggerLevel?: string;
    reconnectTries: number; // Never stop trying to reconnect
    reconnectInterval: number;
    useNewUrlParser: Boolean;
};

// Mongoose 8 removed these options as they are now defaults
const connectOptions = {};


export class DB {
    static async connect(server?: IServer) {
        try {
            console.log("Connecting to DB");
            await mongoose.connect(
                CONFIG.DB_CONNECTION_STRING!, 
                connectOptions
            );
            if (server) {
                server.isDbConnected = true;                
            }
            console.log('Connected to DB');            
        }
        catch (error) {
            throw error;
        }
    }
}


// import mongoose from 'mongoose';
// import fs from 'fs';
// import dotenv from 'dotenv';
// import { CONFIG } from './environment';
// import { IServer } from '../lib/interfaces';

// dotenv.config();

// const connectOptions: mongoose.ConnectOptions = {
//   useNewUrlParser: true,
//   useUnifiedTopology: true,
//   ssl: true,
//   sslCA: [fs.readFileSync('global-bundle.pem')], // ✅ Amazon CA Bundle
// };

// export class DB {
//   static async connect(server?: IServer): Promise<void> {
//     try {
//       console.log("🔌 Connecting to Amazon DocumentDB...");
//       await mongoose.connect(CONFIG.DB_CONNECTION_STRING!, connectOptions);
//       console.log("✅ Connected to Amazon DocumentDB");

//       if (server) {
//         server.isDbConnected = true;
//       }
//     } catch (error) {
//       console.error("❌ DB connection error:", error);
//       throw error;
//     }
//   }
// }