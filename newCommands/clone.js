import { Str } from "@merrymake/utils";
import { existsSync } from "fs";
import { mkdir, writeFile } from "fs/promises";
import { GIT_HOST } from "../config.js";
import { addToExecuteQueue, finish } from "../exitMessages.js";
import { outputGit } from "../printUtils.js";
import { choice } from "../prompt.js";
import { OrganizationId, PathToOrganization } from "../types.js";
import { execPromise, sshReq, toSubdomain } from "../utils.js";
import { ensureGroupStructure } from "./fetch.js";
import { listOrgs } from "./org.js";
export async function do_clone(struct, folderName, displayName, organizationId) {
    try {
        outputGit(`Cloning ${displayName}...`);
        await mkdir(`${folderName}/.merrymake`, { recursive: true });
        const orgFile = { organizationId: organizationId.toString() };
        await writeFile(`${folderName}/.merrymake/conf.json`, JSON.stringify(orgFile));
        const eventsDir = `${folderName}/event-configuration`;
        await mkdir(eventsDir, { recursive: true });
        await execPromise(`git init --initial-branch=main`, eventsDir);
        await execPromise(`git remote add origin "${GIT_HOST}/o${organizationId}/event-catalogue"`, eventsDir);
        try {
            await execPromise(`git pull origin main`, eventsDir);
            await execPromise(`git branch --set-upstream-to=origin/main`, eventsDir);
        }
        catch (e) {
            if (!existsSync(eventsDir + "/api.json"))
                await writeFile(eventsDir + "/api.json", "{}");
            if (!existsSync(eventsDir + "/cron.json"))
                await writeFile(eventsDir + "/cron.json", "{}");
        }
        const publicDir = `${folderName}/front-end`;
        await mkdir(publicDir, { recursive: true });
        await execPromise(`git init --initial-branch=main`, publicDir);
        await execPromise(`git remote add origin "${GIT_HOST}/o${organizationId}/public"`, publicDir);
        try {
            await execPromise(`git pull origin main`, publicDir);
            await execPromise(`git branch --set-upstream-to=origin/main`, publicDir);
        }
        catch (e) {
            if (!existsSync(publicDir + "/index.html"))
                await writeFile(publicDir + "/index.html", "<html><body>Hello, World!</body></html>");
        }
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
    const folderName = Str.toFolderName(displayName);
    if (existsSync(folderName)) {
        throw `Folder '${folderName}' already exists.`;
    }
    addToExecuteQueue(() => do_fetch_clone(displayName, folderName, organizationId));
    return finish();
}
export async function checkout() {
    try {
        return choice([], async () => {
            const orgs = await listOrgs();
            return {
                options: orgs.map((org) => ({
                    long: org.id,
                    text: `${org.name}`,
                    action: () => checkout_org(org.name, new OrganizationId(org.id)),
                })),
                header: "Which organization would you like to clone?",
            };
        });
    }
    catch (e) {
        throw e;
    }
}
export async function checkoutName(name) {
    try {
        const subdomain = toSubdomain(name);
        const org = (await listOrgs()).find((x) => toSubdomain(x.name) === subdomain);
        if (org === undefined)
            return checkout();
        else
            return checkout_org(org.name, new OrganizationId(org.id));
    }
    catch (e) {
        throw e;
    }
}
