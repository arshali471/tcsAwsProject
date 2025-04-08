import express from "express";
import fs from "fs";
import path from "path";
import { SSHKeyService } from "../services/sshKeyService";


export class AdminController {
    static async addSshKey(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const file = req.file;

            if (!file) {
                return res.status(400).json({ message: "sshfile are required" });
            }

            // Read SSH key file content
            const sshKeyPath = path.resolve(file.path);

            const sshkeyContent = fs.readFileSync(sshKeyPath, "utf8");

            const sshKeyExists = await SSHKeyService.getSSHkeyByName(file.originalname);

            if (sshKeyExists) {
                return res.status(400).json({ message: "SSH key with this name already exists" });
            }

            const newKey = await SSHKeyService.createSSHKey({
                sshKeyName: file.originalname,
                sshkey: sshkeyContent,
                createdBy: req.user?._id, // assuming you're attaching user to req via auth middleware
                updatedBy: req.user?._id
            });
            if (!newKey) {
                return res.status(500).json({ message: "Failed to create SSH key" });
            }

            // Optionally delete file from disk after saving
            fs.unlinkSync(sshKeyPath);

            return res.status(201).json({
                message: "SSH key added successfully",
                data: newKey
            });
        } catch (err) {
            next(err);
        }
    }

    static async getSshKey(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const { page = "1", limit = "10", search = "" } = req.query;

            const pageNum = Math.max(parseInt(page as string, 10), 1);
            const limitNum = Math.max(parseInt(limit as string, 10), 1);
            const searchStr = (search as string).trim();

            const query: any = {};
            if (searchStr) {
                query.sshKeyName = { $regex: searchStr, $options: "i" };
            }

            const [data, total]: any = await SSHKeyService.getSshKeyByQuery(query, pageNum, limitNum);

            return res.status(200).json({
                data,
                total,
                page: pageNum,
                totalPages: Math.ceil(total / limitNum),
            });
        } catch (err) {
            next(err);
        }
    }


    static async deleteSshKey(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const keyId = req.params.id;
            const sshKey = await SSHKeyService.getSSHkeyById(keyId);
            if (!sshKey) {
                return res.status(404).json({ message: "SSH key not found" });
            }

            await SSHKeyService.deleteSSHKey(keyId);

            return res.status(200).json({
                message: "SSH key deleted successfully"
            });
        }
        catch (err) {
            next(err);
        }
    }


}