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
exports.index = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const prompt_1 = require("../prompt");
const types_1 = require("../types");
const utils_1 = require("../utils");
const apikey_1 = require("./apikey");
const deploy_1 = require("./deploy");
const envvar_1 = require("./envvar");
const event_1 = require("./event");
const fetch_1 = require("./fetch");
const group_1 = require("./group");
const hosting_1 = require("./hosting");
const org_1 = require("./org");
const queue_1 = require("./queue");
const register_1 = require("./register");
const repo_1 = require("./repo");
const role_1 = require("./role");
function getContext() {
    return __awaiter(this, void 0, void 0, function* () {
        let repository;
        let serviceGroup;
        let organization;
        const cwd = process.cwd().split(/\/|\\/);
        let out = ".";
        for (let i = cwd.length - 1; i >= 0; i--) {
            if (fs_1.default.existsSync(path_1.default.join(out, "merrymake.json"))) {
                if (fs_1.default.existsSync(path_1.default.join(out, ".git"))) {
                    const repositoryUrl = yield (0, utils_1.execPromise)(`git ls-remote --get-url origin`);
                    const buffer = repositoryUrl.split("/");
                    repository = {
                        id: new types_1.RepositoryId(buffer[buffer.length - 1]),
                        pathTo: new types_1.PathToRepository(out),
                    };
                }
                // TODO bitbucket
            }
            else if (fs_1.default.existsSync(path_1.default.join(out, ".group-id"))) {
                serviceGroup = {
                    id: new types_1.ServiceGroupId(fs_1.default.readFileSync(path_1.default.join(out, ".group-id")).toString()),
                    pathTo: new types_1.PathToServiceGroup(out),
                };
            }
            else if (fs_1.default.existsSync(path_1.default.join(out, ".merrymake", "conf.json"))) {
                const orgFile = JSON.parse(fs_1.default.readFileSync(path_1.default.join(out, ".merrymake", "conf.json")).toString());
                organization = {
                    id: new types_1.OrganizationId(orgFile.organizationId),
                    pathTo: new types_1.PathToOrganization(out),
                };
                return { repository, serviceGroup, organization };
            }
            out += ".." + path_1.default.sep;
        }
        return {
            repository,
            serviceGroup,
            organization,
        };
    });
}
function index() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const options = [];
            const { repository, serviceGroup, organization } = yield getContext();
            if (fs_1.default.existsSync(`.git`)) {
                options.push({
                    long: "deploy",
                    short: "d",
                    text: "deploy service to the cloud",
                    weight: 900,
                    action: () => (0, deploy_1.deploy)(),
                });
            }
            if (serviceGroup !== undefined) {
                options.push({
                    long: "envvar",
                    short: "e",
                    text: "add or edit envvar for service group",
                    weight: 800,
                    action: () => (0, envvar_1.envvar)(organization.pathTo, organization.id, serviceGroup.id),
                }, {
                    long: "repo",
                    short: "r",
                    text: "add or edit repository",
                    weight: 700,
                    action: () => (0, repo_1.repo)(organization, serviceGroup),
                });
            }
            if (organization !== undefined) {
                if (serviceGroup === undefined) {
                    if (!fs_1.default.existsSync(organization.pathTo.with(hosting_1.BITBUCKET_FILE).toString())) {
                        options.push({
                            long: "fetch",
                            short: "f",
                            text: "fetch updates to service groups and repos",
                            weight: 600,
                            action: () => (0, fetch_1.fetch)(organization),
                        });
                        options.push({
                            long: "hosting",
                            short: "h",
                            text: "configure git hosting with bitbucket",
                            weight: 100,
                            action: () => (0, hosting_1.hosting)(organization),
                        });
                    }
                    options.push({
                        long: "group",
                        short: "g",
                        text: "create a service group",
                        weight: 500,
                        action: () => (0, group_1.group)(organization),
                    }, {
                        long: "role",
                        short: "o",
                        text: "add or assign roles to users in the organization",
                        weight: 200,
                        action: () => (0, role_1.role)(organization.id),
                    });
                }
                options.push({
                    long: "rapids",
                    short: "q",
                    text: "view or post messages to the rapids",
                    weight: 1000,
                    action: () => (0, queue_1.queue)(organization.id),
                }, {
                    long: "key",
                    short: "k",
                    text: "add or edit api-keys for the organization",
                    weight: 400,
                    action: () => (0, apikey_1.key)(organization.id),
                }, {
                    long: "event",
                    short: "v",
                    text: "allow or disallow events through api-keys for the organization",
                    weight: 300,
                    action: () => (0, event_1.event)(organization.id),
                });
            }
            else if (organization === undefined) {
                options.push({
                    long: "start",
                    text: "start for new user or new device",
                    weight: 900,
                    action: () => (0, register_1.register)(),
                }, {
                    long: "org",
                    short: "o",
                    text: "manage or checkout organizations",
                    weight: 500,
                    action: () => (0, org_1.orgAction)(),
                });
            }
            options.sort((a, b) => b.weight - a.weight);
            return (0, prompt_1.choice)("What would you like to do?", options);
        }
        catch (e) {
            throw e;
        }
    });
}
exports.index = index;
