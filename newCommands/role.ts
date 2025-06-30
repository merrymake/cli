import { Option, choice, output, shortText } from "../prompt.js";
import { AccessId, Organization, OrganizationId } from "../types.js";
import { sshReq } from "../utils.js";
import { do_create_deployment_agent } from "./hosting.js";
import { finish } from "../exitMessages.js";
import { outputGit } from "../printUtils.js";
import { Arr, Obj, Str } from "@merrymake/utils";
import { isDryrun } from "../dryrun.js";

const SPECIAL_ROLES = ["Pending", "Build agent", "Deployment agent"];
export async function do_attach_role(
  user: string,
  accessId: AccessId,
  accessEmail: string,
  duration: string
) {
  if (isDryrun()) {
    output("DRYRUN: Would assign role");
    return;
  }
  try {
    const cmd = [
      `user-assign`,
      `\\"${user}\\"`,
      `--accessId`,
      accessId.toString(),
      `--accessEmail`,
      accessEmail,
    ];
    if (duration !== "") cmd.push(`--duration`, duration);
    outputGit(await sshReq(...cmd));
  } catch (e) {
    throw e;
  }
}

export async function do_auto_approve(domain: string, accessId: AccessId) {
  if (isDryrun()) {
    output("DRYRUN: Would add auto-approved domain");
    return;
  }
  try {
    outputGit(
      await sshReq(`preapprove-add`, `--accessId`, accessId.toString(), domain)
    );
  } catch (e) {
    throw e;
  }
}

export async function do_remove_auto_approve(
  organizationId: OrganizationId,
  domain: string
) {
  if (isDryrun()) {
    output("DRYRUN: Would remove auto-approved domain");
    return;
  }
  try {
    outputGit(
      await sshReq(
        `preapprove-remove`,
        `--organizationId`,
        organizationId.toString(),
        domain
      )
    );
  } catch (e) {
    throw e;
  }
}

async function role_user_attach_role_expiry(
  user: string,
  accessId: AccessId,
  accessEmail: string,
  duration: string
) {
  await do_attach_role(user, accessId, accessEmail, duration);
  return finish();
}

async function role_user_attach_role(
  user: string,
  accessId: AccessId,
  accessEmail: string
) {
  try {
    const duration = await shortText(
      "Duration",
      "How long should the user have the role? Ex. 3 days",
      null
    );
    return role_user_attach_role_expiry(user, accessId, accessEmail, duration);
  } catch (e) {
    throw e;
  }
}

async function role_auto_domain_role(domain: string, accessId: AccessId) {
  await do_auto_approve(domain, accessId);
  return finish();
}

async function role_auto_remove(
  organizationId: OrganizationId,
  domain: string
) {
  await do_remove_auto_approve(organizationId, domain);
  return finish();
}

let roleListCache: { name: string; id: string; desc: string }[] | undefined;
export async function listRoles(organizationId: OrganizationId) {
  if (roleListCache === undefined) {
    const resp = await sshReq(`role-list`, organizationId.toString());
    if (!resp.startsWith("[")) throw resp;
    roleListCache = JSON.parse(resp);
  }
  return roleListCache!;
}

async function role_user_attach(
  organizationId: OrganizationId,
  user: string,
  accessEmail: string
) {
  try {
    return await choice([], async () => {
      const roles = await listRoles(organizationId);
      const options: Option[] = roles
        .filter((role) => !SPECIAL_ROLES.includes(role.name))
        .map((role) => {
          return {
            long: role.id,
            text: `${role.name} -- ${role.desc}`,
            action: () =>
              role_user_attach_role(user, new AccessId(role.id), accessEmail),
          };
        });
      return { options, header: "Which role would you like to assign?" };
    }).then((x) => x);
  } catch (e) {
    throw e;
  }
}

async function role_user(
  organizationId: OrganizationId,
  user: string,
  accessEmail: string
) {
  try {
    return await choice(
      [
        {
          long: `assign`,
          short: `a`,
          text: `assign an additional role to user`,
          action: () => role_user_attach(organizationId, user, accessEmail),
        },
      ],
      async () => {
        const roles = await listRoles(organizationId);
        const pendingId = roles.find((x) => x.name === "Pending")!.id;
        return {
          options: [
            {
              long: `remove`,
              short: `r`,
              text: `remove all roles and access`,
              weight: -1,
              action: () =>
                role_user_attach_role(
                  user,
                  new AccessId(pendingId),
                  accessEmail
                ),
            },
          ],
          header: "What would you like to do?",
        };
      }
    ).then();
  } catch (e) {
    throw e;
  }
}

async function role_auto_new_domain(
  organizationId: OrganizationId,
  domain: string
) {
  try {
    return await choice([], async () => {
      const roles = await listRoles(organizationId);
      const options: Option[] = roles
        .filter((role) => !SPECIAL_ROLES.includes(role.name))
        .map((role) => {
          return {
            long: role.id,
            text: `${role.name} -- ${role.desc}`,
            action: () => role_auto_domain_role(domain, new AccessId(role.id)),
          };
        });
      return { options, header: "Which role should new users get?" };
    }).then();
  } catch (e) {
    throw e;
  }
}

