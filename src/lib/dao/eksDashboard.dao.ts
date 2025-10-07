import awsKeysModel from "../../models/awsKeys.model";
import eksDashboardModel from "../../models/eksDashboard.model";
import mongoose from 'mongoose';

export class EksDashboardDao {
    // static async createEksToken(payload: any) {
    //     const { clusterName } = payload;

    //     return await eksDashboardModel.findOneAndUpdate(
    //         { clusterName },
    //         payload,
    //         { new: true, upsert: true } // upsert: create if not exists, new: return the updated doc
    //     );
    // }

    static async createEksToken(payload: any) {
        return await eksDashboardModel.create(payload);
    }

    static async getEKSToken(clusterName: string, awsKeyId: any) {
        return await eksDashboardModel.findOne({ clusterName, awsKeyId });
    }
    static async updateEKSToken(id: any, payload: any) {
        return await eksDashboardModel.findByIdAndUpdate(
            { _id: id },
            { $set: payload },
            { new: true }
        );
    }

    static async deleteEKSToken(id: any) {
        return await eksDashboardModel.findByIdAndDelete(id);
    }

    static async getEKSTokenById(id: any) {
        return await eksDashboardModel.findById(id);
    }

    static async getEKSTokenByAWSKey(keyId: any) {
        return await eksDashboardModel.find({ awsKeyId: keyId });
    }



    static async getAllEKSToken(search: any, skip: number, limit: number) {
        let query: any = {};

        if (search?.search || search?.filter) {
            query.$or = [];

            if (search.search) {
                query.$or.push({
                    clusterName: { $regex: search.search, $options: "i" },
                });
            }

            if (search.filter && mongoose.Types.ObjectId.isValid(search.filter)) {
                query.$or.push({
                    awsKeyId: new mongoose.Types.ObjectId(search.filter),
                });
            }
        }

        // Step 1: Fetch EKS records (raw)
        let data: any = await eksDashboardModel
            .find(query)
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });

        // Step 2: Inject awsKey data manually into each record
        data = await Promise.all(
            data.map(async (doc: any) => {
                const obj = doc.toObject();
                const awsKeyId = obj.awsKeyId?._id || obj.awsKeyId;

                if (awsKeyId) {
                    const awsKey = await awsKeysModel.findById({ _id: awsKeyId});
                    if (awsKey) {
                        obj.awsKeyId = {
                            _id: awsKey._id,
                            region: awsKey.region,
                            enviroment: awsKey.enviroment
                        };
                    }
                }

                return obj;
            })
        );

        // Step 3: Count
        const count = await eksDashboardModel.countDocuments(query);

        return { data, count };
    }




}