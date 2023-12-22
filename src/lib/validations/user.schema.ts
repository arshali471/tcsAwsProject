import Joi from "joi";
import { DefaultMessage } from "./message/default.message";

export const UserSchema: Joi.Schema = Joi.object({
    username: Joi.string().required().messages(DefaultMessage.defaultRequired("username")),
    password: Joi.string().required().messages(DefaultMessage.defaultRequired("password")),
    admin: Joi.boolean().required().messages(DefaultMessage.defaultRequired("admin")),
    addUser: Joi.boolean().required().messages(DefaultMessage.defaultRequired("addUser")),
    addAWSKey: Joi.boolean().required().messages(DefaultMessage.defaultRequired("addAWSKey")),
});

export const UserLoginSchema: Joi.Schema = Joi.object({
    username: Joi.string().required().messages(DefaultMessage.defaultRequired("username")),
    password: Joi.string().required().messages(DefaultMessage.defaultRequired("password")),
});

export const UserUpdateSchema: Joi.Schema = Joi.object({
    admin: Joi.boolean().required().messages(DefaultMessage.defaultRequired("admin")),
    isActive: Joi.boolean().required().messages(DefaultMessage.defaultRequired("isActive")),
    addUser: Joi.boolean().required().messages(DefaultMessage.defaultRequired("addUser")),
    addAWSKey: Joi.boolean().required().messages(DefaultMessage.defaultRequired("addAWSKey")),
});
