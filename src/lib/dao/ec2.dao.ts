import ec2Model from "../../models/ec2.model";
import moment from "moment";



export class EC2Dao {
    // static async saveInstancesDetails(instances: any[], environment: string) {
    //     if (!instances || instances.length === 0) return;

    //     const bulkOperations = await Promise.all(
    //         instances.map(async (instance) => {
    //             const todayStart = moment().startOf("day").toDate();
    //             const todayEnd = moment().endOf("day").toDate();

    //             const existingRecord = await ec2Model.findOne({
    //                 InstanceId: instance.InstanceId,
    //                 createdAt: { $gte: todayStart, $lte: todayEnd } // Check if createdAt is today
    //             });

    //             if (existingRecord) {
    //                 // Update existing record for today
    //                 return {
    //                     updateOne: {
    //                         filter: { InstanceId: instance.InstanceId },
    //                         update: { $set: instance },
    //                         upsert: false
    //                     }
    //                 };
    //             } else {
    //                 // Create a new record for a different day
    //                 return {
    //                     insertOne: {
    //                         document: { ...instance, InstanceId: instance.InstanceId, createdAt: new Date() }
    //                     }
    //                 };
    //             }
    //         })
    //     );

    //     await ec2Model.bulkWrite(bulkOperations.filter(op => op !== null));
    //     return await ec2Model.find({ createdAt: { $gte: moment().startOf("day").toDate(), $lte: moment().endOf("day").toDate() }, environment });
    // }

    // static async saveInstanceDetails(instances: any[], environment: string) {
    //     if (!instances || instances.length === 0) return [];

    //     const bulkOperations = await Promise.all(
    //         instances.map(async (instance) => {
    //             try {
    //                 const todayStart = moment().startOf("day").toDate();
    //                 const todayEnd = moment().endOf("day").toDate();

    //                 const existingRecord = await ec2Model.findOne({
    //                     InstanceId: instance.InstanceId,
    //                     createdAt: { $gte: todayStart, $lte: todayEnd }
    //                 });

    //                 const doc = { ...instance, InstanceId: instance.InstanceId, environment, createdAt: new Date() };

    //                 if (existingRecord) {
    //                     return {
    //                         updateOne: {
    //                             filter: { InstanceId: instance.InstanceId },
    //                             update: { $set: doc },
    //                             upsert: false
    //                         }
    //                     };
    //                 } else {
    //                     return {
    //                         insertOne: {
    //                             document: doc
    //                         }
    //                     };
    //                 }
    //             } catch (err: any) {
    //                 console.error(`⚠️ Skipping instance ${instance.InstanceId} due to error:`, err.message);
    //                 return null;
    //             }
    //         })
    //     );

    //     const operations = bulkOperations.filter(op => op !== null);
    //     if (operations.length === 0) return [];

    //     await ec2Model.bulkWrite(operations);

    //     // Return today's saved data for validation/logging
    //     return await ec2Model.find({
    //         createdAt: { $gte: moment().startOf("day").toDate(), $lte: moment().endOf("day").toDate() },
    //         environment
    //     }).lean();
    // }

    static async saveInstanceDetails(instances: any[], environment: string) {
        if (!instances || instances.length === 0) return [];
        return await ec2Model.create(instances)
    }


    static async getInstancesByDate(date: string, enviroment: string) {
        // Convert provided date to UTC start & end of day timestamps
        const startOfDay = moment.utc(date, "YYYY-MM-DD").startOf("day").toDate();
        const endOfDay = moment.utc(date, "YYYY-MM-DD").endOf("day").toDate();

        // console.log("Querying records between:", startOfDay, "and", endOfDay);

        // Query records that have createdAt within the given UTC date range
        return await ec2Model.find({
            createdAt: { $gte: startOfDay, $lte: endOfDay },
            environment:  { $eq: enviroment }
        });
    }

}