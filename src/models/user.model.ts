import { Schema, model, Document } from "mongoose";

export interface IUser extends Document {
    username: string
    password: string
    isActive: boolean
    admin: boolean
    addUser: boolean
    addAWSKey: boolean
}

const UserSchema = new Schema<IUser>({
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