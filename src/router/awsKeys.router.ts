import { Router } from 'express';
import { AwsKeyController } from '../controllers/awsKeyController';
import { Validate } from '../lib/validations/validate';
import { AWSKeySchema } from '../lib/validations/awsKey.schema';
import { authMiddleware } from '../middleware/AuthMiddleware';

export default class AwsKeysRouter {
    public router: Router;

    constructor() {
        this.router = Router();
        this.routes();
    }

    public routes(): void {
        // GET
        this.router.get('/getAllAWSKey', authMiddleware(), AwsKeyController.getAllAWSKey);
        
        // POST
        this.router.post("/createAWSKey", Validate(AWSKeySchema), AwsKeyController.createAWSKey); 

        // PUT
    }
}
