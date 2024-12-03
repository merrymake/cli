import fs from "fs";
import { GIT_HOST } from "../config.js";
import { choice } from "../prompt.js";
import { OrganizationId, PathToOrganization } from "../types.js";
import { addToExecuteQueue, execPromise, finish, outputGit, sshReq, toFolderName, } from "../utils.js";
import { ensureGroupStructure } from "./fetch.js";
import { listOrgs } from "./org.js";
export async function do_clone(struct, folderName, displayName, organizationId) {
    try {
        outputGit(`Cloning ${displayName}...`);
        fs.mkdirSync(`${folderName}/.merrymake`, { recursive: true });
        const orgFile = { organizationId: organizationId.toString() };
        fs.writeFileSync(`${folderName}/.merrymake/conf.json`, JSON.stringify(orgFile));
        const eventsDir = `${folderName}/event-catalogue`;
        fs.mkdirSync(eventsDir, { recursive: true });
        await execPromise(`git init --initial-branch=main`, eventsDir);
        await execPromise(`git remote add origin "${GIT_HOST}/o${organizationId}/event-catalogue"`, eventsDir);
        fs.writeFileSync(eventsDir + "/api.json", "{}");
        fs.writeFileSync(eventsDir + "/cron.json", "{}");
        const publicDir = `${folderName}/public`;
        fs.mkdirSync(publicDir, { recursive: true });
        await execPromise(`git init --initial-branch=main`, publicDir);
        await execPromise(`git remote add origin "${GIT_HOST}/o${organizationId}/public"`, publicDir);
        fs.writeFileSync(publicDir + "/index.html", "<html><body>Hello, World!</body></html>");
        await ensureGroupStructure({ pathTo: new PathToOrganization(folderName), id: organizationId }, struct);
    }
    catch (e) {
        throw e;
    }
}
export async function do_fetch_clone(displayName, folderName, organizationId) {
    try {
        const reply = await sshReq(`organization-fetch`, organizationId.toString());
        if (!reply.startsWith("{"))
            throw reply;
        const structure = JSON.parse(reply);
        await do_clone(structure, folderName, displayName, organizationId);
    }
    catch (e) {
        throw e;
    }
}
export async function checkout_org(displayName, organizationId) {
    const folderName = toFolderName(displayName);
    if (fs.existsSync(folderName)) {
        throw `Folder '${folderName}' already exists.`;
    }
    addToExecuteQueue(() => do_fetch_clone(displayName, folderName, organizationId));
    return finish();
}
export async function checkout() {
    try {
        const orgs = await listOrgs();
        return choice("Which organization would you like to clone?", orgs.map((org) => ({
            long: org.id,
            text: `${org.name} (${org.id})`,
            action: () => checkout_org(org.name, new OrganizationId(org.id)),
        })));
    }
    catch (e) {
        throw e;
    }
}
