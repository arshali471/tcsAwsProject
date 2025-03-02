import { Router } from 'express';
import { AwsController } from '../controllers/awsController';
import { authMiddleware } from '../middleware/AuthMiddleware';
import { AwsEKSController } from '../controllers/awsEKSController';

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
        this.router.get("/getS3Bucket/:keyId", authMiddleware(), AwsController.getS3Bucket)
        // POST

        // PUT

        // EKS
        this.router.get("/getEksCluster/:keyId", authMiddleware(), AwsEKSController.getEksCluster)
    }
}
