import mongoose from 'mongoose';
import { IServer } from '../lib/interfaces';
import dotenv from 'dotenv';
import { CONFIG } from './environment';
import fs from 'fs';
import path from 'path';
dotenv.config();

// DocumentDB connection options
const connectOptions: mongoose.ConnectOptions = {
    tls: true, // Enable TLS/SSL
    tlsCAFile: path.join(__dirname, '../../global-bundle.pem'), // Path to Amazon CA Bundle
    retryWrites: false, // DocumentDB doesn't support retryable writes
    directConnection: false, // Use replica set connection
};

export class DB {
    static async connect(server?: IServer): Promise<void> {
        try {
            console.log("🔌 Connecting to Amazon DocumentDB...");

            // Check if CA bundle exists
            const caPath = path.join(__dirname, '../../global-bundle.pem');
            if (!fs.existsSync(caPath)) {
                console.warn(`⚠️  CA Bundle not found at ${caPath}`);
                console.warn("⚠️  Attempting connection without SSL verification (NOT RECOMMENDED for production)");

                // Fallback options without CA bundle (less secure)
                const fallbackOptions: mongoose.ConnectOptions = {
                    tls: true,
                    tlsAllowInvalidCertificates: true, // Only for development
                    retryWrites: false,
                };

                await mongoose.connect(CONFIG.DB_CONNECTION_STRING!, fallbackOptions);
            } else {
                await mongoose.connect(CONFIG.DB_CONNECTION_STRING!, connectOptions);
            }

            if (server) {
                server.isDbConnected = true;
            }

            console.log('✅ Connected to Amazon DocumentDB');
        } catch (error) {
            console.error("❌ DB connection error:", error);
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