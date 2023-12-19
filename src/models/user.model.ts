import { Schema, model, Document } from "mongoose";

export interface IUser extends Document {
    username: string
    password: string
    isActive: boolean
}

const UserSchema = new Schema<IUser>({
    username: String, 
    password: String, 
    isActive: {
        type: Boolean, 
        default: true
    }
},
    {
        versionKey: false,
        timestamps: true,
        collection: "user"
    }
);

export default model<IUser>("user", UserSchema)