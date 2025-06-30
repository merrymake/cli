import { Str } from "@merrymake/utils";
import { existsSync } from "fs";
import { mkdir, rename, writeFile } from "fs/promises";
import { SERVICE_GROUP } from "../config.js";
import { isDryrun } from "../dryrun.js";
import { finish } from "../exitMessages.js";
import { outputGit } from "../printUtils.js";
import { choice, output, resetCommand, shortText } from "../prompt.js";
import { PathToServiceGroup, ServiceGroupId, } from "../types.js";
import { sshReq } from "../utils.js";
import { repo_create } from "./repo.js";
export async function do_deleteServiceGroup(serviceGroup, displayName) {
    if (isDryrun()) {
        output(`DRYRUN: Would delete ${SERVICE_GROUP}`);
        return;
    }
    try {
        outputGit(`Deleting ${SERVICE_GROUP} '${displayName}'...`);
        const reply = await sshReq(`group-delete`, serviceGroup.id.toString());
        outputGit(reply);
        if (existsSync(serviceGroup.pathTo.toString()))
            await rename(serviceGroup.pathTo.toString(), `(deleted) ${serviceGroup.pathTo}`);
    }
    catch (e) {
        throw e;
    }
}
async function deleteServiceGroupId(serviceGroup, displayName) {
    await do_deleteServiceGroup(serviceGroup, displayName);
    return finish();
}
export async function deleteServiceGroup(organization) {
    try {
        return await choice([], async () => {
            const resp = await sshReq(`group-list`, organization.id.toString());
            if (!resp.startsWith("["))
                throw resp;
            const groups = JSON.parse(resp);
            const options = groups.map((group) => {
                const folderName = Str.toFolderName(group.name);
                return {
                    long: folderName,
                    text: `Delete ${SERVICE_GROUP} ${group.name} permanently`,
                    action: () => deleteServiceGroupId({
                        id: new ServiceGroupId(group.id),
                        pathTo: new PathToServiceGroup(organization.pathTo, folderName),
                    }, group.name),
                };
            });
            return {
                options,
                header: `Which ${SERVICE_GROUP} would you like to delete?`,
            };
        }).then();
    }
    catch (e) {
        throw e;
    }
}
export async function do_createServiceGroup(path, organizationId, displayName) {
    if (isDryrun()) {
        output(`DRYRUN: Would create ${SERVICE_GROUP}`);
        return new ServiceGroupId("dryrun_id");
    }
    try {
        outputGit(`Creating ${SERVICE_GROUP} '${displayName}'...`);
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
export async function group_new(organization) {
    try {
        resetCommand("group new");
        let num = 1;
        while (existsSync(organization.pathTo.with("service-group-" + num).toString()))
            num++;
        const displayName = await shortText(`${SERVICE_GROUP[0].toUpperCase() + SERVICE_GROUP.substring(1)} name`, "Used to share envvars.", "service-group-" + num).then();
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
export async function do_renameServiceGroup(oldPathToServiceGroup, newServiceGroup, newDisplayName) {
    if (isDryrun()) {
        output(`DRYRUN: Would rename ${SERVICE_GROUP}`);
        return;
    }
    try {
        outputGit(`Renaming ${SERVICE_GROUP} to '${newDisplayName}'...`);
        const reply = await sshReq(`group-modify`, `--displayName`, newDisplayName, newServiceGroup.id.toString());
        if (existsSync(oldPathToServiceGroup.toString()))
            await rename(oldPathToServiceGroup.toString(), newServiceGroup.pathTo.toString());
    }
    catch (e) {
        throw e;
    }
}
async function group_edit_rename(oldPathToServiceGroup, oldDisplayName, serviceGroupId) {
    try {
        const newDisplayName = await shortText(`${SERVICE_GROUP[0].toUpperCase() + SERVICE_GROUP.substring(1)} name`, "Used to share envvars.", oldDisplayName).then();
        const folderName = Str.toFolderName(newDisplayName);
        const newPathToServiceGroup = oldPathToServiceGroup
            .parent()
            .with(folderName);
        await do_renameServiceGroup(oldPathToServiceGroup, { pathTo: newPathToServiceGroup, id: serviceGroupId }, newDisplayName);
        return finish();
    }
    catch (e) {
        throw e;
    }
}
async function group_edit(serviceGroup, displayName) {
    try {
        return await choice([
            {
                long: "rename",
                text: `rename ${SERVICE_GROUP}`,
                action: () => group_edit_rename(serviceGroup.pathTo, displayName, serviceGroup.id),
            },
            {
                long: "delete",
                text: `delete ${SERVICE_GROUP} '${displayName}' permanently`,
                action: () => deleteServiceGroupId(serviceGroup, displayName),
            },
        ], async () => {
            return {
                options: [],
                header: `How would you like to edit the ${SERVICE_GROUP}?`,
            };
        }).then((x) => x);
    }
    catch (e) {
        throw e;
    }
}
export async function group(organization) {
    try {
        return await choice([
            {
                long: "new",
                short: "n",
                text: `create a new ${SERVICE_GROUP}`,
                action: () => group_new(organization),
            },
        ], async () => {
            const resp = await sshReq(`group-list`, organization.id.toString());
            if (!resp.startsWith("["))
                throw resp;
            const groups = JSON.parse(resp);
            const options = groups.map((group) => {
                const folderName = Str.toFolderName(group.name);
                return {
                    long: folderName,
                    text: `edit '${group.name}'`,
                    action: () => group_edit({
                        id: new ServiceGroupId(group.id),
                        pathTo: new PathToServiceGroup(organization.pathTo, folderName),
                    }, group.name),
                };
            });
            return {
                options,
                header: `Which ${SERVICE_GROUP} would you like to manage?`,
            };
        }).then();
    }
    catch (e) {
        throw e;
    }
}
