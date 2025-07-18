import cron from "node-cron";
import { CronController } from "../../controllers/cronController";




console.log("🕒 Registering cron job to run every 6 hours...");
cron.schedule("0 */6 * * *", async () => {
    const runTime = new Date().toISOString();
    console.log(`⏰ Cron job started at ${runTime}`);
    await CronController.getAllInstance();
});


console.log("🕒 Registering cron job to run every day at 2 AM...");
// // Runs every day at 2 AM
cron.schedule("0 2 * * *", async () => {
    const runTime = new Date().toLocaleString();
    console.log(`⏰ Cron job started at ${runTime}`);
    await CronController.getAllAgentStatus();
});


console.log("🕒 Registering cron job to run every hour...");
cron.schedule('0 * * * *', async () => {
    try {
        await CronController.getAllAgentStatusAndUploadtoS3();
    } catch (err) {
        console.error('Cron job failed:', err);
    }
});

// // 🧪 Run once immediately for testing
// (async () => {
    // console.log("🧪 Running cron job immediately for testing at", new Date().toLocaleString());
    // await CronController.getAllAgentStatusAndUploadtoS3();
    // await CronController.getAllInstance();
    // await CronController.getAllAgentStatus();
// })();


// // Catch any unhandled errors that may prevent the cron job from running
process.on("uncaughtException", (error) => {
    console.error("❌ Uncaught error in cron job:", error);
});

process.on("unhandledRejection", (reason, promise) => {
    console.error("❌ Unhandled rejection in cron job:", reason);
});

process.on("uncaughtException", (error) => {
    console.error("❌ Uncaught error in cron job:", error);
    console.log("Trying to run the cron job again...");
    cron.schedule("0 1 * * *", async () => {
        await CronController.getAllInstance();
    });
});

process.on("unhandledRejection", (reason, promise) => {
    console.error("❌ Unhandled rejection in cron job:", reason);
    console.log("Trying to run the cron job again...");
    cron.schedule("0 2 * * *", async () => {
        await CronController.getAllAgentStatus();
    });
});
