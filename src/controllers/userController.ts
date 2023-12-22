import express from "express";
import { UserService } from "../services/userService";
import { Utility, throwError } from "../util/util";


export class UserController {
    static async createUser(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            let { username, password, admin, addUser, addAWSKey  } = req.body;

            password = await Utility.createPasswordHash(password);

            const user = await UserService.getUserByUsername(username); 
            
            if (user) {
                return res.status(404).send("User already present with same username.")
            }

            const userData = await UserService.createUser({ username, password, admin, addUser, addAWSKey });
            if (!userData) {
                return res.status(404).send("User not created.")
            }
            res.status(200).send("User created Successfully.");
        } catch (err) {
            next(err);
        }
    }

    static async login(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            let { username, password } = req.body;

            const user = await UserService.getUserByUsername(username);

            if (!user) {
                return res.status(404).send("No user found.")
            }
            if (!Utility.comparePasswordHash(user.password, password)) {
                throwError("Incorrect password", 400);
            }

            let token = Utility.generateJwtToken(user?._id);

            res.send({
                token, 
                username: user.username
            });
        } catch (err) {
            next(err);
        }
    }

    static async getAllUser(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const userData = await UserService.getAllUser();
            if (!userData) {
                return res.status(404).send("User not created.")
            }
            res.send(userData);
        } catch (err) {
            next(err);
        }
    }

    static async updateUser(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const userId = req.params.id; 
            const data = req.body; 
            const userData = await UserService.updateUser(userId, data);
            if (!userData) {
                return res.status(404).send("User not updated.")
            }
            res.send(userData);
        } catch (err) {
            next(err);
        }
    }

    static async deleteUser(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const userId = req.params.id; 
            const userData = await UserService.deleteUser(userId);
            if (!userData) {
                return res.status(404).send("User not deleted.")
            }
            res.send("user deleted successfully.");
        } catch (err) {
            next(err);
        }
    }

    static async getUsers(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const searchText: any = req.query.searchText; 

            const userData = await UserService.getUsers(searchText);
            if (!userData) {
                return res.status(404).send("User not created.")
            }
            res.send(userData);
        } catch (err) {
            next(err);
        }
    }
}   