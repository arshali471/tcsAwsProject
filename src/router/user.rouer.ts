import { Router } from 'express';
import { Validate } from '../lib/validations/validate';
import { UserController } from '../controllers/userController';
import { UserLoginSchema, UserSchema, UserUpdateSchema } from '../lib/validations/user.schema';
import { adminAuthMiddleware } from '../middleware/AdminAuthMiddleware';

export default class UserRouter {
    public router: Router;

    constructor() {
        this.router = Router();
        this.routes();
    }

    public routes(): void {
        // GET
        this.router.get("/getAllUser", adminAuthMiddleware(), UserController.getAllUser)
        this.router.get("/searchUser", adminAuthMiddleware(), UserController.getUsers); 
        
        // POST
        this.router.post("/createUser", adminAuthMiddleware(), Validate(UserSchema), UserController.createUser); 
        this.router.post("/login", Validate(UserLoginSchema), UserController.login); 

        // PUT
        this.router.put("/updateUser/:id", adminAuthMiddleware(), Validate(UserUpdateSchema), UserController.updateUser);

        // DELETE
        this.router.delete("/deleteUser/:id", adminAuthMiddleware(), UserController.deleteUser)
    }
}
