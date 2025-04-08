import { SSHKeyDao } from "../lib/dao/sshKey.dao";


export class SSHKeyService {
    static async createSSHKey(payload: any) {
        return await SSHKeyDao.createSSHKey(payload);
    }

    static async getSSHkeyById(keyId: any) {
        return await SSHKeyDao.getSSHkeyById(keyId);
    }

    static async getSSHkeyByName(sshKeyName: string) {
        return await SSHKeyDao.getSSHkeyByName(sshKeyName);
    }

    static async getSshKeyByQuery(query: any, page: number, limit: number) {
        return await SSHKeyDao.getSshKeyByQuery(query, page, limit);
    }

    static async deleteSSHKey(id: any) {
        return await SSHKeyDao.deleteSSHKey(id);
    }

}


