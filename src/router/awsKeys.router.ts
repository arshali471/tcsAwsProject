import { Router } from 'express';
import { AwsKeyController } from '../controllers/awsKeyController';
import { Validate } from '../lib/validations/validate';
import { AWSKeySchema } from '../lib/validations/awsKey.schema';
import { authMiddleware } from '../middleware/AuthMiddleware';
import { adminAuthMiddleware } from '../middleware/AdminAuthMiddleware';
import { userAuthMiddleware } from '../middleware/UserAuthMiddleware';

export default class AwsKeysRouter {
    public router: Router;

    constructor() {
        this.router = Router();
        this.routes();
    }

    public routes(): void {
        // GET
        this.router.get('/getAllAWSKey', authMiddleware(), AwsKeyController.getAllAWSKey);
        this.router.get("/getAWSRegions", authMiddleware(), AwsKeyController.getAWSRegions)
        
        // POST
        this.router.post("/createAWSKey", userAuthMiddleware(), Validate(AWSKeySchema), AwsKeyController.createAWSKey); 

        // PUT
        this.router.put("/updateApiKey/:id", adminAuthMiddleware(), AwsKeyController.updateApiKey)

        // DELETE
        this.router.delete("/deleteApiKey/:id", adminAuthMiddleware(), AwsKeyController.deleteApiKey)
    }
}
