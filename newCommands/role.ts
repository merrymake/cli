import { getArgs } from "../args";
import { Option, choice, shortText } from "../prompt";
import { AccessId, OrganizationId } from "../types";
import { addToExecuteQueue, finish, output2, sshReq } from "../utils";

const SPECIAL_ROLES = ["Pending", "Build agent", "Deployment agent"];
export async function do_attach_role(user: string, accessId: AccessId) {
  try {
    output2(
      await sshReq(`user-assign`, user, `--accessId`, accessId.toString())
    );
  } catch (e) {
    throw e;
  }
}

export async function do_auto_approve(domain: string, accessId: AccessId) {
  try {
    output2(
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
  try {
    output2(
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

function role_user_attach_role(user: string, accessId: AccessId) {
  addToExecuteQueue(() => do_attach_role(user, accessId));
  return finish();
}

function role_auto_domain_role(domain: string, accessId: AccessId) {
  addToExecuteQueue(() => do_auto_approve(domain, accessId));
  return finish();
}

function role_auto_remove(organizationId: OrganizationId, domain: string) {
  addToExecuteQueue(() => do_remove_auto_approve(organizationId, domain));
  return finish();
}

let roleListCache: { name: string; id: string }[] | undefined;
export async function listRoles(organizationId: OrganizationId) {
  if (roleListCache === undefined) {
    const resp = await sshReq(`role-list`, organizationId.toString());
    if (!resp.startsWith("[")) throw resp;
    roleListCache = JSON.parse(resp);
  }
  return roleListCache!;
}

async function role_user_attach(organizationId: OrganizationId, user: string) {
  try {
    const roles = await listRoles(organizationId);
    const options: Option[] = roles
      .filter((role) => !SPECIAL_ROLES.includes(role.name))
      .map((role) => {
        return {
          long: role.id,
          text: `assign ${role.name} (${role.id})`,
          action: () => role_user_attach_role(user, new AccessId(role.id)),
        };
      });
    return await choice("Which role would you like to assign?", options).then(
      (x) => x
    );
  } catch (e) {
    throw e;
  }
}

async function role_user(organizationId: OrganizationId, user: string) {
  try {
    const roles = await listRoles(organizationId);
    const pendingId = roles.find((x) => x.name === "Pending")!.id;
    const options: Option[] = [];
    options.push({
      long: `assign`,
      short: `a`,
      text: `assign an additional role to user`,
      action: () => role_user_attach(organizationId, user),
    });
    options.push({
      long: `remove`,
      short: `r`,
      text: `remove all roles and access`,
      action: () => role_user_attach_role(user, new AccessId(pendingId)),
    });
    return await choice("What would you like to do?", options).then();
  } catch (e) {
    throw e;
  }
}

async function role_auto_new_domain(
  organizationId: OrganizationId,
  domain: string
) {
  try {
    const roles = await listRoles(organizationId);
    const options: Option[] = roles
      .filter((role) => !SPECIAL_ROLES.includes(role.name))
      .map((role) => {
        return {
          long: role.id,
          text: `auto assign ${role.name} (${role.id})`,
          action: () => role_auto_domain_role(domain, new AccessId(role.id)),
        };
      });
    return await choice("Which role should new users get?", options).then(
      (x) => x
    );
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
    options.push({
      long: `new`,
      short: `n`,
      text: `setup a new domain rule`,
      action: () => role_auto_new(organizationId),
    });
    return await choice("What would you like to do?", options).then();
  } catch (e) {
    throw e;
  }
}

export async function role(organizationId: OrganizationId) {
  try {
    const resp = await sshReq(`user-list`, organizationId.toString());
    const users: { email: string; id: string; roles: string }[] =
      JSON.parse(resp);
    const options: Option[] = users.map((user) => {
      return {
        long: user.email,
        text: `${user.email}: ${user.roles}`,
        action: () => role_user(organizationId, user.id),
      };
    });
    // options.push({
    //   long: `new`,
    //   short: `n`,
    //   text: `create a new role`,
    //   action: () => role_new(org),
    // });
    options.push({
      long: `auto`,
      short: `a`,
      text: `configure domain auto approval`,
      action: () => role_auto(organizationId),
    });
    return await choice("Which user do you want to manage?", options).then(
      (x) => x
    );
  } catch (e) {
    throw e;
  }
}
