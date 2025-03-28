import { DB } from "../config/DB";
import userModel from "../models/user.model";
import { Utility } from "../util/util";


async function main() {
   await DB.connect();
   let adminEmail = `cloudadmin@iff.com`;
   let plainPassword = generatePassword();
   let password = Utility.createPasswordHash(plainPassword);
   let newAdmin = await userModel.create({ email: adminEmail,username: "cloudadmin", password, isAdmin: true, admin: true, addUser: true, addAWSKey: true });
   console.log(newAdmin, "newAdmin");
   console.log('New Admin created');
   console.log('Email: ', adminEmail);
   console.log('Password: ', plainPassword);
}


function generatePassword() {
   var length = 8,
       charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
       retVal = "";
   for (var i = 0, n = charset.length; i < length; ++i) {
       retVal += charset.charAt(Math.floor(Math.random() * n));
   }
   return retVal;
}

main();