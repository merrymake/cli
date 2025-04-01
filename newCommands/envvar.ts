import { MerrymakeCrypto } from "@merrymake/secret-lib";
import fs from "fs";
import { GIT_HOST } from "../config.js";
import { addToExecuteQueue, finish } from "../exitMessages.js";
import { Option, Visibility, choice, shortText } from "../prompt.js";
import {
  OrganizationId,
  PathToOrganization,
  ServiceGroupId,
} from "../types.js";
import { execPromise, sshReq } from "../utils.js";
import { outputGit } from "../printUtils.js";
import { randomBytes } from "crypto";
import { readFile, rm } from "fs/promises";

async function do_envvar(
  pathToOrganization: PathToOrganization,
  organizationId: OrganizationId,
  serviceGroupId: ServiceGroupId,
  key: string,
  value: Buffer,
  access: ("--inInitRun" | "--inProduction")[],
  encrypted: boolean
) {
  const keyFolder = pathToOrganization.with(".merrymake").with(".key");
  try {
    let val: string;
    if (encrypted === true) {
      const repoBase = `${GIT_HOST}/o${organizationId.toString()}/g${serviceGroupId.toString()}/.key`;
      await rm(keyFolder.toString(), { force: true, recursive: true });
      await execPromise(
        `git clone -q "${repoBase}"`,
        pathToOrganization.with(".merrymake").toString()
      );
      const key = await readFile(keyFolder.with("merrymake.key").toString());
      console.log(value.toString());
      val = new MerrymakeCrypto().encrypt(value, key).toString("base64");
      value.fill(0);
      key.fill(0);
    } else {
      val = value.toString();
    }
    outputGit(
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
  } catch (e) {
    throw e;
  } finally {
    rm(keyFolder.toString(), {
      force: true,
      recursive: true,
    });
  }
}

function envvar_key_value_access_visible(
  pathToOrganization: PathToOrganization,
  organizationId: OrganizationId,
  serviceGroupId: ServiceGroupId,
  key: string,
  value: Buffer,
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
  value: Buffer,
  secret: boolean,
  init: boolean,
  prod: boolean
) {
  return choice(
    "Where would you like the variable to be visible?",
    [
      {
        long: "both",
        short: "b",
        text: "accessible in both prod and init run",
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
    ],
    { def: init ? (prod ? 0 : 2) : 1 }
  );
}

async function envvar_key_visible(
  pathToOrganization: PathToOrganization,
  organizationId: OrganizationId,
  serviceGroupId: ServiceGroupId,
  key: string,
  secret: boolean,
  init: boolean,
  prod: boolean
) {
  try {
    const value = await shortText(
      "Value",
      "The value...",
      "",
      secret === true ? { hide: Visibility.Secret } : undefined
    ).then();
    if (value !== "")
      return envvar_key_visible_value(
        pathToOrganization,
        organizationId,
        serviceGroupId,
        key,
        Buffer.from(value),
        secret,
        init,
        prod
      );
    else
      return envvar_key_value_access_visible(
        pathToOrganization,
        organizationId,
        serviceGroupId,
        key,
        Buffer.from(""),
        ["--inProduction", "--inInitRun"],
        false
      );
  } catch (e) {
    throw e;
  }
}

async function envvar_key_random(
  pathToOrganization: PathToOrganization,
  organizationId: OrganizationId,
  serviceGroupId: ServiceGroupId,
  key: string,
  init: boolean,
  prod: boolean
) {
  try {
    const value = +(await shortText("Length", "How many bytes", "32").then());
    const bytes = randomBytes(value);
    console.log(bytes.toString("base64"));
    console.log(bytes.toString("hex"));
    return envvar_key_visible_value(
      pathToOrganization,
      organizationId,
      serviceGroupId,
      key,
      Buffer.from(bytes.toString("base64")),
      true,
      init,
      prod
    );
  } catch (e) {
    throw e;
  }
}

function envvar_key(
  pathToOrganization: PathToOrganization,
  organizationId: OrganizationId,
  serviceGroupId: ServiceGroupId,
  key: string,
  secret: boolean,
  init: boolean,
  prod: boolean
) {
  return choice(
    "What type of data is it?",
    [
      {
        long: "secret",
        short: "s",
        text: "custom secret value",
        action: () =>
          envvar_key_visible(
            pathToOrganization,
            organizationId,
            serviceGroupId,
            key,
            true,
            init,
            prod
          ),
      },
      {
        long: "internal",
        short: "i",
        text: "custom internal value",
        action: () =>
          envvar_key_visible(
            pathToOrganization,
            organizationId,
            serviceGroupId,
            key,
            false,
            init,
            prod
          ),
      },
      {
        long: "random",
        short: "r",
        text: "random bytes",
        action: () =>
          envvar_key_random(
            pathToOrganization,
            organizationId,
            serviceGroupId,
            key,
            init,
            prod
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
            Buffer.from(""),
            ["--inProduction", "--inInitRun"],
            false
          ),
      },
    ],
    { def: secret ? 0 : 1 }
  );
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
      "DB"
    ).then();
    return envvar_key(
      pathToOrganization,
      organizationId,
      serviceGroupId,
      key,
      true,
      true,
      true
    );
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
    const orgs: { k: string; v: string; i: boolean; p: boolean; s: boolean }[] =
      JSON.parse(resp);
    const options: Option[] = orgs.map((x) => ({
      long: x.k,
      text: `[${x.i ? "I" : " "}${x.p ? "P" : " "}] ${x.k}: ${x.v}`,
      action: () =>
        envvar_key(
          pathToOrganization,
          organizationId,
          serviceGroupId,
          x.k,
          x.s,
          x.i,
          x.p
        ),
    }));
    options.push({
      long: `new`,
      short: `n`,
      text: `add a new environment variable`,
      action: () =>
        envvar_new(pathToOrganization, organizationId, serviceGroupId),
    });
    return await choice(
      "Which environment variable would you like to edit?",
      options
    ).then();
  } catch (e) {
    throw e;
  }
}
