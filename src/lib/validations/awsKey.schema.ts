import Joi from "joi";
import { DefaultMessage } from "./message/default.message";

export const AWSKeySchema: Joi.Schema = Joi.object({
    region: Joi.string().required().messages(DefaultMessage.defaultRequired("region")),
    accessKeyId: Joi.string().required().messages(DefaultMessage.defaultRequired("accessKeyId")),
    secretAccessKey: Joi.string().required().messages(DefaultMessage.defaultRequired("secretAccessKey")),
    enviroment: Joi.string().required().messages(DefaultMessage.defaultRequired("enviroment")),
});
