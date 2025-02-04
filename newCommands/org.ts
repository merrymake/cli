import { addToExecuteQueue, finish } from "../exitMessages.js";
import { Option, choice, shortText } from "../prompt.js";
import { OrganizationId, PathToOrganization } from "../types.js";
import {
  digits,
  generateString,
  lowercase,
  sshReq,
  toFolderName,
} from "../utils.js";
import { ADJECTIVE, NOUN } from "../words.js";
import { checkout, checkout_org, checkoutName, do_clone } from "./clone.js";
import { group } from "./group.js";
import { outputGit } from "../printUtils.js";
import { wait } from "./wait.js";
import { getArgs } from "../args.js";

export async function do_createOrganization(
  folderName: string,
  displayName: string
) {
  try {
    const reply = await sshReq(`organization-create`, displayName);
    if (reply.length !== 8) throw reply;
    const organizationId = new OrganizationId(reply);
    await do_clone({}, folderName, displayName, organizationId);
    return organizationId;
  } catch (e) {
    throw e;
  }
}

export async function do_renameOrganization(
  organizationId: OrganizationId,
  displayName: string
) {
  try {
    const reply = await sshReq(
      `organization-rename`,
      displayName,
      `--organizationId`,
      organizationId.toString()
    );
  } catch (e) {
    throw e;
  }
}

export async function rename(organizationId: OrganizationId) {
  try {
    const displayName = await shortText(
      "Organization name",
      "Used when collaborating with others.",
      "Acme Anvils"
    ).then();
    addToExecuteQueue(() => do_renameOrganization(organizationId, displayName));
    return finish();
  } catch (e) {
    throw e;
  }
}

export function generateOrgName() {
  if (
    process.env["MERRYMAKE_NAME_LENGTH"] !== undefined &&
    !Number.isNaN(+process.env["MERRYMAKE_NAME_LENGTH"])
  ) {
    const base = `org-${new Date().toLocaleDateString().replace(/\//g, "-")}-`;
    return (
      base +
      generateString(
        +process.env["MERRYMAKE_NAME_LENGTH"] - base.length,
        lowercase + digits
      )
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
    const orgName = generateOrgName();
    const displayName = await shortText(
      "Organization name",
      "Used when collaborating with others.",
      orgName
    ).then();
    const folderName = toFolderName(displayName);
    const organizationId = await do_createOrganization(folderName, displayName);
    return group({
      pathTo: new PathToOrganization(folderName),
      id: organizationId,
    });
  } catch (e) {
    throw e;
  }
}

function do_join_email_wait(org: string) {
  return wait("Wait for an admin to admit you.", () => checkoutName(org));
}

async function do_join_email(org: string, email: string) {
  try {
    outputGit(await sshReq(`me-join`, org, `--email`, email));
    return do_join_email_wait(org);
  } catch (e) {
    throw e;
  }
}

async function do_join(org: string) {
  try {
    const out = await sshReq(`me-join`, org);
    if (out) {
      if (out.startsWith("{")) {
        const status:
          | { done: true; pending: false; msg: string }
          | { done: true; pending: true; msg: string }
          | { done: false; pending: true; emails: [] } = JSON.parse(out);
        if (status.pending === false) {
          outputGit(status.msg);
          return checkoutName(org);
        }
        if (status.done === true) {
          outputGit(status.msg);
          return do_join_email_wait(org);
        }
        return choice(
          `Which email would you like to join with?`,
          status.emails.map((e) => ({
            long: e,
            text: e,
            action: () => do_join_email(org, e),
          }))
        );
      } else {
        outputGit(out);
        return finish();
      }
    }
  } catch (e) {
    throw e;
  }
}

function join_org(org: string) {
  addToExecuteQueue(() => do_join(org));
  return finish();
}

async function join() {
  try {
    const name = await shortText(
      "Organization to join",
      "Name of the organization you wish to request access to.",
      "Acme Corp"
    ).then();
    return join_org(name);
  } catch (e) {
    throw e;
  }
}

let orgListCache: { name: string; id: string }[] | undefined;
export async function listOrgs() {
  if (orgListCache === undefined) {
    const resp = await sshReq(`organization-list`);
    if (!resp.startsWith("[")) throw resp;
    orgListCache = JSON.parse(resp);
  }
  return orgListCache!;
}

export async function orgAction() {
  try {
    const orgs = await listOrgs();
    const options: Option[] = [];
    if (orgs.length > 0) {
      options.push({
        long: orgs[0].id,
        text: `checkout '${orgs[0].name}'`,
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
      text: `create a new organization`,
      action: () => org(),
    });
    options.push({
      long: "join",
      short: "j",
      text: `join someone else's organization`,
      action: () => join(),
    });
    return choice("Which organization will you work with?", options);
  } catch (e) {
    throw e;
  }
}
