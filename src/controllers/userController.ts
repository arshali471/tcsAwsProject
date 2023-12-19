import express from "express";
import { UserService } from "../services/userService";
import { Utility, throwError } from "../util/util";


export class UserController {
    static async createUser(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            let { username, password } = req.body;

            password = await Utility.createPasswordHash(password);

            const userData = await UserService.createUser({ username, password });
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
}   