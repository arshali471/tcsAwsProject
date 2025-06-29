import { Router } from 'express';
import { AwsController } from '../controllers/awsController';
import { authMiddleware } from '../middleware/AuthMiddleware';
import { AwsEKSController } from '../controllers/awsEKSController';
import { AwsRDSController } from '../controllers/awsRDSController';
import { AwsVolumesController } from '../controllers/awsVolumesController';
import { adminAuthMiddleware } from '../middleware/AdminAuthMiddleware';
import { AdminController } from '../controllers/adminController';
import { upload } from '../helper/fileUploader';

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

        // Check the zabbix-status
        this.router.get("/getZabbixStatus/:keyId", authMiddleware(), AwsController.getZabbixStatus)
        // this.router.get("/getZabbixStatusFromDB/:keyId", authMiddleware(), AwsController.getZabbixStatusFromDB)
        this.router.post("/addSshKey", adminAuthMiddleware(), upload.single("upload"), AdminController.addSshKey)
        this.router.get("/getSshKey", authMiddleware(), AdminController.getSshKey)
        this.router.delete("/deleteSshKey/:id", adminAuthMiddleware(), AdminController.deleteSshKey)


        // Volumes
        this.router.get("/getVolumes/:keyId", authMiddleware(), AwsVolumesController.getVolumes)
        
        // S3
        this.router.get("/getS3Bucket/:keyId", authMiddleware(), AwsController.getS3Bucket)
        // POST

        // PUT

        // EKS
        this.router.get("/getEksCluster/:keyId", authMiddleware(), AwsEKSController.getEksCluster)
        this.router.get("/getEksClusterName/:id", authMiddleware(), AwsEKSController.getEksClusterName)
        this.router.post("/addEKSToken", adminAuthMiddleware(), AwsEKSController.addEKSToken)
        this.router.get("/getEKSToken/:id", adminAuthMiddleware(), AwsEKSController.getEKSTokenById)
        this.router.get("/getEKSToken/:keyId", adminAuthMiddleware(), AwsEKSController.getEKSTokenByAWSKey)
        this.router.get("/getAllEKSToken", adminAuthMiddleware(), AwsEKSController.getAllEKSToken)
        this.router.put("/updateEKSToken/:id", adminAuthMiddleware(), AwsEKSController.updateEKSToken)
        this.router.delete("/deleteEKSToken/:id", adminAuthMiddleware(), AwsEKSController.deleteEKSToken)


        // RDS
        this.router.get("/getRdsInstance/:keyId", authMiddleware(), AwsRDSController.getRdsInstances)
    }
}
