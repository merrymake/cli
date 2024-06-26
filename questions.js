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
exports.start = void 0;
const fs_1 = __importDefault(require("fs"));
const apikey_1 = require("./newCommands/apikey");
const clone_1 = require("./commands/clone");
const deploy_1 = require("./newCommands/deploy");
const envvar_1 = require("./newCommands/envvar");
const event_1 = require("./newCommands/event");
const fetch_1 = require("./newCommands/fetch");
const group_1 = require("./commands/group");
const hosting_1 = require("./commands/hosting");
const org_1 = require("./commands/org");
const queue_1 = require("./commands/queue");
const quickstart_1 = require("./commands/quickstart");
const register_1 = require("./newCommands/register");
const repo_1 = require("./newCommands/repo");
const role_1 = require("./newCommands/role");
const executors_1 = require("./executors");
const prompt_1 = require("./prompt");
const utils_1 = require("./utils");
function help() {
    (0, utils_1.addToExecuteQueue)(() => (0, executors_1.do_help)());
    return (0, utils_1.finish)();
}
function spending(org) {
    (0, utils_1.addToExecuteQueue)(() => (0, executors_1.do_spending)(org));
    return (0, utils_1.finish)();
}
function delete_group_name(org, group) {
    (0, utils_1.addToExecuteQueue)(() => (0, executors_1.do_delete_group)(org, group));
    return (0, utils_1.finish)();
}
function delete_org_name(org) {
    (0, utils_1.addToExecuteQueue)(() => (0, executors_1.do_delete_org)(org));
    return (0, utils_1.finish)();
}
function extra(orgName, pathToRoot) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let options = [];
            options.push({
                long: "role",
                short: "o",
                text: "add or assign roles to users in the organization",
                action: () => (0, role_1.role)(orgName),
            });
            options.push({
                long: "usage",
                short: "u",
                text: "view usage breakdown for the last two months",
                action: () => spending(orgName),
            });
            options.push({
                long: "register",
                short: "e",
                text: "register an additional sshkey or email to account",
                action: () => (0, register_1.register)(),
            });
            if (!fs_1.default.existsSync(pathToRoot + hosting_1.BITBUCKET_FILE)) {
                options.push({
                    long: "hosting",
                    text: "configure git hosting with bitbucket", // TODO add github, gitlab, and azure devops
                    action: () => (0, hosting_1.hosting)(pathToRoot, orgName),
                });
            }
            options.push({
                long: "help",
                short: "h",
                text: "help diagnose potential issues",
                action: () => help(),
            });
            return yield (0, prompt_1.choice)("What would you like to do?", options).then();
        }
        catch (e) {
            throw e;
        }
    });
}
function delete_group(org) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let resp = yield (0, utils_1.sshReq)(`list-teams`, `--org`, org);
            let orgs = JSON.parse(resp);
            return yield (0, prompt_1.choice)("Which service GROUP do you want to delete?", orgs.map((x) => ({
                long: x,
                text: `delete ${x}`,
                action: () => delete_group_name(org, x),
            })), { disableAutoPick: true }).then();
        }
        catch (e) {
            throw e;
        }
    });
}
function delete_org() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let resp = yield (0, utils_1.sshReq)(`list-organizations`);
            let orgs = JSON.parse(resp);
            return yield (0, prompt_1.choice)("Which ORGANIZATION do you want to delete?", orgs.map((x) => ({
                long: x,
                text: `delete ${x}`,
                action: () => delete_org_name(x),
            })), { disableAutoPick: true }).then();
        }
        catch (e) {
            throw e;
        }
    });
}
function please_register_first() {
    (0, utils_1.addExitMessage)(`Please run '${process.env["COMMAND"]} register' first.`);
    return (0, utils_1.abort)();
}
function start() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let rawStruct = (0, utils_1.fetchOrgRaw)();
            if (rawStruct.org !== null) {
                let orgName = rawStruct.org.name;
                // If in org
                let options = [];
                let selectedGroup = null;
                let struct = {
                    org: rawStruct.org,
                    serviceGroup: rawStruct.serviceGroup !== null &&
                        !executors_1.SPECIAL_FOLDERS.includes(rawStruct.serviceGroup)
                        ? rawStruct.serviceGroup
                        : null,
                    inEventCatalogue: rawStruct.serviceGroup === "event-catalogue",
                    inPublic: rawStruct.serviceGroup === "public",
                    pathToRoot: rawStruct.pathToRoot,
                };
                if (struct.serviceGroup !== null) {
                    selectedGroup = {
                        name: struct.serviceGroup,
                        path: new utils_1.Path(struct.pathToRoot).withoutLastUp(),
                    };
                }
                else {
                    let serviceGroups = (0, utils_1.directoryNames)(new utils_1.Path(), [
                        "event-catalogue",
                        "public",
                    ]);
                    if (serviceGroups.length === 1) {
                        selectedGroup = {
                            name: serviceGroups[0].name,
                            path: new utils_1.Path(serviceGroups[0].name),
                        };
                    }
                }
                options.push({
                    long: "rapids",
                    short: "q",
                    text: "view or post messages to the rapids",
                    action: () => (0, queue_1.queue)(orgName, 0),
                });
                if (fs_1.default.existsSync("merrymake.json") ||
                    struct.inEventCatalogue ||
                    struct.inPublic) {
                    // Inside a service
                    options.push({
                        long: "deploy",
                        short: "d",
                        text: "deploy service to the cloud",
                        action: () => (0, deploy_1.deploy)(),
                    });
                    options.push({
                        long: "redeploy",
                        short: "r",
                        text: "redeploy service to the cloud",
                        action: () => (0, deploy_1.redeploy)(),
                    });
                }
                else {
                    // Not inside a service
                    options.push({
                        long: "fetch",
                        short: "f",
                        text: "fetch updates to service groups and repos",
                        action: () => (0, fetch_1.fetch)(),
                    });
                    if (selectedGroup !== null) {
                        // Inside a service group or has one service
                        let selectedGroup_hack = selectedGroup;
                        options.push({
                            long: "repo",
                            short: "r",
                            text: "add or edit repository",
                            action: () => (0, repo_1.repo)(selectedGroup_hack.path, orgName, selectedGroup_hack.name),
                        });
                    }
                }
                // if (fs.existsSync("merrymake.json")) {
                //   options.push({
                //     long: "build",
                //     short: "b",
                //     text: "build service locally",
                //     action: () => build(),
                //   });
                // }
                if (selectedGroup !== null) {
                    // Inside a service group or service
                    let selectedGroup_hack = selectedGroup;
                    options.push({
                        long: "envvar",
                        short: "e",
                        text: "add or edit envvar for service group",
                        action: () => (0, envvar_1.envvar)(orgName, selectedGroup_hack.name),
                    });
                }
                if (struct.serviceGroup === null) {
                    // In top level of organization
                    options.push({
                        long: "group",
                        short: "g",
                        text: "create a service group",
                        action: () => (0, group_1.group)(new utils_1.Path(), orgName),
                    });
                    options.push({
                        long: "delete",
                        short: "d",
                        text: "delete a service group",
                        action: () => delete_group(orgName),
                    });
                }
                // options.push({
                //   long: "cron",
                //   short: "c",
                //   text: "add or edit cron jobs for the organization",
                //   action: () => cron(orgName),
                // });
                options.push({
                    long: "key",
                    short: "k",
                    text: "add or edit api-keys for the organization",
                    action: () => (0, apikey_1.key)(orgName),
                });
                options.push({
                    long: "event",
                    short: "v",
                    text: "allow or disallow events through api-keys for the organization",
                    action: () => (0, event_1.event)(orgName),
                });
                options.push({
                    long: "other",
                    short: "o",
                    text: "other actions",
                    action: () => extra(orgName, struct.pathToRoot),
                });
                return yield (0, prompt_1.choice)("What would you like to do?", options).then();
            }
            else {
                let cache = (0, utils_1.getCache)();
                let options = [];
                options.push({
                    long: "register",
                    short: "r",
                    text: "register new device or email",
                    action: () => (0, register_1.register)(),
                    weight: !cache.registered ? 10 : 1,
                });
                options.push({
                    long: "quickstart",
                    text: "quickstart with auto registration and a standard demo organization",
                    action: () => (0, quickstart_1.quickstart)(),
                    weight: !cache.registered ? 15 : 2,
                });
                options.push({
                    long: "org",
                    short: "o",
                    text: "create a new organization",
                    action: () => (cache.registered ? (0, org_1.org)() : please_register_first()),
                    weight: 5,
                });
                options.push({
                    long: "clone",
                    short: "c",
                    text: "clone an existing organization",
                    action: () => (cache.registered ? (0, clone_1.checkout)() : please_register_first()),
                    weight: cache.hasOrgs ? 10 : 3,
                });
                options.push({
                    long: "delete",
                    short: "d",
                    text: "delete an organization",
                    action: () => cache.registered ? delete_org() : please_register_first(),
                    weight: cache.hasOrgs ? 10 : 3,
                });
                options.push({
                    long: "join",
                    short: "j",
                    text: "request to join an existing organization",
                    action: () => (cache.registered ? join() : please_register_first()),
                    weight: 4,
                });
                options.push({
                    long: "help",
                    text: "help diagnose potential issues",
                    action: () => help(),
                    weight: 0,
                });
                options.sort((a, b) => b.weight - a.weight);
                return yield (0, prompt_1.choice)("What would you like to do?", options).then();
            }
        }
        catch (e) {
            throw e;
        }
    });
}
exports.start = start;
