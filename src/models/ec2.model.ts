import { Schema, model, Document } from "mongoose";
import mongooseEncryption from "mongoose-encryption";
import { CONFIG } from "../config/environment";


const encKey = CONFIG.encKey;
const sigKey = CONFIG.sigKey;

if (!encKey || !sigKey) {
    throw new Error("ENCRYPTION_SECRET and SIGNING_SECRET must be set");
}

export interface IEC2 extends Document {
    AmiLaunchIndex: number;
    ImageId: string;
    InstanceId: string;
    InstanceType: string;
    KeyName: string;
    LaunchTime: Date;
    Monitoring: {
        State: string;
    };
    Placement: {
        AvailabilityZone: string;
        GroupName: string;
        Tenancy: string;
    };
    PrivateDnsName: string;
    PrivateIpAddress: string;
    ProductCodes: any[];
    PublicDnsName: string;
    State: {
        Code: number;
        Name: string;
    };
    StateTransitionReason: string;
    SubnetId: string;
    VpcId: string;
    Architecture: string;
    BlockDeviceMappings: {
        DeviceName: string;
        Ebs: {
            AttachTime: Date;
            DeleteOnTermination: boolean;
            Status: string;
            VolumeId: string;
        };
    }[];
    ClientToken: string;
    EbsOptimized: boolean;
    EnaSupport: boolean;
    Hypervisor: string;
    NetworkInterfaces: {
        Attachment: {
            AttachTime: Date;
            AttachmentId: string;
            DeleteOnTermination: boolean;
            DeviceIndex: number;
            Status: string;
            NetworkCardIndex: number;
        };
        Description: string;
        Groups: {
            GroupName: string;
            GroupId: string;
        }[];
        Ipv6Addresses: string[];
        MacAddress: string;
        NetworkInterfaceId: string;
        OwnerId: string;
        PrivateDnsName: string;
        PrivateIpAddress: string;
        PrivateIpAddresses: {
            Primary: boolean;
            PrivateDnsName: string;
            PrivateIpAddress: string;
        }[];
        SourceDestCheck: boolean;
        Status: string;
        SubnetId: string;
        VpcId: string;
        InterfaceType: string;
    }[];
    RootDeviceName: string;
    RootDeviceType: string;
    SecurityGroups: {
        GroupName: string;
        GroupId: string;
    }[];
    SourceDestCheck: boolean;
    StateReason: {
        Code: string;
        Message: string;
    };
    Tags: {
        Key: string;
        Value: string;
    }[];
    VirtualizationType: string;
    CpuOptions: {
        CoreCount: number;
        ThreadsPerCore: number;
    };
    CapacityReservationSpecification: {
        CapacityReservationPreference: string;
    };
    HibernationOptions: {
        Configured: boolean;
    };
    MetadataOptions: {
        State: string;
        HttpTokens: string;
        HttpPutResponseHopLimit: number;
        HttpEndpoint: string;
        HttpProtocolIpv6: string;
        InstanceMetadataTags: string;
    };
    EnclaveOptions: {
        Enabled: boolean;
    };
    PlatformDetails: string;
    UsageOperation: string;
    UsageOperationUpdateTime: Date;
    PrivateDnsNameOptions: any;
    MaintenanceOptions: {
        AutoRecovery: string;
    };
    CurrentInstanceBootMode: string;
    environment: string
}

