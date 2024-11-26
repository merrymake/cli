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
exports.fetch = exports.do_fetch = exports.ensureGroupStructure = void 0;
const fs_1 = __importDefault(require("fs"));
const config_1 = require("../config");
const types_1 = require("../types");
const utils_1 = require("../utils");
function getCurrentStructure(pathToOrganization) {
    return __awaiter(this, void 0, void 0, function* () {
        const folders = (0, utils_1.directoryNames)(pathToOrganization, [
            "event-catalogue",
            "public",
        ]);
        const groups = {};
        yield Promise.all(folders.map((f) => {
            const pathToGroup = pathToOrganization.with(f.name);
            if (fs_1.default.existsSync(pathToGroup.with(".group-id").toString())) {
                const groupId = fs_1.default
                    .readFileSync(pathToGroup.with(".group-id").toString())
                    .toString();
                const repositories = {};
                groups[groupId] = { name: f.name, repositories };
                const folders = (0, utils_1.directoryNames)(pathToGroup, []);
                return Promise.all(folders.map((f) => __awaiter(this, void 0, void 0, function* () {
                    if (fs_1.default.existsSync(pathToGroup.with(f.name).with(".git").toString())) {
                        const repositoryUrl = yield (0, utils_1.execPromise)(`git ls-remote --get-url origin`, pathToGroup.with(f.name).toString());
                        const repositoryId = repositoryUrl
                            .trim()
                            .substring(repositoryUrl.lastIndexOf("/") + "/r".length);
                        repositories[repositoryId] = f.name;
                    }
                })));
            }
        }));
        return groups;
    });
}
function ensureRepositoryStructure(organizationId, serviceGroup, toBe, asIs) {
    return __awaiter(this, void 0, void 0, function* () {
        yield Promise.all(Object.keys(toBe).map((repositoryId) => __awaiter(this, void 0, void 0, function* () {
            const repositoryDisplayName = toBe[repositoryId];
            const folderName = (0, utils_1.toFolderName)(repositoryDisplayName);
            const pathToRepository = serviceGroup.pathTo.with(folderName);
            if (asIs[repositoryId] !== undefined &&
                asIs[repositoryId] !== folderName) {
                fs_1.default.renameSync(serviceGroup.pathTo.with(asIs[repositoryId]).toString(), pathToRepository.toString());
            }
            yield ensureServiceFolder(organizationId, serviceGroup.id, {
                pathTo: pathToRepository,
                id: new types_1.RepositoryId(repositoryId),
            }).then();
            delete asIs[repositoryId];
        })));
        yield Promise.all(Object.keys(asIs).map((repositoryId) => {
            const folderName = asIs[repositoryId];
            // TODO Delete
            console.log("Delete", serviceGroup.pathTo.with(folderName).toString());
        }));
    });
}
function ensureGroupStructure(organization, toBe) {
    return __awaiter(this, void 0, void 0, function* () {
        const asIs = yield getCurrentStructure(organization.pathTo);
        yield Promise.all(Object.keys(toBe).map((serviceGroupId) => __awaiter(this, void 0, void 0, function* () {
            const group = toBe[serviceGroupId];
            const folderName = (0, utils_1.toFolderName)(group.displayName);
            const pathToGroup = organization.pathTo.with(folderName);
            let asIsRepos;
            if (asIs[serviceGroupId] === undefined) {
                fs_1.default.mkdirSync(pathToGroup.toString(), { recursive: true });
                fs_1.default.writeFileSync(pathToGroup.with(".group-id").toString(), serviceGroupId);
                asIsRepos = {};
            }
            else {
                if (asIs[serviceGroupId].name !== folderName) {
                    fs_1.default.renameSync(organization.pathTo.with(asIs[serviceGroupId].name).toString(), pathToGroup.toString());
                }
                asIsRepos = asIs[serviceGroupId].repositories;
            }
            yield ensureRepositoryStructure(organization.id, { pathTo: pathToGroup, id: new types_1.ServiceGroupId(serviceGroupId) }, group.repositories, asIsRepos);
            delete asIs[serviceGroupId];
        })));
        yield Promise.all(Object.keys(asIs).map((groupId) => {
            const group = asIs[groupId];
            const folderName = group.name;
            // TODO Delete
            console.log("Delete", organization.pathTo.with(folderName).toString());
        }));
    });
}
exports.ensureGroupStructure = ensureGroupStructure;
function ensureServiceFolder(organizationId, groupId, repository) {
    return __awaiter(this, void 0, void 0, function* () {
        process.stdout.write(".");
        const dir = repository.pathTo.toString();
        const repo = `"${config_1.GIT_HOST}/o${organizationId}/g${groupId}/r${repository.id}"`;
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
function do_fetch(organization) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            (0, utils_1.output2)(`Fetching...`);
            const reply = yield (0, utils_1.sshReq)(`organization-fetch`, organization.id.toString());
            if (!reply.startsWith("{"))
                throw reply;
            const structure = JSON.parse(reply);
            process.stdout.write(`Consolidating`);
            yield ensureGroupStructure(organization, structure);
            process.stdout.write("\n");
            return structure;
        }
        catch (e) {
            throw e;
        }
    });
}
exports.do_fetch = do_fetch;
function fetch(organization) {
    (0, utils_1.addToExecuteQueue)(() => do_fetch(organization));
    return (0, utils_1.finish)();
}
exports.fetch = fetch;
