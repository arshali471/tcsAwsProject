import { UserDao } from "../lib/dao/user.dao";
import { throwError } from "../util/util";


export class UserService {
    static async createUser(payload: any) {
        return await UserDao.createUser(payload);
    }

    static async getUserByUsername(username: string) {
        return await UserDao.getUserByUsername(username); 
    }

    static async getUserById(id: any) {
        return await UserDao.getUserById(id);
    }

    static async getAllUser() {
        return await UserDao.getAllUser();
    }

    static async updateUser(userId: any, payload: any) {
        return await UserDao.updateUser(userId, payload);
    }

    static async deleteUser(userId: any) {
        return await UserDao.deleteUser(userId); 
    }

    static async getUsers(searchText: string) {
        return await UserDao.getUsers(searchText); 
    }

    static async changePassword(userId: any, password: any) {
        return await UserDao.changePassword(userId, password);
    }

    static async getUserPassword(userId: any) {
        return await UserDao.getUserPassword(userId);
    }
}


