import { choice, shortText } from "../prompt.js";
import { AccessId } from "../types.js";
import { sshReq } from "../utils.js";
import { do_create_deployment_agent } from "./hosting.js";
import { addToExecuteQueue, finish } from "../exitMessages.js";
import { outputGit } from "../printUtils.js";
import { Arr, Obj, Str } from "@merrymake/utils";
const SPECIAL_ROLES = ["Pending", "Build agent", "Deployment agent"];
export async function do_attach_role(user, accessId, accessEmail, duration) {
    try {
        const cmd = [
            `user-assign`,
            `\\"${user}\\"`,
            `--accessId`,
            accessId.toString(),
            `--accessEmail`,
            accessEmail,
        ];
        if (duration !== "")
            cmd.push(`--duration`, duration);
        outputGit(await sshReq(...cmd));
    }
    catch (e) {
        throw e;
    }
}
export async function do_auto_approve(domain, accessId) {
    try {
        outputGit(await sshReq(`preapprove-add`, `--accessId`, accessId.toString(), domain));
    }
    catch (e) {
        throw e;
    }
}
export async function do_remove_auto_approve(organizationId, domain) {
    try {
        outputGit(await sshReq(`preapprove-remove`, `--organizationId`, organizationId.toString(), domain));
    }
    catch (e) {
        throw e;
    }
}
function role_user_attach_role_expiry(user, accessId, accessEmail, duration) {
    addToExecuteQueue(() => do_attach_role(user, accessId, accessEmail, duration));
    return finish();
}
async function role_user_attach_role(user, accessId, accessEmail) {
    try {
        const duration = await shortText("Duration", "How long should the user have the role? Ex. 3 days", null);
        return role_user_attach_role_expiry(user, accessId, accessEmail, duration);
    }
    catch (e) {
        throw e;
    }
}
function role_auto_domain_role(domain, accessId) {
    addToExecuteQueue(() => do_auto_approve(domain, accessId));
    return finish();
}
function role_auto_remove(organizationId, domain) {
    addToExecuteQueue(() => do_remove_auto_approve(organizationId, domain));
    return finish();
}
let roleListCache;
export async function listRoles(organizationId) {
    if (roleListCache === undefined) {
        const resp = await sshReq(`role-list`, organizationId.toString());
        if (!resp.startsWith("["))
            throw resp;
        roleListCache = JSON.parse(resp);
    }
    return roleListCache;
}
async function role_user_attach(organizationId, user, accessEmail) {
    try {
        const roles = await listRoles(organizationId);
        const options = roles
            .filter((role) => !SPECIAL_ROLES.includes(role.name))
            .map((role) => {
            return {
                long: role.id,
                text: `${role.name} -- ${role.desc}`,
                action: () => role_user_attach_role(user, new AccessId(role.id), accessEmail),
            };
        });
        return await choice("Which role would you like to assign?", options).then((x) => x);
    }
    catch (e) {
        throw e;
    }
}
async function role_user(organizationId, user, accessEmail) {
    try {
        const roles = await listRoles(organizationId);
        const pendingId = roles.find((x) => x.name === "Pending").id;
        const options = [];
        options.push({
            long: `assign`,
            short: `a`,
            text: `assign an additional role to user`,
            action: () => role_user_attach(organizationId, user, accessEmail),
        });
        options.push({
            long: `remove`,
            short: `r`,
            text: `remove all roles and access`,
            action: () => role_user_attach_role(user, new AccessId(pendingId), accessEmail),
        });
        return await choice("What would you like to do?", options).then();
    }
    catch (e) {
        throw e;
    }
}
async function role_auto_new_domain(organizationId, domain) {
    try {
        const roles = await listRoles(organizationId);
        const options = roles
            .filter((role) => !SPECIAL_ROLES.includes(role.name))
            .map((role) => {
            return {
                long: role.id,
                text: `${role.name} -- ${role.desc}`,
                action: () => role_auto_domain_role(domain, new AccessId(role.id)),
            };
        });
        return await choice("Which role should new users get?", options).then((x) => x);
    }
    catch (e) {
        throw e;
    }
}
async function role_auto_new(organizationId) {
    try {
        const domain = await shortText("Domain", "Email domain to auto approve.", `@example.com`).then();
        return role_auto_new_domain(organizationId, domain);
    }
    catch (e) {
        throw e;
    }
}
async function role_auto(organizationId) {
    try {
        const resp = await sshReq(`preapprove-list`, organizationId.toString());
        const domains = JSON.parse(resp);
        const doms = {};
        domains.forEach((x) => {
            if (doms[x.domain] === undefined)
                doms[x.domain] = [];
            doms[x.domain].push(x.access);
        });
        const options = Object.keys(doms).map((domain) => {
            return {
                long: domain,
                text: `remove ${domain} (${doms[domain].join(", ")})`,
                action: () => role_auto_remove(organizationId, domain),
            };
        });
        options.push({
            long: `new`,
            short: `n`,
            text: `setup a new domain rule`,
            action: () => role_auto_new(organizationId),
        });
        return await choice("What would you like to do?", options).then();
    }
    catch (e) {
        throw e;
    }
}
async function service_user(organization) {
    try {
        const name = await shortText("Name", "Display name for the service user", `Service User`).then();
        const file = ".merrymake/" + Str.toFolderName(name) + ".key";
        addToExecuteQueue(() => do_create_deployment_agent(organization, name, file));
        return finish();
    }
    catch (e) {
        throw e;
    }
}
let activeUsersCache;
async function initializeCache(organizationId) {
    if (activeUsersCache === undefined) {
        const resp = await sshReq(`user-list`, organizationId.toString());
        outputGit(resp);
        if (!resp.startsWith("["))
            throw resp;
        const parsed = Arr.Sync.map(JSON.parse(resp), (u) => ({
            email: u.email,
            id: u.id,
            roleExpiry: Obj.Sync.filter(Obj.Sync.map(u.roleExpiry, (k, v) => v === null ? null : new Date(v)), (k, v) => v === null || v.getTime() > Date.now()),
        }));
        outputGit(JSON.stringify(parsed));
        activeUsersCache = Arr.Sync.partition(parsed, (x) => Obj.Sync.some(x.roleExpiry, (k, v) => k !== "Pending"));
    }
    return activeUsersCache;
}
export async function listActiveUsers(organizationId) {
    return (await initializeCache(organizationId)).yes;
}
export async function listPendingUsers(organizationId) {
    return (await initializeCache(organizationId)).no;
}
export async function pending(organization) {
    try {
        const users = await listPendingUsers(organization.id);
        const options = users.map((user) => {
            return {
                long: user.email,
                text: user.email,
                action: () => role_user(organization.id, user.id, user.email),
            };
        });
        return await choice("Which user would you like to allow?", options).then();
    }
    catch (e) {
        throw e;
    }
}
export async function role(organization) {
    try {
        const users = await listActiveUsers(organization.id);
        const options = users.map((user) => {
            return {
                long: user.id,
                text: `${user.email}: ${Obj.Sync.toArray(user.roleExpiry, (k, v) => k +
                    (v === null || v === undefined ? "" : ` (${v.toLocaleString()})`)).join(", ")}`,
                action: () => role_user(organization.id, user.id, user.email),
            };
        });
        // options.push({
        //   long: `new`,
        //   short: `n`,
        //   text: `create a new role`,
        //   action: () => role_new(org),
        // });
        options.push({
            long: `pending`,
            short: `p`,
            text: `see or allow pending users`,
            action: () => pending(organization),
        });
        options.push({
            long: `service`,
            short: `s`,
            text: `create a new service user`,
            action: () => service_user(organization),
        });
        options.push({
            long: `auto`,
            short: `a`,
            text: `configure domain auto approval`,
            action: () => role_auto(organization.id),
        });
        return await choice("Which user would you like to manage?", options).then();
    }
    catch (e) {
        throw e;
    }
}
