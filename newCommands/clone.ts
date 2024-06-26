import fs from "fs";
import { GIT_HOST } from "../config";
import { choice } from "../prompt";
import {
  OrgFile,
  Path,
  addToExecuteQueue,
  execPromise,
  finish,
  output2,
  sshReq,
  toFolderName,
} from "../utils";
import { ToBeStructure, ensureGroupStructure } from "./fetch";
import { listOrgs } from "./org";
import { OrganizationId } from "../types";

export async function do_clone(
  struct: ToBeStructure,
  folderName: string,
  displayName: string,
  organizationId: OrganizationId
) {
  try {
    output2(`Cloning ${displayName}...`);
    fs.mkdirSync(`${folderName}/.merrymake`, { recursive: true });
    let orgFile: OrgFile = { organizationId: organizationId.toString() };
    fs.writeFileSync(
      `${folderName}/.merrymake/conf.json`,
      JSON.stringify(orgFile)
    );
    let eventsDir = `${folderName}/event-catalogue`;
    fs.mkdirSync(eventsDir, { recursive: true });
    await execPromise(`git init --initial-branch=main`, eventsDir);
    await execPromise(
      `git remote add origin "${GIT_HOST}/o${organizationId}/event-catalogue"`,
      eventsDir
    );
    let publicDir = `${folderName}/public`;
    fs.mkdirSync(publicDir, { recursive: true });
    await execPromise(`git init --initial-branch=main`, publicDir);
    await execPromise(
      `git remote add origin "${GIT_HOST}/o${organizationId}/public"`,
      publicDir
    );
    ensureGroupStructure(new Path(folderName), organizationId, struct);
  } catch (e) {
    throw e;
  }
}

export async function do_fetch_clone(
  displayName: string,
  organizationId: OrganizationId
) {
  try {
    let reply = await sshReq(`organization-fetch`, organizationId.toString());
    if (!reply.startsWith("{")) throw reply;
    let structure = JSON.parse(reply);
    const folderName = toFolderName(displayName);
    await do_clone(structure, folderName, displayName, organizationId);
  } catch (e) {
    throw e;
  }
}

export function checkout_org(
  displayName: string,
  organizationId: OrganizationId
) {
  addToExecuteQueue(() => do_fetch_clone(displayName, organizationId));
  return finish();
}

export async function checkout() {
  try {
    let orgs = await listOrgs();
    return choice(
      "Which organization would you like to clone?",
      orgs.map((org) => ({
        long: org.id,
        text: `${org.name} (${org.id})`,
        action: () => checkout_org(org.name, new OrganizationId(org.id)),
      }))
    );
  } catch (e) {
    throw e;
  }
}
