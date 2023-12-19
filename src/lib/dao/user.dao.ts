import userModel from "../../models/user.model";

export class UserDao {
    static async createUser(payload: any) {
        return await userModel.create(payload); 
    }

    static async getUserByUsername(username: string) {
        return await userModel.findOne({username})
    }
}