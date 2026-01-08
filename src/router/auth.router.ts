import { Router } from 'express';
import { AuthController } from '../controllers/authController';

export default class AuthRouter {
    public router: Router;

    constructor() {
        this.router = Router();
        this.routes();
    }

    public routes(): void {
        // POST - Microsoft OAuth callback
        this.router.post("/microsoft/callback", AuthController.microsoftCallback);

        // GET - Azure AD configuration
        this.router.get("/azure/config", AuthController.getAzureConfig);
    }
}
