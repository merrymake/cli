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
exports.fetch = exports.ensureGroupStructure = void 0;
const fs_1 = __importDefault(require("fs"));
const utils_1 = require("../utils");
const config_1 = require("../config");
const types_1 = require("../types");
function getCurrentStructure(pathToOrganization) {
    const folders = (0, utils_1.directoryNames)(pathToOrganization, [
        "event-catalogue",
        "public",
    ]);
    const groups = {};
    folders.forEach((f) => {
        const pathToGroup = pathToOrganization.with(f.name);
        if (fs_1.default.existsSync(pathToGroup.with(".group-id").toString())) {
            const groupId = fs_1.default
                .readFileSync(pathToGroup.with(".group-id").toString())
                .toString();
            const repositories = {};
            groups[groupId] = { name: f.name, repositories };
            const folders = (0, utils_1.directoryNames)(pathToGroup, []);
            folders.forEach((f) => __awaiter(this, void 0, void 0, function* () {
                if (fs_1.default.existsSync(pathToGroup.with(f.name).with(".git").toString())) {
                    const repositoryUrl = yield (0, utils_1.execPromise)(`git ls-remote --get-url origin`);
                    const repositoryId = repositoryUrl.substring(repositoryUrl.lastIndexOf("/"));
                    repositories[repositoryId] = f.name;
                }
                else {
                    // TODO Get from bitbucket file?
                }
            }));
        }
    });
    return groups;
}
function ensureRepositoryStructure(pathToGroup, organizationId, serviceGroupId, toBe, asIs) {
    Object.keys(toBe).forEach((repositoryId) => {
        const repositoryDisplayName = toBe[repositoryId];
        const folderName = (0, utils_1.toFolderName)(repositoryDisplayName);
        const pathToRepository = pathToGroup.with(folderName);
        if (asIs[repositoryId] !== folderName) {
            fs_1.default.renameSync(pathToGroup.with(asIs[repositoryId]).toString(), pathToRepository.toString());
        }
        createServiceFolder(pathToRepository, organizationId, serviceGroupId, new types_1.RepositoryId(repositoryId));
        delete asIs[repositoryId];
    });
    Object.keys(asIs).forEach((repositoryId) => {
        const folderName = asIs[repositoryId];
        // TODO Delete
        console.log("Delete", pathToGroup.with(folderName).toString());
    });
}
function ensureGroupStructure(pathToOrganization, organizationId, toBe) {
    const asIs = getCurrentStructure(pathToOrganization);
    Object.keys(toBe).forEach((serviceGroupId) => {
        const group = toBe[serviceGroupId];
        const folderName = (0, utils_1.toFolderName)(group.displayName);
        const pathToGroup = pathToOrganization.with(folderName);
        let asIsRepos;
        if (asIs[serviceGroupId] === undefined) {
            fs_1.default.mkdirSync(pathToGroup.toString(), { recursive: true });
            fs_1.default.writeFileSync(pathToGroup.with(".group-id").toString(), serviceGroupId);
            asIsRepos = {};
        }
        else {
            if (asIs[serviceGroupId].name !== folderName) {
                fs_1.default.renameSync(pathToOrganization.with(asIs[serviceGroupId].name).toString(), pathToGroup.toString());
            }
            asIsRepos = asIs[serviceGroupId].repositories;
        }
        ensureRepositoryStructure(pathToGroup, organizationId, new types_1.ServiceGroupId(serviceGroupId), group.repositories, asIsRepos);
        delete asIs[serviceGroupId];
    });
    Object.keys(asIs).forEach((groupId) => {
        const group = asIs[groupId];
        const folderName = group.name;
        // TODO Delete
        console.log("Delete", pathToOrganization.with(folderName).toString());
    });
}
exports.ensureGroupStructure = ensureGroupStructure;
function createServiceFolder(path, organizationId, groupId, repositoryId) {
    return __awaiter(this, void 0, void 0, function* () {
        const dir = path.toString();
        let repo = `"${config_1.GIT_HOST}/o${organizationId}/g${groupId}/r${repositoryId}"`;
        try {
            if (!fs_1.default.existsSync(dir)) {
                fs_1.default.mkdirSync(dir, { recursive: true });
            }
            if (!fs_1.default.existsSync(dir + "/.git")) {
                yield (0, utils_1.execPromise)(`git init --initial-branch=main`, dir);
                yield (0, utils_1.execPromise)(`git remote add origin ${repo}`, dir);
                fs_1.default.writeFileSync(dir + "/fetch.bat", `@echo off
git fetch
git reset --hard origin/main
del fetch.sh
(goto) 2>nul & del fetch.bat`);
                fs_1.default.writeFileSync(dir + "/fetch.sh", `#!/bin/sh
git fetch
git reset --hard origin/main
rm fetch.bat fetch.sh`, {});
                fs_1.default.chmodSync(dir + "/fetch.sh", "755");
            }
            else {
                yield (0, utils_1.execPromise)(`git remote set-url origin ${repo}`, dir);
            }
        }
        catch (e) {
            console.log(e);
        }
    });
}
function do_fetch(pathToOrganization, organizationId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let reply = yield (0, utils_1.sshReq)(`organization-fetch`, organizationId.toString());
            if (!reply.startsWith("{"))
                throw reply;
            (0, utils_1.output2)(`Fetching...`);
            let structure = JSON.parse(reply);
            ensureGroupStructure(pathToOrganization, organizationId, structure);
        }
        catch (e) {
            throw e;
        }
    });
}
function fetch(pathToOrganization, organizationId) {
    (0, utils_1.addToExecuteQueue)(() => do_fetch(pathToOrganization, organizationId));
    return (0, utils_1.finish)();
}
exports.fetch = fetch;
