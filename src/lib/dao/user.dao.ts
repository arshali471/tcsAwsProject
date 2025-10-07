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
        return await userModel.findByIdAndUpdate({ _id: userId }, {
            $set: {
                isActive: payload.isActive  !== undefined ? payload.isActive : user.isActive, 
                admin: payload.admin !== undefined ? payload.admin : user.admin , 
                addUser: payload.addUser !== undefined ? payload.addUser : user.addUser, 
                addAWSKey: payload.addAWSKey !== undefined ? payload.addAWSKey : user.addAWSKey
            }
        }, { new: true }).select("-password")
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
}