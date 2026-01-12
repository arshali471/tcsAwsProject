import Joi from "joi";
import { DefaultMessage } from "./message/default.message";

export const UserSchema: Joi.Schema = Joi.object({
    username: Joi.string().required().messages(DefaultMessage.defaultRequired("username")),
    email: Joi.string().email().required().messages(DefaultMessage.defaultRequired("email")),
    password: Joi.string().required().messages(DefaultMessage.defaultRequired("password")),
    admin: Joi.boolean().optional().messages(DefaultMessage.defaultRequired("admin")),
    addUser: Joi.boolean().optional().messages(DefaultMessage.defaultRequired("addUser")),
    addAWSKey: Joi.boolean().optional().messages(DefaultMessage.defaultRequired("addAWSKey")),
    addDocument: Joi.boolean().optional().messages(DefaultMessage.defaultRequired("addDocument")),
});

export const UserLoginSchema: Joi.Schema = Joi.object({
    username: Joi.string().required().messages(DefaultMessage.defaultRequired("username")),
    password: Joi.string().required().messages(DefaultMessage.defaultRequired("password")),
});

export const UserUpdateSchema: Joi.Schema = Joi.object({
    admin: Joi.boolean().optional().messages(DefaultMessage.defaultRequired("admin")),
    isActive: Joi.boolean().optional().messages(DefaultMessage.defaultRequired("isActive")),
    addUser: Joi.boolean().optional().messages(DefaultMessage.defaultRequired("addUser")),
    addAWSKey: Joi.boolean().optional().messages(DefaultMessage.defaultRequired("addAWSKey")),
    addDocument: Joi.boolean().optional().messages(DefaultMessage.defaultRequired("addDocument")),
});
