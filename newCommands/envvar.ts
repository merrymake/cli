import { MerrymakeCrypto } from "@merrymake/secret-lib";
import fs from "fs";
import path from "path";
import { GIT_HOST } from "../config";
import { Option, Visibility, choice, shortText } from "../prompt";
import { OrganizationId, PathToOrganization, ServiceGroupId } from "../types";
import {
  addToExecuteQueue,
  execPromise,
  finish,
  output2,
  sshReq,
} from "../utils";

async function do_envvar(
  pathToOrganization: PathToOrganization,
  organizationId: OrganizationId,
  serviceGroupId: ServiceGroupId,
  key: string,
  value: string,
  access: ("--inInitRun" | "--inProduction")[],
  encrypted: boolean
) {
  try {
    let val: string;
    if (encrypted === true) {
      const repoBase = `${GIT_HOST}/o${organizationId.toString()}/g${serviceGroupId.toString()}/.key`;
      await execPromise(
        `git clone -q "${repoBase}"`,
        pathToOrganization.with(".merrymake").toString()
      );
      const key = fs.readFileSync(
        pathToOrganization
          .with(".merrymake")
          .with(".key")
          .with("merrymake.key")
          .toString()
      );
      val = new MerrymakeCrypto()
        .encrypt(Buffer.from(value), key)
        .toString("base64");
    } else {
      val = value;
    }
    output2(
      await sshReq(
        `envvar-set`,
        key,
        ...access,
        `--serviceGroupId`,
        serviceGroupId.toString(),
        `--value`,
        val,
        ...(encrypted ? ["--encrypted"] : [])
      )
    );
    if (encrypted === true) {
      fs.rmSync(
        path.join(
          pathToOrganization.with(".merrymake").with(".key").toString()
        ),
        {
          force: true,
          recursive: true,
        }
      );
    }
  } catch (e) {
    throw e;
  }
}

function envvar_key_value_access_visible(
  pathToOrganization: PathToOrganization,
  organizationId: OrganizationId,
  serviceGroupId: ServiceGroupId,
  key: string,
  value: string,
  access: ("--inInitRun" | "--inProduction")[],
  secret: boolean
) {
  addToExecuteQueue(() =>
    do_envvar(
      pathToOrganization,
      organizationId,
      serviceGroupId,
      key,
      value,
      access,
      secret
    )
  );
  return finish();
}

function envvar_key_visible_value(
  pathToOrganization: PathToOrganization,
  organizationId: OrganizationId,
  serviceGroupId: ServiceGroupId,
  key: string,
  value: string,
  secret: boolean
) {
  return choice("Where would you like the variable to be visible?", [
    {
      long: "both",
      short: "b",
      text: "accessible in both prod and smoke test",
      action: () =>
        envvar_key_value_access_visible(
          pathToOrganization,
          organizationId,
          serviceGroupId,
          key,
          value,
          ["--inProduction", "--inInitRun"],
          secret
        ),
    },
    {
      long: "prod",
      short: "p",
      text: "accessible in prod",
      action: () =>
        envvar_key_value_access_visible(
          pathToOrganization,
          organizationId,
          serviceGroupId,
          key,
          value,
          ["--inProduction"],
          secret
        ),
    },
    {
      long: "init",
      short: "i",
      text: "accessible in the init run",
      action: () =>
        envvar_key_value_access_visible(
          pathToOrganization,
          organizationId,
          serviceGroupId,
          key,
          value,
          ["--inInitRun"],
          secret
        ),
    },
  ]);
}

async function envvar_key_visible(
  pathToOrganization: PathToOrganization,
  organizationId: OrganizationId,
  serviceGroupId: ServiceGroupId,
  key: string,
  secret: boolean
) {
  try {
    const value = await shortText(
      "Value",
      "The value...",
      "",
      secret === true ? Visibility.Secret : Visibility.Public
    ).then();
    if (value !== "")
      return envvar_key_visible_value(
        pathToOrganization,
        organizationId,
        serviceGroupId,
        key,
        value,
        secret
      );
    else
      return envvar_key_value_access_visible(
        pathToOrganization,
        organizationId,
        serviceGroupId,
        key,
        value,
        ["--inProduction", "--inInitRun"],
        false
      );
  } catch (e) {
    throw e;
  }
}

function envvar_key(
  pathToOrganization: PathToOrganization,
  organizationId: OrganizationId,
  serviceGroupId: ServiceGroupId,
  key: string
) {
  return choice("What is the visibility of the variable?", [
    {
      long: "secret",
      short: "s",
      text: "the value is secret",
      action: () =>
        envvar_key_visible(
          pathToOrganization,
          organizationId,
          serviceGroupId,
          key,
          true
        ),
    },
    {
      long: "public",
      short: "p",
      text: "the value is public",
      action: () =>
        envvar_key_visible(
          pathToOrganization,
          organizationId,
          serviceGroupId,
          key,
          false
        ),
    },
    {
      long: "delete",
      short: "d",
      text: "delete the environment variable",
      action: () =>
        envvar_key_value_access_visible(
          pathToOrganization,
          organizationId,
          serviceGroupId,
          key,
          "",
          ["--inProduction", "--inInitRun"],
          false
        ),
    },
  ]);
}

async function envvar_new(
  pathToOrganization: PathToOrganization,
  organizationId: OrganizationId,
  serviceGroupId: ServiceGroupId
) {
  try {
    const key = await shortText(
      "Key",
      "Key for the key-value pair",
      "key"
    ).then();
    return envvar_key(pathToOrganization, organizationId, serviceGroupId, key);
  } catch (e) {
    throw e;
  }
}

export async function envvar(
  pathToOrganization: PathToOrganization,
  organizationId: OrganizationId,
  serviceGroupId: ServiceGroupId
) {
  try {
    const resp = await sshReq(`envvar-list`, serviceGroupId.toString());
    const orgs: { k: string; v: string; i: boolean; p: boolean }[] =
      JSON.parse(resp);
    const options: Option[] = orgs.map((x) => ({
      long: x.k,
      text: `[${x.i ? "I" : " "}${x.p ? "P" : " "}] ${x.k}: ${x.v}`,
      action: () =>
        envvar_key(pathToOrganization, organizationId, serviceGroupId, x.k),
    }));
    options.push({
      long: `new`,
      short: `n`,
      text: `add a new environment variable`,
      action: () =>
        envvar_new(pathToOrganization, organizationId, serviceGroupId),
    });
    return await choice(
      "Which environment variable do you want to edit?",
      options
    ).then();
  } catch (e) {
    throw e;
  }
}