const EC2Schema = new Schema<IEC2>({
    AmiLaunchIndex: Number,
    ImageId: String,
    InstanceId: String,
    InstanceType: String,
    KeyName: String,
    LaunchTime: Date,
    Monitoring: {
        State: String,
    },
    Placement: {
        AvailabilityZone: String,
        GroupName: String,
        Tenancy: String,
    },
    PrivateDnsName: String,
    PrivateIpAddress: String,
    ProductCodes: [Schema.Types.Mixed],
    PublicDnsName: String,
    State: {
        Code: Number,
        Name: String,
    },
    StateTransitionReason: String,
    SubnetId: String,
    VpcId: String,
    Architecture: String,
    BlockDeviceMappings: [{
        DeviceName: String,
        Ebs: {
            AttachTime: Date,
            DeleteOnTermination: Boolean,
            Status: String,
            VolumeId: String,
        },
    }],
    ClientToken: String,
    EbsOptimized: Boolean,
    EnaSupport: Boolean,
    Hypervisor: String,
    NetworkInterfaces: [{
        Attachment: {
            AttachTime: Date,
            AttachmentId: String,
            DeleteOnTermination: Boolean,
            DeviceIndex: Number,
            Status: String,
            NetworkCardIndex: Number,
        },
        Description: String,
        Groups: [{
            GroupName: String,
            GroupId: String,
        }],
        Ipv6Addresses: [String],
        MacAddress: String,
        NetworkInterfaceId: String,
        OwnerId: String,
        PrivateDnsName: String,
        PrivateIpAddress: String,
        PrivateIpAddresses: [{
            Primary: Boolean,
            PrivateDnsName: String,
            PrivateIpAddress: String,
        }],
        SourceDestCheck: Boolean,
        Status: String,
        SubnetId: String,
        VpcId: String,
        InterfaceType: String,
    }],
    RootDeviceName: String,
    RootDeviceType: String,
    SecurityGroups: [{
        GroupName: String,
        GroupId: String,
    }],
    SourceDestCheck: Boolean,
    StateReason: {
        Code: String,
        Message: String,
    },
    Tags: [{
        Key: String,
        Value: String,
    }],
    VirtualizationType: String,
    CpuOptions: {
        CoreCount: Number,
        ThreadsPerCore: Number,
    },
    CapacityReservationSpecification: {
        CapacityReservationPreference: String,
    },
    HibernationOptions: {
        Configured: Boolean,
    },
    MetadataOptions: {
        State: String,
        HttpTokens: String,
        HttpPutResponseHopLimit: Number,
        HttpEndpoint: String,
        HttpProtocolIpv6: String,
        InstanceMetadataTags: String,
    },
    EnclaveOptions: {
        Enabled: Boolean,
    },
    PlatformDetails: String,
    UsageOperation: String,
    UsageOperationUpdateTime: Date,
    PrivateDnsNameOptions: Schema.Types.Mixed,
    MaintenanceOptions: {
        AutoRecovery: String,
    },
    CurrentInstanceBootMode: String,
    environment: String
},
    {
        versionKey: false,
        timestamps: true,
        collection: "ec2"
    });


console.log(encKey, "encKey");
console.log(sigKey, "sigKey");

console.log("Encryption key length:", Buffer.from(encKey, 'base64').length); // should be 32
console.log("Signing key length:", Buffer.from(sigKey, 'base64').length);     // should be 64

EC2Schema.plugin(mongooseEncryption, {
  encryptionKey: Buffer.from(encKey, "base64"),
  signingKey: Buffer.from(sigKey, "base64"),
  encryptedFields: [
    "AmiLaunchIndex",
    "ImageId",
    "InstanceType",
    "KeyName",
    "LaunchTime",
    "Monitoring",
    "Placement",
    "PrivateDnsName",
    "PrivateIpAddress",
    "ProductCodes",
    "PublicDnsName",
    "State",
    "StateTransitionReason",
    "SubnetId",
    "VpcId",
    "Architecture",
    "BlockDeviceMappings",
    "ClientToken",
    "EbsOptimized",
    "EnaSupport",
    "Hypervisor",
    "NetworkInterfaces",
    "RootDeviceName",
    "RootDeviceType",
    "SecurityGroups",
    "SourceDestCheck",
    "StateReason",
    "Tags",
    "VirtualizationType",
    "CpuOptions",
    "CapacityReservationSpecification",
    "HibernationOptions",
    "MetadataOptions",
    "EnclaveOptions",
    "PlatformDetails",
    "UsageOperation",
    "UsageOperationUpdateTime",
    "PrivateDnsNameOptions",
    "MaintenanceOptions",
    "CurrentInstanceBootMode",
  ],
  excludeFromEncryption: ["_id", "InstanceId", "createdAt", "updatedAt", "environment"]
});


export default model<IEC2>("ec2", EC2Schema);