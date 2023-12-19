import express from "express";
import { UserService } from "../services/userService";
import { Utility } from "../util/util";


export class UserController {
    static async createUser(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            let {username, password} = req.body; 

            password = await Utility.createPasswordHash(password); 

            const userData = await UserService.createUser({username, password}); 
            if (!userData) {
                return res.status(404).send("User not created.")
            }
            res.status(200).send("User created Successfully.");
        } catch (err) {
            next(err);
        }
    }    
}   