import { Str } from "@merrymake/utils";
import { existsSync } from "fs";
import { mkdir, rename, writeFile } from "fs/promises";
import { addToExecuteQueue, finish } from "../exitMessages.js";
import { choice, shortText } from "../prompt.js";
import { PathToServiceGroup, ServiceGroupId, } from "../types.js";
import { sshReq } from "../utils.js";
import { repo_create } from "./repo.js";
export async function do_deleteServiceGroup(serviceGroup, displayName) {
    try {
        console.log(`Deleting service group '${displayName}'...`);
        const reply = await sshReq(`group-delete`, serviceGroup.id.toString());
        console.log(reply);
        if (existsSync(serviceGroup.pathTo.toString()))
            await rename(serviceGroup.pathTo.toString(), `(deleted) ${serviceGroup.pathTo}`);
    }
    catch (e) {
        throw e;
    }
}
function deleteServiceGroupId(serviceGroup, displayName) {
    addToExecuteQueue(async () => do_deleteServiceGroup(serviceGroup, displayName));
    return finish();
}
export async function deleteServiceGroup(organizationId) {
    try {
        const resp = await sshReq(`group-list`, organizationId.toString());
        if (!resp.startsWith("["))
            throw resp;
        const groups = JSON.parse(resp);
        const options = groups.map((group) => {
            const folderName = Str.toFolderName(group.name);
            return {
                long: folderName,
                text: `Delete ${group.name} (${folderName})`,
                action: () => deleteServiceGroupId({
                    id: new ServiceGroupId(group.id),
                    pathTo: new PathToServiceGroup(folderName),
                }, group.name),
            };
        });
        return await choice("Which service group would you like to delete?", options).then();
    }
    catch (e) {
        throw e;
    }
}
export async function do_createServiceGroup(path, organizationId, displayName) {
    try {
        console.log(`Creating service group '${displayName}'...`);
        const reply = await sshReq(`group-create`, displayName, `--organizationId`, organizationId.toString());
        if (reply.length !== 8)
            throw reply;
        await mkdir(path.toString(), { recursive: true });
        const serviceGroupId = new ServiceGroupId(reply);
        await writeFile(path.with(".group-id").toString(), serviceGroupId.toString());
        return serviceGroupId;
    }
    catch (e) {
        throw e;
    }
}
export async function group(organization) {
    try {
        let num = 1;
        while (existsSync(organization.pathTo.with("service-group-" + num).toString()))
            num++;
        const displayName = await shortText("Service group name", "Used to share envvars.", "service-group-" + num).then();
        const folderName = Str.toFolderName(displayName);
        const pathToServiceGroup = organization.pathTo.with(folderName);
        const serviceGroupId = await do_createServiceGroup(pathToServiceGroup, organization.id, displayName);
        return repo_create(organization, {
            pathTo: pathToServiceGroup,
            id: serviceGroupId,
        });
    }
    catch (e) {
        throw e;
    }
}
