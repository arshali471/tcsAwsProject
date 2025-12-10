import express from "express";
import { DocumentationDao } from "../lib/dao/documentation.dao";
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { CONFIG } from "../config/environment";
import path from "path";

export class DocumentationController {
    /**
     * Upload documentation file
     * POST /api/v1/aws/documentation/upload
     */
    static async uploadDocumentation(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const { title, description, category, tags, documentType, referenceUrl, visibility, sharedWith } = req.body;
            const username = (req as any).user?.username || "Unknown";

            // Validate required fields
            if (!title) {
                return res.status(400).json({
                    success: false,
                    message: "Title is required"
                });
            }

            let documentData: any = {
                title,
                description: description || "",
                category: category || "General",
                uploadedBy: username,
                tags: tags ? JSON.parse(tags) : [],
                documentType: documentType || 'file',
                visibility: visibility || 'public',
                sharedWith: sharedWith ? JSON.parse(sharedWith) : []
            };

            // Handle file upload
            if (documentType === 'file' || !documentType) {
                if (!req.file) {
                    return res.status(400).json({
                        success: false,
                        message: "No file uploaded"
                    });
                }

                const file = req.file;

                // Upload to S3
                const s3Client = new S3Client({
                    region: CONFIG.aws.region,
                    credentials: {
                        accessKeyId: CONFIG.aws.accessKeyId!,
                        secretAccessKey: CONFIG.aws.secretAccessKey!
                    }
                });
                const fileName = `documentation/${Date.now()}_${file.originalname}`;

                const uploadCommand = new PutObjectCommand({
                    Bucket: CONFIG.awsS3BucketName!,
                    Key: fileName,
                    Body: file.buffer,
                    ContentType: file.mimetype
                });

                await s3Client.send(uploadCommand);

                documentData.fileName = file.originalname;
                documentData.fileUrl = fileName;
                documentData.fileSize = file.size;
                documentData.fileType = file.mimetype;
            }
            // Handle reference link
            else if (documentType === 'link') {
                if (!referenceUrl) {
                    return res.status(400).json({
                        success: false,
                        message: "Reference URL is required for link type"
                    });
                }

                documentData.fileName = title;
                documentData.fileUrl = referenceUrl;
                documentData.fileSize = 0;
                documentData.fileType = 'link';
            }

            // Save to database
            const documentation = await DocumentationDao.create(documentData);

            return res.status(201).json({
                success: true,
                message: documentType === 'link' ? "Reference link added successfully" : "Documentation uploaded successfully",
                data: documentation
            });
        } catch (err: any) {
            console.error("Error uploading documentation:", err);
            return res.status(500).json({
                success: false,
                message: err.message || "Failed to upload documentation"
            });
        }
    }

    /**
     * Get all documentation
     * GET /api/v1/aws/documentation
     */
    static async getAllDocumentation(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const { category, search } = req.query;
            const username = (req as any).user?.username || "";
            const userEmail = (req as any).user?.email || "";

            let documentation;
            if (search) {
                documentation = await DocumentationDao.search(String(search));
            } else if (category) {
                documentation = await DocumentationDao.getByCategory(String(category));
            } else {
                documentation = await DocumentationDao.getAll();
            }

            // Filter documents based on visibility and access rights
            const accessibleDocs = documentation.filter((doc: any) => {
                // Public documents are visible to everyone
                if (doc.visibility === 'public') return true;

                // Private documents: only visible to uploader or shared users
                if (doc.uploadedBy === username) return true;

                // Check if user has access through sharedWith
                if (doc.sharedWith && doc.sharedWith.length > 0) {
                    return doc.sharedWith.some((share: any) => share.email === userEmail);
                }

                return false;
            });

            // Generate signed URLs for file downloads, use direct URL for links
            const s3Client = new S3Client({
                region: CONFIG.aws.region,
                credentials: {
                    accessKeyId: CONFIG.aws.accessKeyId!,
                    secretAccessKey: CONFIG.aws.secretAccessKey!
                }
            });
            const documentationWithUrls = await Promise.all(
                accessibleDocs.map(async (doc: any) => {
                    const docObj = doc.toObject();

                    // If it's a link type, use the URL directly
                    if (docObj.documentType === 'link') {
                        return {
                            ...docObj,
                            externalUrl: docObj.fileUrl,
                            downloadUrl: docObj.fileUrl
                        };
                    }

                    // Otherwise, generate S3 signed URL for file
                    const command = new GetObjectCommand({
                        Bucket: CONFIG.awsS3BucketName!,
                        Key: doc.fileUrl
                    });
                    const signedUrl = await getSignedUrl(s3Client as any, command as any, { expiresIn: 3600 });

                    return {
                        ...docObj,
                        fileUrl: signedUrl,
                        downloadUrl: signedUrl
                    };
                })
            );

            return res.status(200).json({
                success: true,
                data: documentationWithUrls
            });
        } catch (err: any) {
            console.error("Error fetching documentation:", err);
            return res.status(500).json({
                success: false,
                message: err.message || "Failed to fetch documentation"
            });
        }
    }

    /**
     * Get documentation by ID
     * GET /api/v1/aws/documentation/:id
     */
    static async getDocumentationById(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const { id } = req.params;
            const documentation = await DocumentationDao.getById(id);

            if (!documentation) {
                return res.status(404).json({
                    success: false,
                    message: "Documentation not found"
                });
            }

            const docObj = documentation.toObject();

            // If it's a link type, use the URL directly
            if (docObj.documentType === 'link') {
                return res.status(200).json({
                    success: true,
                    data: {
                        ...docObj,
                        externalUrl: docObj.fileUrl,
                        downloadUrl: docObj.fileUrl
                    }
                });
            }

            // If it's a file type, generate signed URL from S3
            const s3Client = new S3Client({
                region: CONFIG.aws.region,
                credentials: {
                    accessKeyId: CONFIG.aws.accessKeyId!,
                    secretAccessKey: CONFIG.aws.secretAccessKey!
                }
            });
            const command = new GetObjectCommand({
                Bucket: CONFIG.awsS3BucketName!,
                Key: documentation.fileUrl
            });
            const signedUrl = await getSignedUrl(s3Client as any, command as any, { expiresIn: 3600 });

            return res.status(200).json({
                success: true,
                data: {
                    ...docObj,
                    fileUrl: signedUrl,
                    downloadUrl: signedUrl
                }
            });
        } catch (err: any) {
            console.error("Error fetching documentation:", err);
            return res.status(500).json({
                success: false,
                message: err.message || "Failed to fetch documentation"
            });
        }
    }

    /**
     * Update documentation metadata
     * PUT /api/v1/aws/documentation/:id
     */
    static async updateDocumentation(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const { id } = req.params;
            const { title, description, category, tags, visibility, sharedWith } = req.body;

            const updateData: any = {};
            if (title) updateData.title = title;
            if (description !== undefined) updateData.description = description;
            if (category) updateData.category = category;
            if (tags) updateData.tags = JSON.parse(tags);
            if (visibility) updateData.visibility = visibility;
            if (sharedWith) updateData.sharedWith = JSON.parse(sharedWith);

            const documentation = await DocumentationDao.update(id, updateData);

            if (!documentation) {
                return res.status(404).json({
                    success: false,
                    message: "Documentation not found"
                });
            }

            return res.status(200).json({
                success: true,
                message: "Documentation updated successfully",
                data: documentation
            });
        } catch (err: any) {
            console.error("Error updating documentation:", err);
            return res.status(500).json({
                success: false,
                message: err.message || "Failed to update documentation"
            });
        }
    }

    /**
     * Delete documentation
     * DELETE /api/v1/aws/documentation/:id
     */
    static async deleteDocumentation(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const { id } = req.params;
            const documentation = await DocumentationDao.getById(id);

            if (!documentation) {
                return res.status(404).json({
                    success: false,
                    message: "Documentation not found"
                });
            }

            // Delete from S3
            const s3Client = new S3Client({
                region: CONFIG.aws.region,
                credentials: {
                    accessKeyId: CONFIG.aws.accessKeyId!,
                    secretAccessKey: CONFIG.aws.secretAccessKey!
                }
            });
            const deleteCommand = new DeleteObjectCommand({
                Bucket: CONFIG.awsS3BucketName!,
                Key: documentation.fileUrl
            });
            await s3Client.send(deleteCommand);

            // Delete from database
            await DocumentationDao.delete(id);

            return res.status(200).json({
                success: true,
                message: "Documentation deleted successfully"
            });
        } catch (err: any) {
            console.error("Error deleting documentation:", err);
            return res.status(500).json({
                success: false,
                message: err.message || "Failed to delete documentation"
            });
        }
    }

    /**
     * Share document with user
     * POST /api/v1/aws/documentation/share/:id
     */
    static async shareDocument(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const { id } = req.params;
            const { email, permission } = req.body;

            if (!email) {
                return res.status(400).json({
                    success: false,
                    message: "Email is required"
                });
            }

            const documentation = await DocumentationDao.getById(id);
            if (!documentation) {
                return res.status(404).json({
                    success: false,
                    message: "Documentation not found"
                });
            }

            // Check if already shared with this email
            const sharedWith = documentation.sharedWith || [];
            const existingShare = sharedWith.find((share: any) => share.email === email);

            if (existingShare) {
                // Update permission
                existingShare.permission = permission || 'view';
            } else {
                // Add new share
                sharedWith.push({
                    email,
                    permission: permission || 'view',
                    sharedAt: new Date()
                });
            }

            const updated = await DocumentationDao.update(id, { sharedWith });

            return res.status(200).json({
                success: true,
                message: "Document shared successfully",
                data: updated
            });
        } catch (err: any) {
            console.error("Error sharing document:", err);
            return res.status(500).json({
                success: false,
                message: err.message || "Failed to share document"
            });
        }
    }

    /**
     * Remove share access from user
     * DELETE /api/v1/aws/documentation/share/:id/:email
     */
    static async removeShareAccess(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const { id, email } = req.params;

            const documentation = await DocumentationDao.getById(id);
            if (!documentation) {
                return res.status(404).json({
                    success: false,
                    message: "Documentation not found"
                });
            }

            // Remove the share
            const sharedWith = (documentation.sharedWith || []).filter((share: any) => share.email !== email);
            const updated = await DocumentationDao.update(id, { sharedWith });

            return res.status(200).json({
                success: true,
                message: "Share access removed successfully",
                data: updated
            });
        } catch (err: any) {
            console.error("Error removing share access:", err);
            return res.status(500).json({
                success: false,
                message: err.message || "Failed to remove share access"
            });
        }
    }

    /**
     * Get all categories
     * GET /api/v1/aws/documentation/categories
     */
    static async getCategories(req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            const categories = await DocumentationDao.getAllCategories();

            return res.status(200).json({
                success: true,
                data: categories
            });
        } catch (err: any) {
            console.error("Error fetching categories:", err);
            return res.status(500).json({
                success: false,
                message: err.message || "Failed to fetch categories"
            });
        }
    }
}
