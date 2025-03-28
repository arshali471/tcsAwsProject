import { Schema, model, Document } from "mongoose";

export interface IUser extends Document {
    email: string
    phone: string
    username: string
    password: string
    isActive: boolean
    admin: boolean
    addUser: boolean
    addAWSKey: boolean
}

const UserSchema = new Schema<IUser>({
    email: String,
    phone: String,
    username: String, 
    password: String, 
    isActive: {
        type: Boolean, 
        default: true
    }, 
    admin: {
        type: Boolean, 
        default: false
    }, 
    addUser: {
        type: Boolean, 
        default: false
    }, 
    addAWSKey: {
        type: Boolean, 
        default: false
    }
},
    {
        versionKey: false,
        timestamps: true,
        collection: "user"
    }
);

export default model<IUser>("user", UserSchema)