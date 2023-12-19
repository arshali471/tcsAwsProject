import { Router } from 'express';
import { Validate } from '../lib/validations/validate';
import { UserController } from '../controllers/userController';
import { UserSchema } from '../lib/validations/user.schema';

export default class UserRouter {
    public router: Router;

    constructor() {
        this.router = Router();
        this.routes();
    }

    public routes(): void {
        // GET
        
        // POST
        this.router.post("/createUser", Validate(UserSchema), UserController.createUser); 

        // PUT
    }
}
