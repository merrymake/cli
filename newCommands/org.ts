import { constify, Str } from "@merrymake/utils";
import {
  DEFAULT_REPOSITORY_NAME,
  DEFAULT_SERVICE_GROUP_NAME,
} from "../config.js";
import { finish } from "../exitMessages.js";
import { outputGit } from "../printUtils.js";
import { choice, Option, output, shortText } from "../prompt.js";
import { OrganizationId, PathToOrganization } from "../types.js";
import { digits, generateString, lowercase, sshReq } from "../utils.js";
import { ADJECTIVE, NOUN } from "../words.js";
import { checkout, checkout_org, checkoutName, do_clone } from "./clone.js";
import { do_createServiceGroup } from "./group.js";
import { repo_create_name } from "./repo.js";
import { wait } from "./wait.js";
import { isDryrun } from "../dryrun.js";

export async function do_createOrganization(
  folderName: string,
  displayName: string
) {
  if (isDryrun()) {
    output("DRYRUN: Would create organization");
    return new OrganizationId("dryrun_id");
  }
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
  if (isDryrun()) {
    output("DRYRUN: Would rename organization");
    return;
  }
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
    await do_renameOrganization(organizationId, displayName);
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
    const organization = await constify(async () => {
      const displayName = await shortText(
        "Organization name",
        "Used when collaborating with others.",
        orgName
      ).then();
      const folderName = Str.toFolderName(displayName);
      const organizationId = await do_createOrganization(
        folderName,
        displayName
      );
      return { id: organizationId, pathTo: new PathToOrganization(folderName) };
    });
    const serviceGroup = await constify(async () => {
      const displayName = DEFAULT_SERVICE_GROUP_NAME;
      const folderName = Str.toFolderName(displayName);
      const pathToServiceGroup = organization.pathTo.with(folderName);
      const serviceGroupId = await do_createServiceGroup(
        pathToServiceGroup,
        organization.id,
        displayName
      );
      return { pathTo: pathToServiceGroup, id: serviceGroupId };
    });
    return repo_create_name(
      organization,
      serviceGroup,
      DEFAULT_REPOSITORY_NAME
    );
  } catch (e) {
    throw e;
  }
}

function do_join_email_wait(org: string) {
  return wait("Wait for an admin to admit you.", () => checkoutName(org));
}

async function do_join_email(org: string, email: string) {
  if (isDryrun()) {
    output("DRYRUN: Would request to join organization");
    return checkoutName(org);
  }
  try {
    outputGit(await sshReq(`me-join`, org, `--email`, email));
    return do_join_email_wait(org);
  } catch (e) {
    throw e;
  }
}

async function do_join_more(org: string, emails: string[]) {
  try {
    return choice([], async () => {
      return {
        options: emails.map((e) => ({
          long: e,
          text: e,
          action: () => do_join_email(org, e),
        })),
        header: `Which email would you like to join with?`,
      };
    });
  } catch (e) {
    throw e;
  }
}

async function do_join(org: string) {
  if (isDryrun()) {
    output("DRYRUN: Faking emails");
    return do_join_more(org, ["em@il.eu", "john@smith.com"]);
  }
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
        return do_join_more(org, status.emails);
      } else {
        outputGit(out);
        return finish();
      }
    }
  } catch (e) {
    throw e;
  }
}

async function join_org(org: string) {
  await do_join(org);
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
    return choice(
      [
        {
          long: "new",
          short: "n",
          text: `create a new organization`,
          action: () => org(),
        },
        {
          long: "join",
          short: "j",
          text: `join someone else's organization`,
          action: () => join(),
        },
      ],
      async () => {
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
        return { options, header: "Which organization will you work with?" };
      }
    );
  } catch (e) {
    throw e;
  }
}
