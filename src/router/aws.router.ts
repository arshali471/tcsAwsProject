import { Router } from 'express';
import { AwsController } from '../controllers/awsController';

export default class AwsRouter {
    public router: Router;

    constructor() {
        this.router = Router();
        this.routes();
    }

    public routes(): void {
        // GET
        // EC2
        this.router.get('/getAllInstance', AwsController.getAllInstance);
        this.router.get("/getInstanceDetailsByInstanceId/:instanceId", AwsController.getInstanceDetailsByInstanceId)
        
        // S3
        this.router.get("/getS3Bucket", AwsController.getS3Bucket)
        // POST

        // PUT
    }
}
