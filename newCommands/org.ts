import { Option, choice, shortText } from "../prompt";
import { OrganizationId, PathToOrganization } from "../types";
import {
  Path,
  addToExecuteQueue,
  finish,
  output2,
  sshReq,
  toFolderName,
} from "../utils";
import { ADJECTIVE, NOUN } from "../words";
import { checkout, checkout_org, do_clone } from "./clone";
import { group } from "./group";

export async function do_createOrganization(
  folderName: string,
  displayName: string
) {
  try {
    let reply = await sshReq(`organization-create`, displayName);
    if (reply.length !== 8) throw reply;
    let organizationId = new OrganizationId(reply);
    await do_clone({}, folderName, displayName, organizationId);
    return organizationId;
  } catch (e) {
    throw e;
  }
}

const characters = "abcdefghijklmnopqrstuvwxyz0123456789";

function generateString(length: number) {
  let result = "";
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }

  return result;
}

export function generateOrgName() {
  if (
    process.env["MERRYMAKE_NAME_LENGTH"] !== undefined &&
    !Number.isNaN(+process.env["MERRYMAKE_NAME_LENGTH"])
  ) {
    const base = `org-${new Date().toLocaleDateString().replace(/\//g, "-")}-`;
    return (
      base + generateString(+process.env["MERRYMAKE_NAME_LENGTH"] - base.length)
    );
  } else
    return (
      ADJECTIVE[~~(ADJECTIVE.length * Math.random())] +
      "-" +
      NOUN[~~(NOUN.length * Math.random())] +
      "-" +
      NOUN[~~(NOUN.length * Math.random())]
    );
}

export async function org() {
  try {
    let orgName = generateOrgName();
    let displayName = await shortText(
      "Organization name",
      "Used when collaborating with others.",
      orgName
    ).then();
    const folderName = toFolderName(displayName);
    const organizationId = await do_createOrganization(folderName, displayName);
    return group(new PathToOrganization(folderName), organizationId);
  } catch (e) {
    throw e;
  }
}

export async function do_join(org: string) {
  try {
    output2(await sshReq(`me-join`, org));
  } catch (e) {
    throw e;
  }
}

function join_org(name: string) {
  // TODO join, wait, then checkout
  addToExecuteQueue(() => do_join(name));
  return finish();
}

async function join() {
  try {
    let name = await shortText(
      "Organization to join",
      "Name of the organization you wish to request access to.",
      null
    ).then();
    return join_org(name);
  } catch (e) {
    throw e;
  }
}

let orgListCache: { name: string; id: string }[] | undefined;
export async function listOrgs() {
  if (orgListCache === undefined) {
    let resp = await sshReq(`organization-list`);
    if (!resp.startsWith("[")) throw resp;
    orgListCache = JSON.parse(resp);
  }
  return orgListCache!;
}

export async function orgAction() {
  try {
    let orgs = await listOrgs();
    let options: Option[] = [];
    if (orgs.length > 0) {
      options.push({
        long: orgs[0].id,
        text: `checkout ${orgs[0].name} (${orgs[0].id})`,
        action: () =>
          checkout_org(orgs[0].name, new OrganizationId(orgs[0].id)),
      });
    }
    if (orgs.length > 1) {
      options.push({
        long: "checkout",
        short: "c",
        text: `checkout another organization`,
        action: () => checkout(),
      });
    }
    options.push({
      long: "new",
      short: "n",
      text: `create new organization`,
      action: () => org(),
    });
    options.push({
      long: "join",
      short: "j",
      text: `join an existing organization`,
      action: () => join(),
    });
    return await choice(
      "Which organization will you work with?",
      options
    ).then();
  } catch (e) {
    throw e;
  }
}
