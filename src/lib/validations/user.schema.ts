import Joi from "joi";
import { DefaultMessage } from "./message/default.message";

export const UserSchema: Joi.Schema = Joi.object({
    username: Joi.string().required().messages(DefaultMessage.defaultRequired("username")),
    password: Joi.string().required().messages(DefaultMessage.defaultRequired("password")),
});
