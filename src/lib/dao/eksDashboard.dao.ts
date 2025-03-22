import eksDashboardModel from "../../models/eksDashboard.model";

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
            {$set: payload},
            { new: true }
        );
    }

    static async deleteEKSToken(id: any) {
        return await eksDashboardModel.findByIdAndDelete(id);
    }

}