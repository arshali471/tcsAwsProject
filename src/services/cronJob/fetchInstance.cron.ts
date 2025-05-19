import cron from "node-cron";
import { CronController } from "../../controllers/cronController";

console.log("🕒 Registering cron job to run every day at 1 AM...");

// Runs every day at 1 AM
cron.schedule("0 1 * * *", async () => {
    const runTime = new Date().toLocaleString();
    console.log(`⏰ Cron job started at ${runTime}`);
    await CronController.getAllInstance();
});

// 🧪 Run once immediately for testing
// (async () => {
//     console.log("🧪 Running cron job immediately for testing at", new Date().toLocaleString());
//     await CronController.getAllInstance();
// })();
