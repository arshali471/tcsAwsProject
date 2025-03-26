import cluster from "cluster";
import eksDashboardModel from "../../models/eksDashboard.model";
import mongoose from 'mongoose';

export class EksDashboardDao {
    static async createEksToken(payload: any) {
        const { clusterName } = payload;

        return await eksDashboardModel.findOneAndUpdate(
            { clusterName },
            payload,
            { new: true, upsert: true } // upsert: create if not exists, new: return the updated doc
        );
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
                    clusterName: { $regex: search.search, $options: 'i' },
                });
            }

            if (search.filter && mongoose.Types.ObjectId.isValid(search.filter)) {
                query.$or.push({
                    awsKeyId: new mongoose.Types.ObjectId(search.filter),
                });
            }
        }

        const data = await eksDashboardModel
            .find(query)
            .populate("awsKeyId", "region enviroment")
            .skip(skip)
            .limit(limit);

        const count = await eksDashboardModel.countDocuments(query);

        return { data, count };
    }


}