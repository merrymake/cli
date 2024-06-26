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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkout = exports.checkout_org = exports.do_fetch_clone = exports.do_clone = void 0;
const fs_1 = __importDefault(require("fs"));
const config_1 = require("../config");
const prompt_1 = require("../prompt");
const utils_1 = require("../utils");
const fetch_1 = require("./fetch");
const org_1 = require("./org");
const types_1 = require("../types");
function do_clone(struct, folderName, displayName, organizationId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            (0, utils_1.output2)(`Cloning ${displayName}...`);
            fs_1.default.mkdirSync(`${folderName}/.merrymake`, { recursive: true });
            let orgFile = { organizationId: organizationId.toString() };
            fs_1.default.writeFileSync(`${folderName}/.merrymake/conf.json`, JSON.stringify(orgFile));
            let eventsDir = `${folderName}/event-catalogue`;
            fs_1.default.mkdirSync(eventsDir, { recursive: true });
            yield (0, utils_1.execPromise)(`git init --initial-branch=main`, eventsDir);
            yield (0, utils_1.execPromise)(`git remote add origin "${config_1.GIT_HOST}/o${organizationId}/event-catalogue"`, eventsDir);
            let publicDir = `${folderName}/public`;
            fs_1.default.mkdirSync(publicDir, { recursive: true });
            yield (0, utils_1.execPromise)(`git init --initial-branch=main`, publicDir);
            yield (0, utils_1.execPromise)(`git remote add origin "${config_1.GIT_HOST}/o${organizationId}/public"`, publicDir);
            (0, fetch_1.ensureGroupStructure)(new utils_1.Path(folderName), organizationId, struct);
        }
        catch (e) {
            throw e;
        }
    });
}
exports.do_clone = do_clone;
function do_fetch_clone(displayName, organizationId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let reply = yield (0, utils_1.sshReq)(`organization-fetch`, organizationId.toString());
            if (!reply.startsWith("{"))
                throw reply;
            let structure = JSON.parse(reply);
            const folderName = (0, utils_1.toFolderName)(displayName);
            yield do_clone(structure, folderName, displayName, organizationId);
        }
        catch (e) {
            throw e;
        }
    });
}
exports.do_fetch_clone = do_fetch_clone;
function checkout_org(displayName, organizationId) {
    (0, utils_1.addToExecuteQueue)(() => do_fetch_clone(displayName, organizationId));
    return (0, utils_1.finish)();
}
exports.checkout_org = checkout_org;
function checkout() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let orgs = yield (0, org_1.listOrgs)();
            return (0, prompt_1.choice)("Which organization would you like to clone?", orgs.map((org) => ({
                long: org.id,
                text: `${org.name} (${org.id})`,
                action: () => checkout_org(org.name, new types_1.OrganizationId(org.id)),
            })));
        }
        catch (e) {
            throw e;
        }
    });
}
exports.checkout = checkout;
