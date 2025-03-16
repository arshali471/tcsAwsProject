import { Schema, model, Document } from "mongoose";

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
},
{
    versionKey: false,
    timestamps: true,
    collection: "ec2"
});

export default model<IEC2>("ec2", EC2Schema);