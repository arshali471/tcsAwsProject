import userModel from "../../models/user.model";

export class UserDao {
    static async createUser(payload: any) {
        return await userModel.create(payload);
    }

    static async getUserByUsername(username: string) {
        return await userModel.findOne({ username })
    }

    static async getUserById(id: any) {
        return await userModel.findById(id);
    }

    static async getAllUser() {
        return await userModel.find({}, "-password")
    }

    static async updateUser(userId: any, payload: any) {
        return await userModel.findByIdAndUpdate({ _id: userId }, {
            $set: {
                isActive: payload.isActive, 
                admin: payload.admin, 
                addUser: payload.addUser, 
                addAWSKey: payload.addAWSKey
            }
        }, { new: true }).select("-password")
    }

    static async deleteUser(userId: any) {
        return await userModel.findByIdAndUpdate({ _id: userId }, {
            $set: {
                isActive: false, 
            }
        }, { new: true }).select("-password")
    }

    static async getUsers(searchText: any) {
        return await userModel.find({
            $or: [
                {username: { $regex: searchText, $options: "i" }}
            ]
        })
    }
}