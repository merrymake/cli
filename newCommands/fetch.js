import { Promise_all, Str } from "@merrymake/utils";
import { existsSync } from "fs";
import { chmod, mkdir, readFile, rename, writeFile } from "fs/promises";
import { GIT_HOST, SPECIAL_FOLDERS } from "../config.js";
import { finish } from "../exitMessages.js";
import { outputGit } from "../printUtils.js";
import { RepositoryId, ServiceGroupId, } from "../types.js";
import { directoryNames, execPromise, sshReq } from "../utils.js";
async function getCurrentStructure(pathToOrganization) {
    const folders = await directoryNames(pathToOrganization, SPECIAL_FOLDERS);
    const groups = {};
    await Promise_all(...folders.map(async (f) => {
        const pathToGroup = pathToOrganization.with(f.name);
        if (existsSync(pathToGroup.with(".group-id").toString())) {
            const groupId = await readFile(pathToGroup.with(".group-id").toString(), "utf-8");
            const repositories = {};
            groups[groupId] = { name: f.name, repositories };
            const folders = await directoryNames(pathToGroup, []);
            return Promise_all(...folders.map(async (f) => {
                if (existsSync(pathToGroup.with(f.name).with(".git").toString())) {
                    const repositoryUrl = await execPromise(`git ls-remote --get-url origin`, pathToGroup.with(f.name).toString());
                    const repositoryId = repositoryUrl
                        .trim()
                        .substring(repositoryUrl.lastIndexOf("/") + "/r".length);
                    repositories[repositoryId] = f.name;
                }
            }));
        }
    }));
    return groups;
}
async function ensureRepositoryStructure(organizationId, serviceGroup, toBe, asIs) {
    await Promise_all(...Object.keys(toBe).map(async (repositoryId) => {
        const repositoryDisplayName = toBe[repositoryId];
        const folderName = Str.toFolderName(repositoryDisplayName);
        const pathToRepository = serviceGroup.pathTo.with(folderName);
        if (asIs[repositoryId] !== undefined &&
            asIs[repositoryId] !== folderName) {
            await rename(serviceGroup.pathTo.with(asIs[repositoryId]).toString(), pathToRepository.toString());
        }
        await ensureServiceFolder(organizationId, serviceGroup.id, {
            pathTo: pathToRepository,
            id: new RepositoryId(repositoryId),
        }).then();
        delete asIs[repositoryId];
    }));
    await Promise_all(...Object.keys(asIs).map(async (repositoryId) => {
        const folderName = asIs[repositoryId];
        // TODO Delete
        console.log("Delete", serviceGroup.pathTo.with(folderName).toString());
    }));
}
export async function ensureGroupStructure(organization, toBe) {
    const asIs = await getCurrentStructure(organization.pathTo);
    await Promise_all(...Object.keys(toBe).map(async (serviceGroupId) => {
        const group = toBe[serviceGroupId];
        const folderName = Str.toFolderName(group.displayName);
        const pathToGroup = organization.pathTo.with(folderName);
        let asIsRepos;
        if (asIs[serviceGroupId] === undefined) {
            await mkdir(pathToGroup.toString(), { recursive: true });
            await writeFile(pathToGroup.with(".group-id").toString(), serviceGroupId);
            asIsRepos = {};
        }
        else {
            if (asIs[serviceGroupId].name !== folderName) {
                await rename(organization.pathTo.with(asIs[serviceGroupId].name).toString(), pathToGroup.toString());
            }
            asIsRepos = asIs[serviceGroupId].repositories;
        }
        await ensureRepositoryStructure(organization.id, { pathTo: pathToGroup, id: new ServiceGroupId(serviceGroupId) }, group.repositories, asIsRepos);
        delete asIs[serviceGroupId];
    }));
    await Promise_all(...Object.keys(asIs).map(async (groupId) => {
        const group = asIs[groupId];
        const folderName = group.name;
        // TODO Delete
        console.log("Delete", organization.pathTo.with(folderName).toString());
    }));
}
async function ensureServiceFolder(organizationId, groupId, repository) {
    process.stdout.write(".");
    const dir = repository.pathTo.toString();
    const repo = `"${GIT_HOST}/o${organizationId}/g${groupId}/r${repository.id}"`;
    try {
        if (!existsSync(dir)) {
            await mkdir(dir, { recursive: true });
            await execPromise(`git init --initial-branch=main`, dir);
            await execPromise(`git remote add origin ${repo}`, dir);
            await writeFile(dir + "/fetch.bat", `@echo off
git fetch
git reset --hard origin/main
git branch --set-upstream-to=origin/main
del fetch.sh
(goto) 2>nul & del fetch.bat`);
            await writeFile(dir + "/fetch.sh", `#!/bin/sh
git fetch
git reset --hard origin/main
git branch --set-upstream-to=origin/main
rm fetch.bat fetch.sh`, {});
            await chmod(dir + "/fetch.sh", "755");
        }
        else if (existsSync(dir + "/.git")) {
            await execPromise(`git remote set-url origin ${repo}`, dir);
        }
    }
    catch (e) {
        console.log(e);
    }
}
export async function do_fetch(organization) {
    try {
        outputGit(`Fetching...`);
        const reply = await sshReq(`organization-fetch`, organization.id.toString());
        if (!reply.startsWith("{"))
            throw reply;
        const structure = JSON.parse(reply);
        process.stdout.write(`Consolidating`);
        await ensureGroupStructure(organization, structure);
        process.stdout.write("\n");
        return structure;
    }
    catch (e) {
        throw e;
    }
}
export async function fetch(organization) {
    await do_fetch(organization);
    return finish();
}
