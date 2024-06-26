import fs from "fs";
import {
  Path,
  addToExecuteQueue,
  directoryNames,
  execPromise,
  fetchOrg,
  finish,
  output2,
  sshReq,
  toFolderName,
} from "../utils";
import { GIT_HOST } from "../config";
import {
  OrganizationId,
  PathToOrganization,
  PathToRepository,
  PathToServiceGroup,
  RepositoryId,
  ServiceGroupId,
} from "../types";

type RepositoryStructure = { [repositoryId: string]: string };

type AsIsStructure = {
  [groupId: string]: {
    name: string;
    repositories: RepositoryStructure;
  };
};

export type ToBeStructure = {
  [groupId: string]: {
    displayName: string;
    repositories: RepositoryStructure;
  };
};

function getCurrentStructure(pathToOrganization: PathToOrganization) {
  const folders = directoryNames(pathToOrganization, [
    "event-catalogue",
    "public",
  ]);
  const groups: AsIsStructure = {};
  folders.forEach((f) => {
    const pathToGroup = pathToOrganization.with(f.name);
    if (fs.existsSync(pathToGroup.with(".group-id").toString())) {
      const groupId = fs
        .readFileSync(pathToGroup.with(".group-id").toString())
        .toString();
      const repositories: { [repositoryId: string]: string } = {};
      groups[groupId] = { name: f.name, repositories };
      const folders = directoryNames(pathToGroup, []);
      folders.forEach(async (f) => {
        if (fs.existsSync(pathToGroup.with(f.name).with(".git").toString())) {
          const repositoryUrl = await execPromise(
            `git ls-remote --get-url origin`
          );
          const repositoryId = repositoryUrl.substring(
            repositoryUrl.lastIndexOf("/")
          );
          repositories[repositoryId] = f.name;
        } else {
          // TODO Get from bitbucket file?
        }
      });
    }
  });
  return groups;
}

function ensureRepositoryStructure(
  pathToGroup: PathToServiceGroup,
  organizationId: OrganizationId,
  serviceGroupId: ServiceGroupId,
  toBe: RepositoryStructure,
  asIs: RepositoryStructure
) {
  Object.keys(toBe).forEach((repositoryId) => {
    const repositoryDisplayName = toBe[repositoryId];
    const folderName = toFolderName(repositoryDisplayName);
    const pathToRepository = pathToGroup.with(folderName);
    if (asIs[repositoryId] !== folderName) {
      fs.renameSync(
        pathToGroup.with(asIs[repositoryId]).toString(),
        pathToRepository.toString()
      );
    }
    createServiceFolder(
      pathToRepository,
      organizationId,
      serviceGroupId,
      new RepositoryId(repositoryId)
    );
    delete asIs[repositoryId];
  });
  Object.keys(asIs).forEach((repositoryId) => {
    const folderName = asIs[repositoryId];
    // TODO Delete
    console.log("Delete", pathToGroup.with(folderName).toString());
  });
}

export function ensureGroupStructure(
  pathToOrganization: PathToOrganization,
  organizationId: OrganizationId,
  toBe: ToBeStructure
) {
  const asIs = getCurrentStructure(pathToOrganization);
  Object.keys(toBe).forEach((serviceGroupId) => {
    const group = toBe[serviceGroupId];
    const folderName = toFolderName(group.displayName);
    const pathToGroup = pathToOrganization.with(folderName);
    let asIsRepos: { [repositoryId: string]: string };
    if (asIs[serviceGroupId] === undefined) {
      fs.mkdirSync(pathToGroup.toString(), { recursive: true });
      fs.writeFileSync(
        pathToGroup.with(".group-id").toString(),
        serviceGroupId
      );
      asIsRepos = {};
    } else {
      if (asIs[serviceGroupId].name !== folderName) {
        fs.renameSync(
          pathToOrganization.with(asIs[serviceGroupId].name).toString(),
          pathToGroup.toString()
        );
      }
      asIsRepos = asIs[serviceGroupId].repositories;
    }
    ensureRepositoryStructure(
      pathToGroup,
      organizationId,
      new ServiceGroupId(serviceGroupId),
      group.repositories,
      asIsRepos
    );
    delete asIs[serviceGroupId];
  });
  Object.keys(asIs).forEach((groupId) => {
    const group = asIs[groupId];
    const folderName = group.name;
    // TODO Delete
    console.log("Delete", pathToOrganization.with(folderName).toString());
  });
}

async function createServiceFolder(
  path: PathToRepository,
  organizationId: OrganizationId,
  groupId: ServiceGroupId,
  repositoryId: RepositoryId
) {
  const dir = path.toString();
  let repo = `"${GIT_HOST}/o${organizationId}/g${groupId}/r${repositoryId}"`;
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(dir + "/.git")) {
      await execPromise(`git init --initial-branch=main`, dir);
      await execPromise(`git remote add origin ${repo}`, dir);
      fs.writeFileSync(
        dir + "/fetch.bat",
        `@echo off
git fetch
git reset --hard origin/main
del fetch.sh
(goto) 2>nul & del fetch.bat`
      );
      fs.writeFileSync(
        dir + "/fetch.sh",
        `#!/bin/sh
git fetch
git reset --hard origin/main
rm fetch.bat fetch.sh`,
        {}
      );
      fs.chmodSync(dir + "/fetch.sh", "755");
    } else {
      await execPromise(`git remote set-url origin ${repo}`, dir);
    }
  } catch (e) {
    console.log(e);
  }
}

async function do_fetch(
  pathToOrganization: PathToOrganization,
  organizationId: OrganizationId
) {
  try {
    let reply = await sshReq(`organization-fetch`, organizationId.toString());
    if (!reply.startsWith("{")) throw reply;
    output2(`Fetching...`);
    let structure = JSON.parse(reply);
    ensureGroupStructure(pathToOrganization, organizationId, structure);
  } catch (e) {
    throw e;
  }
}

export function fetch(
  pathToOrganization: PathToOrganization,
  organizationId: OrganizationId
) {
  addToExecuteQueue(() => do_fetch(pathToOrganization, organizationId));
  return finish();
}
