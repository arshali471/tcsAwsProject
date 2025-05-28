import express from "express";
import { AWSKeyService, EC2InstanceService } from "../services";

export class CronController {
    // static async getAllInstance(req?: express.Request, res?: express.Response, next?: express.NextFunction) {
    //     try {
    //         const awsConfig: any = await AWSKeyService.getAllAWSKeyId();
    //         console.log("starting cron job to fetch instance data...");

    //         for (let key of awsConfig) {
    //             const keyId = key._id;
    //             const environment = String(key.enviroment);

    //             const data = await EC2InstanceService.getAllInstanceDetails(keyId);
    //             const enviromentData = data.map((item: any) => ({
    //                 ...item,
    //                 environment: environment,
    //             }));

    //             const saveData = await EC2InstanceService.saveInstanceDetails(enviromentData, environment);
    //             if (!saveData) {
    //                 console.error(`❌ Error saving data for environment: ${environment}`);
    //                 if (res) return res.status(500).json({ message: "Error saving data to DB" });
    //             } else {
    //                 console.log(`✅ Data saved for environment: ${environment}`);
    //             }

    //             // Wait for 5 minutes (300,000 milliseconds)
    //             await new Promise(resolve => setTimeout(resolve, 2 * 60 * 1000));
    //         }

    //         if (res) {
    //             return res.status(200).json({
    //                 message: "Instance Data fetched from AWS and saved to DB",
    //             });
    //         }

    //     } catch (err) {
    //         console.error("❌ Error in CronController.getAllInstance:", err);
    //         if (next) next(err);
    //     }
    // }

    static async getAllInstance(req?: express.Request, res?: express.Response, next?: express.NextFunction) {
        try {
            const awsConfig: any = await AWSKeyService.getAllAWSKeyId();
            console.log("🕒 Starting cron job to fetch instance data...");

            for (const key of awsConfig) {
                const keyId = key._id;
                const environment = String(key.enviroment);
                console.log(environment, keyId, "keyId");

                const data = await EC2InstanceService.getAllInstanceDetails(keyId);
                const environmentData = data.map((item: any) => ({
                    ...item,
                    environment,
                }));

                const saveData = await EC2InstanceService.saveInstanceDetails(environmentData, environment);

                if (!saveData) {
                    console.error(`❌ Error saving data for environment: ${environment}`);
                    if (res) return res.status(500).json({ message: "Error saving data to DB" });
                } else {
                    console.log(`✅ ${saveData.length} records saved for environment: ${environment}`);
                }

                // Wait for 2 minutes before next environment
                await new Promise(resolve => setTimeout(resolve, 2 * 60 * 1000));
            }

            if (res) {
                return res.status(200).json({
                    message: "Instance data fetched from AWS and saved to DB successfully.",
                });
            }

        } catch (err) {
            console.error("❌ Error in CronController.getAllInstance:", err);
            if (next) next(err);
        }
    }
}
