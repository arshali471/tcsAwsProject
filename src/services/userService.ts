import { UserDao } from "../lib/dao/user.dao";
import { throwError } from "../util/util";


export class UserService {
    static async createUser(payload: any) {
        return await UserDao.createUser(payload);
    }

    static async getUserByUsername(username: string) {
        return await UserDao.getUserByUsername(username); 
    }
}


