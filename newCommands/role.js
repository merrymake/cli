import { choice, shortText } from "../prompt.js";
import { AccessId } from "../types.js";
import { addToExecuteQueue, finish, outputGit, sshReq, toFolderName, } from "../utils.js";
import { do_create_deployment_agent } from "./hosting.js";
const SPECIAL_ROLES = ["Pending", "Build agent", "Deployment agent"];
export async function do_attach_role(user, accessId) {
    try {
        outputGit(await sshReq(`user-assign`, user, `--accessId`, accessId.toString()));
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
function role_user_attach_role(user, accessId) {
    addToExecuteQueue(() => do_attach_role(user, accessId));
    return finish();
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
async function role_user_attach(organizationId, user) {
    try {
        const roles = await listRoles(organizationId);
        const options = roles
            .filter((role) => !SPECIAL_ROLES.includes(role.name))
            .map((role) => {
            return {
                long: role.id,
                text: `assign ${role.name} (${role.id})`,
                action: () => role_user_attach_role(user, new AccessId(role.id)),
            };
        });
        return await choice("Which role would you like to assign?", options).then((x) => x);
    }
    catch (e) {
        throw e;
    }
}
async function role_user(organizationId, user) {
    try {
        const roles = await listRoles(organizationId);
        const pendingId = roles.find((x) => x.name === "Pending").id;
        const options = [];
        options.push({
            long: `assign`,
            short: `a`,
            text: `assign an additional role to user`,
            action: () => role_user_attach(organizationId, user),
        });
        options.push({
            long: `remove`,
            short: `r`,
            text: `remove all roles and access`,
            action: () => role_user_attach_role(user, new AccessId(pendingId)),
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
                text: `auto assign ${role.name} (${role.id})`,
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
        const file = ".merrymake/" + toFolderName(name) + ".key";
        addToExecuteQueue(() => do_create_deployment_agent(organization, name, file));
        return finish();
    }
    catch (e) {
        throw e;
    }
}
let userListCache;
export async function listUsers(organizationId) {
    if (userListCache === undefined) {
        const resp = await sshReq(`user-list`, organizationId.toString());
        if (!resp.startsWith("["))
            throw resp;
        userListCache = JSON.parse(resp);
    }
    return userListCache;
}
export async function pending(organization) {
    try {
        const users = await listUsers(organization.id);
        const options = users
            .filter((u) => u.roles[0] === "Pending")
            .map((user) => {
            return {
                long: user.email,
                text: `${user.email}: ${user.roles}`,
                action: () => role_user(organization.id, user.id),
            };
        });
        return await choice("Which user do you want to allow?", options).then();
    }
    catch (e) {
        throw e;
    }
}
export async function role(organization) {
    try {
        const users = await listUsers(organization.id);
        const options = users
            .filter((u) => u.roles[0] !== "Pending")
            .map((user) => {
            return {
                long: user.email,
                text: `${user.email}: ${user.roles}`,
                action: () => role_user(organization.id, user.id),
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
        return await choice("Which user do you want to manage?", options).then();
    }
    catch (e) {
        throw e;
    }
}
