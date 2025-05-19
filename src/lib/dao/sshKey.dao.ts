import sshkeyModel from "../../models/sshkey.model";

export class SSHKeyDao {
    static async createSSHKey(payload: any) {
        return await sshkeyModel.create(payload);
    }

    static async getSSHkeyById(keyId: any) {
        return await sshkeyModel.findById({ _id: keyId }, "-sshkey").populate("createdBy updatedBy", "username");
    }

    static async getSSHkeyByName(sshKeyHash: string) {
        return await sshkeyModel.findOne({ sshKeyHash: sshKeyHash }, "-sshkey ");
    }

    // static async getSshKeyByQuery(query: any, page: number, limit: number) {
    //     const skip = (page - 1) * limit;

    //     const [data, total] = await Promise.all([
    //         sshkeyModel
    //             .find(query, "-sshkey") // omit sshkey field (optional)
    //             .skip(skip)
    //             .limit(limit)
    //             .sort({ createdAt: -1 })
    //             .populate("createdBy updatedBy", "username"),
    //         // 🔴 .lean() removed to enable decryption
    //         sshkeyModel.countDocuments(query)
    //     ]);

    //     return [data, total];
    // }

    static async getSshKeyByQuery(query: any, page: number, limit: number) {
        const skip = (page - 1) * limit;

        // Step 1: Fetch raw docs (don't project yet)
        let data: any = await sshkeyModel
            .find(query)
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });

        // Step 2: Populate
        data = await sshkeyModel.populate(data, [
            { path: "createdBy", select: "username" },
            { path: "updatedBy", select: "username" }
        ]);

        // Step 3: Remove sshkey field manually
        data = data.map((doc: any) => {
            const obj = doc.toObject();
            delete obj.sshkey;
            return obj;
        });

        const total = await sshkeyModel.countDocuments(query);

        return [data, total];
    }




    static async deleteSSHKey(id: any) {
        return await sshkeyModel.findByIdAndDelete({ _id: id });
    }

}