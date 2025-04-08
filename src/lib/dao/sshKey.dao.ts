import sshkeyModel from "../../models/sshkey.model";

export class SSHKeyDao {
    static async createSSHKey(payload: any) {
        return await sshkeyModel.create(payload);
    }

    static async getSSHkeyById(keyId: any) {
        return await sshkeyModel.findById({ _id: keyId });
    }

    static async getSSHkeyByName(sshKeyName: string) {
        return await sshkeyModel.findOne({ sshKeyName: sshKeyName }, "-sshkey ");
    }

    static async getSshKeyByQuery(query: any, page: number, limit: number) {
        const skip = (page - 1) * limit;

        const [data, total] = await Promise.all([
            sshkeyModel
                .find(query, "-sshkey")
                .skip(skip)
                .limit(limit)
                .sort({ createdAt: -1 }) // latest first
                .populate("createdBy updatedBy", "username")
                .lean(), // remove if you need full Mongoose docs
            sshkeyModel.countDocuments(query)
        ]);

        return [data, total];
    }

    static async deleteSSHKey(id: any) {
        return await sshkeyModel.findByIdAndDelete({ _id: id });
    }

}