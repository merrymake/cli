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
exports.do_createOrganization = do_createOrganization;
exports.do_renameOrganization = do_renameOrganization;
exports.rename = rename;
exports.generateOrgName = generateOrgName;
exports.org = org;
exports.do_join = do_join;
exports.listOrgs = listOrgs;
exports.orgAction = orgAction;
const prompt_1 = require("../prompt");
const types_1 = require("../types");
const utils_1 = require("../utils");
const words_1 = require("../words");
const clone_1 = require("./clone");
const group_1 = require("./group");
function do_createOrganization(folderName, displayName) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const reply = yield (0, utils_1.sshReq)(`organization-create`, displayName);
            if (reply.length !== 8)
                throw reply;
            const organizationId = new types_1.OrganizationId(reply);
            yield (0, clone_1.do_clone)({}, folderName, displayName, organizationId);
            return organizationId;
        }
        catch (e) {
            throw e;
        }
    });
}
function do_renameOrganization(organizationId, displayName) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const reply = yield (0, utils_1.sshReq)(`organization-rename`, displayName, `--organizationId`, organizationId.toString());
        }
        catch (e) {
            throw e;
        }
    });
}
function rename(organizationId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const displayName = yield (0, prompt_1.shortText)("Organization name", "Used when collaborating with others.", "Acme Anvils").then();
            (0, utils_1.addToExecuteQueue)(() => do_renameOrganization(organizationId, displayName));
            return (0, utils_1.finish)();
        }
        catch (e) {
            throw e;
        }
    });
}
const characters = "abcdefghijklmnopqrstuvwxyz0123456789";
function generateString(length) {
    let result = "";
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}
function generateOrgName() {
    if (process.env["MERRYMAKE_NAME_LENGTH"] !== undefined &&
        !Number.isNaN(+process.env["MERRYMAKE_NAME_LENGTH"])) {
        const base = `org-${new Date().toLocaleDateString().replace(/\//g, "-")}-`;
        return (base + generateString(+process.env["MERRYMAKE_NAME_LENGTH"] - base.length));
    }
    else
        return (words_1.ADJECTIVE[~~(words_1.ADJECTIVE.length * Math.random())] +
            "-" +
            words_1.NOUN[~~(words_1.NOUN.length * Math.random())] +
            "-" +
            words_1.NOUN[~~(words_1.NOUN.length * Math.random())]);
}
function org() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const orgName = generateOrgName();
            const displayName = yield (0, prompt_1.shortText)("Organization name", "Used when collaborating with others.", orgName).then();
            const folderName = (0, utils_1.toFolderName)(displayName);
            const organizationId = yield do_createOrganization(folderName, displayName);
            return (0, group_1.group)({
                pathTo: new types_1.PathToOrganization(folderName),
                id: organizationId,
            });
        }
        catch (e) {
            throw e;
        }
    });
}
function do_join(org) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            (0, utils_1.output2)(yield (0, utils_1.sshReq)(`me-join`, org));
        }
        catch (e) {
            throw e;
        }
    });
}
function join_org(name) {
    // TODO join, wait, then checkout
    (0, utils_1.addToExecuteQueue)(() => do_join(name));
    return (0, utils_1.finish)();
}
function join() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const name = yield (0, prompt_1.shortText)("Organization to join", "Name of the organization you wish to request access to.", null).then();
            return join_org(name);
        }
        catch (e) {
            throw e;
        }
    });
}
let orgListCache;
function listOrgs() {
    return __awaiter(this, void 0, void 0, function* () {
        if (orgListCache === undefined) {
            const resp = yield (0, utils_1.sshReq)(`organization-list`);
            if (!resp.startsWith("["))
                throw resp;
            orgListCache = JSON.parse(resp);
        }
        return orgListCache;
    });
}
function orgAction() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const orgs = yield listOrgs();
            const options = [];
            if (orgs.length > 0) {
                options.push({
                    long: orgs[0].id,
                    text: `checkout ${orgs[0].name} (${orgs[0].id})`,
                    action: () => (0, clone_1.checkout_org)(orgs[0].name, new types_1.OrganizationId(orgs[0].id)),
                });
            }
            if (orgs.length > 1) {
                options.push({
                    long: "checkout",
                    short: "c",
                    text: `checkout another organization`,
                    action: () => (0, clone_1.checkout)(),
                });
            }
            options.push({
                long: "new",
                short: "n",
                text: `create new organization`,
                action: () => org(),
            });
            options.push({
                long: "join",
                short: "j",
                text: `join an existing organization`,
                action: () => join(),
            });
            return (0, prompt_1.choice)("Which organization will you work with?", options);
        }
        catch (e) {
            throw e;
        }
    });
}