async function role_auto_new(organizationId: OrganizationId) {
  try {
    const domain = await shortText(
      "Domain",
      "Email domain to auto approve.",
      `@example.com`
    ).then();
    return role_auto_new_domain(organizationId, domain);
  } catch (e) {
    throw e;
  }
}

async function role_auto(organizationId: OrganizationId) {
  try {
    return await choice(
      [
        {
          long: `new`,
          short: `n`,
          text: `setup a new domain rule`,
          action: () => role_auto_new(organizationId),
        },
      ],
      async () => {
        const resp = await sshReq(`preapprove-list`, organizationId.toString());
        const domains: { domain: string; access: string }[] = JSON.parse(resp);
        const doms: { [domain: string]: string[] } = {};
        domains.forEach((x) => {
          if (doms[x.domain] === undefined) doms[x.domain] = [];
          doms[x.domain].push(x.access);
        });
        const options: Option[] = Object.keys(doms).map((domain) => {
          return {
            long: domain,
            text: `remove ${domain} (${doms[domain].join(", ")})`,
            action: () => role_auto_remove(organizationId, domain),
          };
        });
        return { options, header: "What would you like to do?" };
      }
    ).then();
  } catch (e) {
    throw e;
  }
}

async function service_user(organization: Organization) {
  try {
    const name = await shortText(
      "Name",
      "Display name for the service user",
      `Service User`
    ).then();
    const file = ".merrymake/" + Str.toFolderName(name) + ".key";
    await do_create_deployment_agent(organization, name, file);
    return finish();
  } catch (e) {
    throw e;
  }
}

let activeUsersCache:
  | {
      yes: {
        email: string;
        id: string;
        roleExpiry: { [role: string]: Date | null | undefined };
      }[];
      no: {
        email: string;
        id: string;
        roleExpiry: { [role: string]: Date | null | undefined };
      }[];
    }
  | undefined;
async function initializeCache(organizationId: OrganizationId) {
  if (activeUsersCache === undefined) {
    const resp = await sshReq(`user-list`, organizationId.toString());
    if (!resp.startsWith("[")) throw resp;
    const parsed: {
      email: string;
      id: string;
      roleExpiry: { [role: string]: Date | null | undefined };
    }[] = Arr.Sync.map(
      JSON.parse(resp),
      (u: {
        email: string;
        id: string;
        roleExpiry: { [role: string]: string | null };
      }) => ({
        email: u.email,
        id: u.id,
        roleExpiry: Obj.Sync.filter(
          Obj.Sync.map(u.roleExpiry, (k, v) =>
            v === null ? null : new Date(v)
          ),
          (k, v) => v === null || v.getTime() > Date.now()
        ),
      })
    );
    activeUsersCache = Arr.Sync.partition(parsed, (x) =>
      Obj.Sync.some(x.roleExpiry, (k, v) => k !== "Pending")
    );
  }
  return activeUsersCache;
}
export async function listActiveUsers(organizationId: OrganizationId) {
  return (await initializeCache(organizationId)).yes;
}
export async function listPendingUsers(organizationId: OrganizationId) {
  return (await initializeCache(organizationId)).no;
}

export async function pending(organization: Organization) {
  try {
    return await choice([], async () => {
      const users = await listPendingUsers(organization.id);
      const options: Option[] = users.map((user) => {
        return {
          long: user.email,
          text: user.email,
          action: () => role_user(organization.id, user.id, user.email),
        };
      });
      return { options, header: "Which user would you like to allow?" };
    }).then();
  } catch (e) {
    throw e;
  }
}

export async function role(organization: Organization) {
  try {
    // options.push({
    //   long: `new`,
    //   short: `n`,
    //   text: `create a new role`,
    //   action: () => role_new(org),
    // });
    return await choice(
      [
        {
          long: `pending`,
          short: `p`,
          text: `see or allow pending users`,
          action: () => pending(organization),
        },
        {
          long: `service`,
          short: `s`,
          text: `create a new service user`,
          action: () => service_user(organization),
        },
        {
          long: `auto`,
          short: `a`,
          text: `configure domain auto approval`,
          action: () => role_auto(organization.id),
        },
      ],
      async () => {
        const users = await listActiveUsers(organization.id);
        const options: Option[] = users.map((user) => {
          return {
            long: user.id,
            text: `${user.email}: ${Obj.Sync.toArray(
              user.roleExpiry,
              (k, v) =>
                k +
                (v === null || v === undefined
                  ? ""
                  : ` (${v.toLocaleString()})`)
            ).join(", ")}`,
            action: () => role_user(organization.id, user.id, user.email),
          };
        });
        return { options, header: "Which user would you like to manage?" };
      }
    ).then();
  } catch (e) {
    throw e;
  }
}
