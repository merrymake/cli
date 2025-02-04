import fs from "fs";
import { GIT_HOST } from "../config.js";
import { choice } from "../prompt.js";
import { OrganizationId, PathToOrganization } from "../types.js";
import {
  OrgFile,
  execPromise,
  sshReq,
  toFolderName,
  toSubdomain,
} from "../utils.js";
import { outputGit } from "../printUtils.js";
import { ToBeStructure, ensureGroupStructure } from "./fetch.js";
import { listOrgs } from "./org.js";
import { addToExecuteQueue, finish } from "../exitMessages.js";

export async function do_clone(
  struct: ToBeStructure,
  folderName: string,
  displayName: string,
  organizationId: OrganizationId
) {
  try {
    outputGit(`Cloning ${displayName}...`);
    fs.mkdirSync(`${folderName}/.merrymake`, { recursive: true });
    const orgFile: OrgFile = { organizationId: organizationId.toString() };
    fs.writeFileSync(
      `${folderName}/.merrymake/conf.json`,
      JSON.stringify(orgFile)
    );
    const eventsDir = `${folderName}/event-catalogue`;
    fs.mkdirSync(eventsDir, { recursive: true });
    await execPromise(`git init --initial-branch=main`, eventsDir);
    await execPromise(
      `git remote add origin "${GIT_HOST}/o${organizationId}/event-catalogue"`,
      eventsDir
    );
    fs.writeFileSync(eventsDir + "/api.json", "{}");
    fs.writeFileSync(eventsDir + "/cron.json", "{}");
    const publicDir = `${folderName}/public`;
    fs.mkdirSync(publicDir, { recursive: true });
    await execPromise(`git init --initial-branch=main`, publicDir);
    await execPromise(
      `git remote add origin "${GIT_HOST}/o${organizationId}/public"`,
      publicDir
    );
    fs.writeFileSync(
      publicDir + "/index.html",
      "<html><body>Hello, World!</body></html>"
    );
    await ensureGroupStructure(
      { pathTo: new PathToOrganization(folderName), id: organizationId },
      struct
    );
  } catch (e) {
    throw e;
  }
}

export async function do_fetch_clone(
  displayName: string,
  folderName: string,
  organizationId: OrganizationId
) {
  try {
    const reply = await sshReq(`organization-fetch`, organizationId.toString());
    if (!reply.startsWith("{")) throw reply;
    const structure = JSON.parse(reply);
    await do_clone(structure, folderName, displayName, organizationId);
  } catch (e) {
    throw e;
  }
}

export async function checkout_org(
  displayName: string,
  organizationId: OrganizationId
) {
  const folderName = toFolderName(displayName);
  if (fs.existsSync(folderName)) {
    throw `Folder '${folderName}' already exists.`;
  }
  addToExecuteQueue(() =>
    do_fetch_clone(displayName, folderName, organizationId)
  );
  return finish();
}

export async function checkout() {
  try {
    const orgs = await listOrgs();
    return choice(
      "Which organization would you like to clone?",
      orgs.map((org) => ({
        long: org.id,
        text: `${org.name}`,
        action: () => checkout_org(org.name, new OrganizationId(org.id)),
      }))
    );
  } catch (e) {
    throw e;
  }
}

export async function checkoutName(name: string) {
  try {
    const subdomain = toSubdomain(name);
    const org = (await listOrgs()).find(
      (x) => toSubdomain(x.name) === subdomain
    );
    if (org === undefined) return checkout();
    else return checkout_org(org.name, new OrganizationId(org.id));
  } catch (e) {
    throw e;
  }
}
