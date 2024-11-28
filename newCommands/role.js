"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.do_attach_role = do_attach_role;
exports.do_auto_approve = do_auto_approve;
exports.do_remove_auto_approve = do_remove_auto_approve;
exports.listRoles = listRoles;
exports.role = role;
const prompt_1 = require("../prompt");
const types_1 = require("../types");
const utils_1 = require("../utils");
const hosting_1 = require("./hosting");
const SPECIAL_ROLES = ["Pending", "Build agent", "Deployment agent"];
function do_attach_role(user, accessId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            (0, utils_1.output2)(yield (0, utils_1.sshReq)(`user-assign`, user, `--accessId`, accessId.toString()));
        }
        catch (e) {
            throw e;
        }
    });
}
function do_auto_approve(domain, accessId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            (0, utils_1.output2)(yield (0, utils_1.sshReq)(`preapprove-add`, `--accessId`, accessId.toString(), domain));
        }
        catch (e) {
            throw e;
        }
    });
}
function do_remove_auto_approve(organizationId, domain) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            (0, utils_1.output2)(yield (0, utils_1.sshReq)(`preapprove-remove`, `--organizationId`, organizationId.toString(), domain));
        }
        catch (e) {
            throw e;
        }
    });
}
function role_user_attach_role(user, accessId) {
    (0, utils_1.addToExecuteQueue)(() => do_attach_role(user, accessId));
    return (0, utils_1.finish)();
}
function role_auto_domain_role(domain, accessId) {
    (0, utils_1.addToExecuteQueue)(() => do_auto_approve(domain, accessId));
    return (0, utils_1.finish)();
}
function role_auto_remove(organizationId, domain) {
    (0, utils_1.addToExecuteQueue)(() => do_remove_auto_approve(organizationId, domain));
    return (0, utils_1.finish)();
}
let roleListCache;
function listRoles(organizationId) {
    return __awaiter(this, void 0, void 0, function* () {
        if (roleListCache === undefined) {
            const resp = yield (0, utils_1.sshReq)(`role-list`, organizationId.toString());
            if (!resp.startsWith("["))
                throw resp;
            roleListCache = JSON.parse(resp);
        }
        return roleListCache;
    });
}
function role_user_attach(organizationId, user) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const roles = yield listRoles(organizationId);
            const options = roles
                .filter((role) => !SPECIAL_ROLES.includes(role.name))
                .map((role) => {
                return {
                    long: role.id,
                    text: `assign ${role.name} (${role.id})`,
                    action: () => role_user_attach_role(user, new types_1.AccessId(role.id)),
                };
            });
            return yield (0, prompt_1.choice)("Which role would you like to assign?", options).then((x) => x);
        }
        catch (e) {
            throw e;
        }
    });
}
function role_user(organizationId, user) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const roles = yield listRoles(organizationId);
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
                action: () => role_user_attach_role(user, new types_1.AccessId(pendingId)),
            });
            return yield (0, prompt_1.choice)("What would you like to do?", options).then();
        }
        catch (e) {
            throw e;
        }
    });
}
function role_auto_new_domain(organizationId, domain) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const roles = yield listRoles(organizationId);
            const options = roles
                .filter((role) => !SPECIAL_ROLES.includes(role.name))
                .map((role) => {
                return {
                    long: role.id,
                    text: `auto assign ${role.name} (${role.id})`,
                    action: () => role_auto_domain_role(domain, new types_1.AccessId(role.id)),
                };
            });
            return yield (0, prompt_1.choice)("Which role should new users get?", options).then((x) => x);
        }
        catch (e) {
            throw e;
        }
    });
}
function role_auto_new(organizationId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const domain = yield (0, prompt_1.shortText)("Domain", "Email domain to auto approve.", `@example.com`).then();
            return role_auto_new_domain(organizationId, domain);
        }
        catch (e) {
            throw e;
        }
    });
}
function role_auto(organizationId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const resp = yield (0, utils_1.sshReq)(`preapprove-list`, organizationId.toString());
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
            return yield (0, prompt_1.choice)("What would you like to do?", options).then();
        }
        catch (e) {
            throw e;
        }
    });
}
function service_user(organization) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const name = yield (0, prompt_1.shortText)("Name", "Display name for the service user", `Service User`).then();
            const file = ".merrymake/" + (0, utils_1.toFolderName)(name) + ".key";
            (0, utils_1.addToExecuteQueue)(() => (0, hosting_1.do_create_deployment_agent)(organization, name, file));
            return (0, utils_1.finish)();
        }
        catch (e) {
            throw e;
        }
    });
}
function role(organization) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const resp = yield (0, utils_1.sshReq)(`user-list`, organization.toString());
            const users = JSON.parse(resp);
            const options = users.map((user) => {
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
            return yield (0, prompt_1.choice)("Which user do you want to manage?", options).then((x) => x);
        }
        catch (e) {
            throw e;
        }
    });
}
