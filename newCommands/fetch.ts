import fs from "fs";
import { GIT_HOST } from "../config.js";
import { addToExecuteQueue, finish } from "../exitMessages.js";
import {
  Organization,
  OrganizationId,
  PathToOrganization,
  RepositoryId,
  RepositoryWithId,
  ServiceGroup,
  ServiceGroupId,
} from "../types.js";
import { directoryNames, execPromise, sshReq, toFolderName } from "../utils.js";
import { outputGit } from "../printUtils.js";

type DisplayName = string;
type RepositoryStructure = { [repositoryId: string]: DisplayName };

type AsIsStructure = {
  [groupId: string]: {
    name: string;
    repositories: RepositoryStructure;
  };
};

export type ToBeStructure = {
  [groupId: string]: {
    displayName: DisplayName;
    repositories: RepositoryStructure;
  };
};

async function getCurrentStructure(pathToOrganization: PathToOrganization) {
  const folders = directoryNames(pathToOrganization, [
    "event-catalogue",
    "public",
  ]);
  const groups: AsIsStructure = {};
  await Promise.all(
    folders.map((f) => {
      const pathToGroup = pathToOrganization.with(f.name);
      if (fs.existsSync(pathToGroup.with(".group-id").toString())) {
        const groupId = fs
          .readFileSync(pathToGroup.with(".group-id").toString())
          .toString();
        const repositories: RepositoryStructure = {};
        groups[groupId] = { name: f.name, repositories };
        const folders = directoryNames(pathToGroup, []);
        return Promise.all(
          folders.map(async (f) => {
            if (
              fs.existsSync(pathToGroup.with(f.name).with(".git").toString())
            ) {
              const repositoryUrl = await execPromise(
                `git ls-remote --get-url origin`,
                pathToGroup.with(f.name).toString()
              );
              const repositoryId = repositoryUrl
                .trim()
                .substring(repositoryUrl.lastIndexOf("/") + "/r".length);
              repositories[repositoryId] = f.name;
            }
          })
        );
      }
    })
  );
  return groups;
}

async function ensureRepositoryStructure(
  organizationId: OrganizationId,
  serviceGroup: ServiceGroup,
  toBe: RepositoryStructure,
  asIs: RepositoryStructure
) {
  await Promise.all(
    Object.keys(toBe).map(async (repositoryId) => {
      const repositoryDisplayName = toBe[repositoryId];
      const folderName = toFolderName(repositoryDisplayName);
      const pathToRepository = serviceGroup.pathTo.with(folderName);
      if (
        asIs[repositoryId] !== undefined &&
        asIs[repositoryId] !== folderName
      ) {
        fs.renameSync(
          serviceGroup.pathTo.with(asIs[repositoryId]).toString(),
          pathToRepository.toString()
        );
      }
      await ensureServiceFolder(organizationId, serviceGroup.id, {
        pathTo: pathToRepository,
        id: new RepositoryId(repositoryId),
      }).then();
      delete asIs[repositoryId];
    })
  );
  await Promise.all(
    Object.keys(asIs).map((repositoryId) => {
      const folderName = asIs[repositoryId];
      // TODO Delete
      console.log("Delete", serviceGroup.pathTo.with(folderName).toString());
    })
  );
}

export async function ensureGroupStructure(
  organization: Organization,
  toBe: ToBeStructure
) {
  const asIs = await getCurrentStructure(organization.pathTo);
  await Promise.all(
    Object.keys(toBe).map(async (serviceGroupId) => {
      const group = toBe[serviceGroupId];
      const folderName = toFolderName(group.displayName);
      const pathToGroup = organization.pathTo.with(folderName);
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
            organization.pathTo.with(asIs[serviceGroupId].name).toString(),
            pathToGroup.toString()
          );
        }
        asIsRepos = asIs[serviceGroupId].repositories;
      }
      await ensureRepositoryStructure(
        organization.id,
        { pathTo: pathToGroup, id: new ServiceGroupId(serviceGroupId) },
        group.repositories,
        asIsRepos
      );
      delete asIs[serviceGroupId];
    })
  );
  await Promise.all(
    Object.keys(asIs).map((groupId) => {
      const group = asIs[groupId];
      const folderName = group.name;
      // TODO Delete
      console.log("Delete", organization.pathTo.with(folderName).toString());
    })
  );
}

async function ensureServiceFolder(
  organizationId: OrganizationId,
  groupId: ServiceGroupId,
  repository: RepositoryWithId
) {
  process.stdout.write(".");
  const dir = repository.pathTo.toString();
  const repo = `"${GIT_HOST}/o${organizationId}/g${groupId}/r${repository.id}"`;
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

export async function do_fetch(organization: Organization) {
  try {
    outputGit(`Fetching...`);
    const reply = await sshReq(
      `organization-fetch`,
      organization.id.toString()
    );
    if (!reply.startsWith("{")) throw reply;
    const structure: ToBeStructure = JSON.parse(reply);
    process.stdout.write(`Consolidating`);
    await ensureGroupStructure(organization, structure);
    process.stdout.write("\n");
    return structure;
  } catch (e) {
    throw e;
  }
}

export function fetch(organization: Organization) {
  addToExecuteQueue(() => do_fetch(organization));
  return finish();
}
