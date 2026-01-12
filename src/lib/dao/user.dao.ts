import userModel from "../../models/user.model";

export class UserDao {
    static async createUser(payload: any) {
        return await userModel.create(payload);
    }

    static async getUserByUsername(username: string) {
        return await userModel.findOne({ username })
    }

    static async getUserById(id: any) {
        return await userModel.findById(id, "-password");
    }

    static async getUserByEmail(email: string) {
        return await userModel.findOne({ email })
    }

    static async getAllUser() {
        return await userModel.find({}, "-password")
    }

    static async updateUser(userId: any, payload: any) {
        const user: any = await userModel.findById({_id: userId});
        const updateFields: any = {
            isActive: payload.isActive  !== undefined ? payload.isActive : user.isActive,
            admin: payload.admin !== undefined ? payload.admin : user.admin,
            addUser: payload.addUser !== undefined ? payload.addUser : user.addUser,
            addAWSKey: payload.addAWSKey !== undefined ? payload.addAWSKey : user.addAWSKey,
            addDocument: payload.addDocument !== undefined ? payload.addDocument : user.addDocument
        };

        // Handle SSO fields
        if (payload.ssoProvider !== undefined) updateFields.ssoProvider = payload.ssoProvider;
        if (payload.azureOid !== undefined) updateFields.azureOid = payload.azureOid;
        if (payload.displayName !== undefined) updateFields.displayName = payload.displayName;
        if (payload.department !== undefined) updateFields.department = payload.department;
        if (payload.jobTitle !== undefined) updateFields.jobTitle = payload.jobTitle;
        if (payload.lastLogin !== undefined) updateFields.lastLogin = payload.lastLogin;

        return await userModel.findByIdAndUpdate(
            { _id: userId },
            { $set: updateFields },
            { new: true }
        ).select("-password")
    }

    static async deleteUser(userId: any) {
        return await userModel.findOneAndDelete({ _id: userId });
    }

    static async getUsers(searchText: any) {
        return await userModel.find({
            $or: [
                {username: { $regex: searchText, $options: "i" }}
            ]
        })
    }

    static async changePassword(userId: any, password: any) {
        return await userModel.findByIdAndUpdate({ _id: userId }, {
            $set: {
                password: password
            }
        }, { new: true }).select("-password")
    }

    static async getUserPassword(userId: any) {
        return await userModel.findById(userId, "password");
    }

    static async getUserByAzureOid(azureOid: string) {
        return await userModel.findOne({
            azureOid,
            ssoProvider: 'azure'
        });
    }

    static async createSSOUser(payload: {
        email: string,
        username: string,
        displayName?: string,
        azureOid: string,
        department?: string,
        jobTitle?: string,
        ssoProvider: 'azure',
        admin?: boolean,
        addUser?: boolean,
        addAWSKey?: boolean,
        addDocument?: boolean
    }) {
        return await userModel.create({
            ...payload,
            isActive: true,
            admin: payload.admin || false,
            addUser: payload.addUser || false,
            addAWSKey: payload.addAWSKey || false,
            addDocument: payload.addDocument || false,
            lastLogin: new Date()
        });
    }

    static async updateLastLogin(userId: any) {
        return await userModel.findByIdAndUpdate(
            { _id: userId },
            { $set: { lastLogin: new Date() } },
            { new: true }
        ).select("-password");
    }

    static async updateLastLogout(userId: any) {
        return await userModel.findByIdAndUpdate(
            { _id: userId },
            { $set: { lastLogout: new Date() } },
            { new: true }
        ).select("-password");
    }
}