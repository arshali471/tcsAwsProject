import { Router } from 'express';
import { AwsController } from '../controllers/awsController';
import { authMiddleware } from '../middleware/AuthMiddleware';

export default class AwsRouter {
    public router: Router;

    constructor() {
        this.router = Router();
        this.routes();
    }

    public routes(): void {
        // GET
        // EC2
        this.router.get('/getAllInstance/:keyId', authMiddleware(), AwsController.getAllInstance);
        this.router.get("/getInstanceDetailsByInstanceId/:instanceId/:keyId", authMiddleware(), AwsController.getInstanceDetailsByInstanceId)
        
        // S3
        this.router.get("/getS3Bucket", authMiddleware(), AwsController.getS3Bucket)
        // POST

        // PUT
    }
}
