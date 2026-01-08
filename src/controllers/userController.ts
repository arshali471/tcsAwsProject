import express from "express";
import { UserService } from "../services/userService";
import { Utility, throwError } from "../util/util";


export class UserController {
    static async createUser(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            let { username, password, admin, addUser, addAWSKey } = req.body;

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

            let user: any;
            user = await UserService.getUserByUsername(username);

            if (!user) {
                user = await UserService.getUserByEmail(username);
            }



            if (!user) {
                return res.status(404).send("No user found.")
            }

            // Check if user is SSO-only (no password set)
            if (user.ssoProvider === 'azure' && !user.password) {
                return res.status(400).send("This account uses Microsoft SSO. Please sign in with Microsoft.");
            }

            if (!Utility.comparePasswordHash(user.password, password)) {
                throwError("Incorrect password", 400);
            }

            // Update last login
            await UserService.updateLastLogin(user._id);

            let token = Utility.generateJwtToken(user?._id);

            res.send({
                token,
                username: user.username,
                email: user.email,
                admin: user.admin || false
            });
        } catch (err) {
            next(err);
        }
    }

    static async getAllUser(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const userData = await UserService.getAllUser();
            if (!userData) {
                return res.status(404).send("User not found")
            }
            res.send(userData);
        } catch (err) {
            next(err);
        }
    }

    static async getUserById(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const id = req.user._id;
            const userData = await UserService.getUserById(id);
            if (!userData) {
                return res.status(404).send("User not found.")
            }
            res.send(userData);
        } catch (err) {
            next(err);
        }
    }

    static async updateUser(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const userId = req.params.id;
            let data = req.body;

            if (data.admin) {
                data = {
                    admin: true,
                    addUser: true,
                    addAWSKey: true,
                }
            }

            console.log(data, "data")

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

    static async changePassword(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const userId = req.user.id;
            let { newPassword, currentPassword } = req.body;
            newPassword = await Utility.createPasswordHash(newPassword);

            const user = await UserService.getUserPassword(userId);
            if (!user) {
                return res.status(404).send("User not found.")
            }

            if (!Utility.comparePasswordHash(user.password, currentPassword)) {
                throwError("password does not match", 400);
            }

            console.log(newPassword, "newPassword")
            const userData = await UserService.changePassword(userId, newPassword);
            if (!userData) {
                return res.status(404).send("User not updated.")
            }
            res.send(userData);
        } catch (err) {
            next(err);
        }
    }

    static async changePasswordByAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const userId = req.params.id;
            let { newPassword } = req.body;
            newPassword = await Utility.createPasswordHash(newPassword);

            const userData = await UserService.changePassword(userId, newPassword);
            if (!userData) {
                return res.status(404).send("User not updated.")
            }
            res.send(userData);
        } catch (err) {
            next(err);
        }
    }
}   