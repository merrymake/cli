import path from "path";
import os from "os";
import fs from "fs";
import { COLOR1, NORMAL_COLOR, choice, shortText } from "./prompt";
import {
  addToExecuteQueue,
  directoryNames,
  execPromise,
  finish,
  getCache,
  getFiles,
  sshReq,
} from "./utils";
import { Option } from "./prompt";
import { Path, TODO, fetchOrgRaw } from "./utils";
import {
  do_clone,
  createOrganization,
  createService,
  createServiceGroup,
  do_build,
  do_deploy,
  do_redeploy,
  do_register,
  fetch_template,
  generateNewKey,
  useExistingKey,
  do_fetch,
  do_inspect,
  do_key,
  do_envvar,
  do_cron,
} from "./executors";
import {
  VERSION_CMD,
  type ProjectType,
} from "@mist-cloud-eu/project-type-detect";
import { execSync } from "child_process";
import { languages, templates } from "./templates";
import { Run } from "./simulator";
import { getArgs, initializeArgs } from "./args";

function service_template_language(
  path: Path,
  template: string,
  language: string
) {
  addToExecuteQueue(() => fetch_template(path, template, language));
  return finish();
}

function register_key_email(keyAction: () => Promise<string>, email: string) {
  addToExecuteQueue(() => do_register(keyAction, email));
  return finish();
}

function deploy() {
  addToExecuteQueue(() => do_deploy());
  return finish();
}

function redeploy() {
  addToExecuteQueue(() => do_redeploy());
  return finish();
}

function build() {
  addToExecuteQueue(() => do_build());
  return finish();
}

function fetch() {
  addToExecuteQueue(() => do_fetch());
  return finish();
}

async function service_template(path: Path, template: string) {
  try {
    let langs = await Promise.all(
      templates[template].languages.map((x) =>
        (async () => ({
          ...languages[x],
          weight: await execPromise(VERSION_CMD[languages[x].projectType])
            .then((x) => 10)
            .catch((e) => 1),
        }))()
      )
    );
    langs.sort((a, b) => b.weight - a.weight);
    return await choice(
      langs.map((x) => ({
        long: x.long,
        short: x.short,
        text: x.long,
        action: () => service_template_language(path, template, x.long),
      }))
    ).then((x) => x);
  } catch (e) {
    throw e;
  }
}

async function service(pathToGroup: Path, group: string) {
  try {
    let name = await shortText(
      "Repository name",
      "This is where the code lives.",
      "Merrymake"
    ).then((x) => x);
    addToExecuteQueue(() => createService(pathToGroup, group, name));
    let options: Option[] = [];
    let services = directoryNames(pathToGroup, []);
    if (services.length > 1) {
      options.push({
        long: "duplicate",
        short: "d",
        text: "duplicate an existing service",
        action: TODO,
      });
    }
    Object.keys(templates).forEach((x) =>
      options.push({
        long: templates[x].long,
        short: templates[x].short,
        text: templates[x].text,
        action: () => service_template(pathToGroup.with(group).with(name), x),
      })
    );
    options.push({
      long: "empty",
      short: "e",
      text: "just an empty repository",
      action: () => finish(),
    });
    return await choice(options).then((x) => x);
  } catch (e) {
    throw e;
  }
}

async function group(path: Path) {
  try {
    let name = await shortText(
      "Service group name",
      "Used to share envvars.",
      "services"
    ).then((x) => x);
    addToExecuteQueue(() => createServiceGroup(path, name));
    return service(path.with(name), name);
  } catch (e) {
    throw e;
  }
}

async function org() {
  try {
    let defName = "org" + ("" + Math.random()).substring(2);
    let name = await shortText(
      "Organization name",
      "Used when collaborating with others.",
      defName
    ).then((x) => x);
    addToExecuteQueue(() => createOrganization(name));
    return group(new Path(name));
  } catch (e) {
    throw e;
  }
}

async function register_key(keyAction: () => Promise<string>) {
  try {
    let email = await shortText(
      "Email",
      "By attaching an email you'll be notified in case of changes for your organizations.",
      ""
    ).then((x) => x);
    return register_key_email(keyAction, email);
  } catch (e) {
    throw e;
  }
}

async function register() {
  try {
    let keys = getFiles(new Path(`${os.homedir()}/.ssh`), "")
      .filter((x) => x.endsWith(".pub"))
      .map<Option>((x) => {
        let f = x.substring(0, x.length - ".pub".length);
        return {
          long: f,
          text: `Use key ${f}`,
          action: () => register_key(() => useExistingKey(f)),
        };
      });
    keys.push({
      long: "new",
      short: "n",
      text: "Setup new key specifically for Merrymake",
      action: () => register_key(generateNewKey),
    });
    return await choice(keys, true, keys.length - 1).then((x) => x);
  } catch (e) {
    throw e;
  }
}

function checkout_org(org: string) {
  addToExecuteQueue(() => do_clone(org));
  return finish();
}

function queue_event(org: string, id: string, river: string) {
  addToExecuteQueue(() => do_inspect(org, id, river));
  return finish();
}

async function checkout() {
  try {
    let resp = await sshReq(`list-organizations`);
    let orgs: string[] = JSON.parse(resp);
    return await choice(
      orgs.map((x) => ({
        long: x,
        text: `checkout ${x}`,
        action: () => checkout_org(x),
      }))
    ).then((x) => x);
  } catch (e) {
    throw e;
  }
}

let cache_queue: {
  id: string;
  q: string;
  s: string;
  e: string;
  r: string;
}[];

async function queue_id(org: string, id: string) {
  try {
    return await choice(
      cache_queue
        .filter((x) => x.id === id)
        .map((x) => ({
          long: x.r,
          text: `${
            x.r.length > 12
              ? x.r.substring(0, 9) + "..."
              : x.r.padStart(12, " ")
          } │ ${
            x.e.length > 12 ? x.e.substring(0, 9) + "..." : x.e.padEnd(12, " ")
          } │ ${x.s} │ ${new Date(x.q).toLocaleString()}`,
          action: () => queue_event(org, x.id, x.r),
        })),
      false
    ).then((x) => x);
  } catch (e) {
    throw e;
  }
}

async function queue(org: string) {
  try {
    let resp = await sshReq(`queue`, `--org`, org);
    cache_queue = JSON.parse(resp);
    return await choice(
      cache_queue.map((x) => ({
        long: x.id,
        text: `${x.id} │ ${
          x.r.length > 12 ? x.r.substring(0, 9) + "..." : x.r.padStart(12, " ")
        } │ ${
          x.e.length > 12 ? x.e.substring(0, 9) + "..." : x.e.padEnd(12, " ")
        } │ ${x.s} │ ${new Date(x.q).toLocaleString()}`,
        action: () => {
          if (getArgs().length === 0) initializeArgs([x.r]);
          return queue_id(org, x.id);
        },
      })),
      false
    ).then((x) => x);
  } catch (e) {
    throw e;
  }
}

function keys_key_name_duration(
  org: string,
  key: string | null,
  name: string,
  duration: string
) {
  addToExecuteQueue(() => do_key(org, key, name, duration));
  return finish();
}

async function keys_key_name(org: string, key: string | null, name: string) {
  try {
    let duration = await shortText(
      "Duration",
      "How long should the key be active? Ex. 1 hour",
      "14 days"
    );
    return keys_key_name_duration(org, key, name, duration);
  } catch (e) {
    throw e;
  }
}

async function keys_key(org: string, key: string | null, currentName: string) {
  try {
    let name = await shortText(
      "Human readable description",
      "Used to identify this key",
      currentName
    );
    return keys_key_name(org, key, name);
  } catch (e) {
    throw e;
  }
}

function envvar_key_value_access_visible(
  org: string,
  group: string,
  overwrite: string,
  key: string,
  value: string,
  access: string[],
  visibility: string
) {
  addToExecuteQueue(() =>
    do_envvar(org, group, overwrite, key, value, access, visibility)
  );
  return finish();
}

async function envvar_key_value_access(
  org: string,
  group: string,
  overwrite: string,
  key: string,
  value: string,
  access: string[]
) {
  try {
    return choice([
      {
        long: "secret",
        short: "s",
        text: "keep value secret",
        action: () =>
          envvar_key_value_access_visible(
            org,
            group,
            overwrite,
            key,
            value,
            access,
            ""
          ),
      },
      {
        long: "public",
        short: "p",
        text: "the value is public",
        action: () =>
          envvar_key_value_access_visible(
            org,
            group,
            overwrite,
            key,
            value,
            access,
            "--public"
          ),
      },
    ]);
  } catch (e) {
    throw e;
  }
}

async function envvar_key_value(
  org: string,
  group: string,
  overwrite: string,
  key: string,
  value: string
) {
  try {
    return choice([
      {
        long: "both",
        short: "b",
        text: "accessible in both prod and test",
        action: () =>
          envvar_key_value_access(org, group, overwrite, key, value, [
            "--prod",
            "--test",
          ]),
      },
      {
        long: "prod",
        short: "p",
        text: "accessible in prod",
        action: () =>
          envvar_key_value_access(org, group, overwrite, key, value, [
            "--prod",
          ]),
      },
      {
        long: "test",
        short: "t",
        text: "accessible in test",
        action: () =>
          envvar_key_value_access(org, group, overwrite, key, value, [
            "--test",
          ]),
      },
    ]);
  } catch (e) {
    throw e;
  }
}

async function envvar_key(
  org: string,
  group: string,
  overwrite: string,
  key: string,
  currentValue: string
) {
  try {
    let value = await shortText("Value", "The value...", currentValue);
    return envvar_key_value(org, group, overwrite, key, value);
  } catch (e) {
    throw e;
  }
}

async function keys(org: string) {
  try {
    let resp = await sshReq(`list-keys`, `--org`, org);
    let orgs: { name: string; key: string; expiry: Date }[] = JSON.parse(resp);
    let options: Option[] = orgs.map((x) => {
      let d = new Date(x.expiry);
      let ds =
        d.getTime() < Date.now()
          ? `${COLOR1}${d.toLocaleString()}${NORMAL_COLOR}`
          : d.toLocaleString();
      let n = x.name || "";
      return {
        long: x.key,
        text: `${x.key} │ ${
          n.length > 10 ? n.substring(0, 7) + "..." : n.padStart(10, " ")
        } │ ${ds}`,
        action: () => keys_key(org, x.key, x.name),
      };
    });
    options.push({
      long: `new`,
      short: `n`,
      text: `add a new apikey`,
      action: () => keys_key(org, null, ""),
    });
    return await choice(options).then((x) => x);
  } catch (e) {
    throw e;
  }
}

async function envvar_new(org: string, group: string) {
  try {
    let key = await shortText("Key", "Key for the key-value pair", "key");
    return envvar_key(org, group, "", key, "");
  } catch (e) {
    throw e;
  }
}

async function envvar(org: string, group: string) {
  try {
    let resp = await sshReq(`list-secrets`, `--org`, org, `--team`, group);
    let orgs: { key: string; val: string; prod: boolean; test: boolean }[] =
      JSON.parse(resp);
    let options: Option[] = orgs.map((x) => ({
      long: x.key,
      text: `[${x.test ? "T" : " "}${x.prod ? "P" : " "}] ${x.key}: ${x.val}`,
      action: () => envvar_key(org, group, "--overwrite", x.key, x.val),
    }));
    options.push({
      long: `new`,
      short: `n`,
      text: `add a new secret`,
      action: () => envvar_new(org, group),
    });
    return await choice(options).then((x) => x);
  } catch (e) {
    throw e;
  }
}

function cron_name_event_expression(
  org: string,
  name: string,
  overwrite: string,
  event: string,
  expression: string
) {
  addToExecuteQueue(() => do_cron(org, name, overwrite, event, expression));
  return finish();
}

async function cron_name_event(
  org: string,
  name: string,
  overwrite: string,
  event: string,
  currentExpression: string
) {
  try {
    let expression = await shortText(
      "Cron expression",
      "Eg. every 5 minutes is '*/5 * * * *'",
      currentExpression
    );
    return cron_name_event_expression(org, name, overwrite, event, expression);
  } catch (e) {
    throw e;
  }
}

async function cron_name(
  org: string,
  name: string,
  currentEvent: string,
  expression: string
) {
  try {
    let event = await shortText(
      "Which event to spawn",
      "Event that should be spawned",
      currentEvent
    );
    return cron_name_event(org, name, "--overwrite", event, expression);
  } catch (e) {
    throw e;
  }
}

async function cron_new_event(org: string, event: string) {
  try {
    let name = await shortText(
      "Unique name",
      "Used to edit or delete the cron job later",
      event
    );
    return cron_name_event(org, name, "", event, "");
  } catch (e) {
    throw e;
  }
}

async function cron_new(org: string) {
  try {
    let event = await shortText(
      "Which event to spawn",
      "Event that should be spawned",
      "event"
    );
    return cron_new_event(org, event);
  } catch (e) {
    throw e;
  }
}

async function cron(org: string) {
  try {
    let resp = await sshReq(`list-crons`, `--org`, org);
    let orgs: { name: string; event: string; expression: string }[] =
      JSON.parse(resp);
    let options: Option[] = orgs.map((x) => ({
      long: x.name,
      text: `${
        x.name.length > 10
          ? x.name.substring(0, 7) + "..."
          : x.name.padStart(10, " ")
      } │ ${
        x.event.length > 10
          ? x.event.substring(0, 7) + "..."
          : x.event.padStart(10, " ")
      } │ ${x.expression}`,
      action: () => cron_name(org, x.name, x.event, x.expression),
    }));
    options.push({
      long: `new`,
      short: `n`,
      text: `setup a new cron job`,
      action: () => cron_new(org),
    });
    return await choice(options).then((x) => x);
  } catch (e) {
    throw e;
  }
}

function quickstart() {
  let cache = getCache();
  if (!cache.registered)
    addToExecuteQueue(() => do_register(generateNewKey, ""));
  let orgName = "org" + ("" + Math.random()).substring(2);
  let pth = new Path();
  addToExecuteQueue(() => createOrganization(orgName));
  pth = pth.with(orgName);
  addToExecuteQueue(() => createServiceGroup(pth, "services"));
  pth = pth.with("services");
  addToExecuteQueue(() => createService(pth, "services", "Merrymake"));
  pth = pth.with("Merrymake");
  return service_template(pth, "basic");
}

function sim() {
  addToExecuteQueue(() => new Run(3000).execute());
  return finish();
}

export async function start() {
  try {
    let struct = fetchOrgRaw();
    if (struct.org !== null) {
      let orgName = struct.org.name;
      // If in org
      let options: Option[] = [];
      let selectedServicePath: string | null = null;
      if (struct.serviceGroup !== null) {
        selectedServicePath = path.join(struct.pathToRoot, struct.serviceGroup);
      } else {
        let serviceGroups = directoryNames(new Path(), ["event-catalogue"]);
        if (serviceGroups.length === 1) {
          selectedServicePath = serviceGroups[0].name;
        }
      }

      options.push({
        long: "sim",
        short: "s",
        text: "run a local simulation of the system",
        action: () => sim(),
      });
      options.push({
        long: "queue",
        short: "q",
        text: "display the message queues or events",
        action: () => queue(orgName),
      });
      if (fs.existsSync("mist.json") || fs.existsSync("merrymake.json")) {
        // Inside a service
        options.push({
          long: "deploy",
          short: "d",
          text: "deploy service to the cloud",
          action: () => deploy(),
        });
        options.push({
          long: "redeploy",
          short: "r",
          text: "redeploy service to the cloud",
          action: () => redeploy(),
        });
        options.push({
          long: "build",
          short: "b",
          text: "build service locally",
          action: () => build(),
        });
      } else {
        // Not inside a service
        options.push({
          long: "fetch",
          short: "f",
          text: "fetch updates to service groups and services",
          action: () => fetch(),
        });
        if (selectedServicePath !== null) {
          // Inside a service group or has one service
          let selectedServicePath_hack = selectedServicePath;
          options.push({
            long: "repo",
            short: "r",
            text: "create a new repo",
            action: () =>
              service(
                new Path(selectedServicePath_hack),
                selectedServicePath_hack
              ),
          });
        }
      }

      if (selectedServicePath !== null) {
        // Inside a service group or service
        let selectedServicePath_hack = selectedServicePath;
        options.push({
          long: "envvar",
          short: "e",
          text: "add or edit envvar for service group",
          action: () => envvar(orgName, selectedServicePath_hack),
        });
      }

      if (struct.serviceGroup === null) {
        // In top level of organization
        options.push({
          long: "group",
          short: "g",
          text: "create a new service group",
          action: () => group(new Path()),
        });
      }

      options.push({
        long: "cron",
        short: "c",
        text: "add or edit cron jobs for the organization",
        action: () => cron(orgName),
      });
      options.push({
        long: "key",
        short: "k",
        text: "add or edit api-keys for the organization",
        action: () => keys(orgName),
      });

      return await choice(options).then((x) => x);
    } else {
      let cache = getCache();
      let options: (Option & { weight: number })[] = [];
      options.push({
        long: "register",
        short: "r",
        text: "register new device or user",
        action: () => register(),
        weight: !cache.registered ? 10 : 1,
      });
      options.push({
        long: "quickstart",
        text: "automatically register, and setup a standard demo organization",
        action: () => quickstart(),
        weight: !cache.registered ? 15 : 2,
      });
      options.push({
        long: "org",
        short: "o",
        text: "create a new organization",
        action: () => org(),
        weight: 5,
      });
      options.push({
        long: "clone",
        short: "c",
        text: "clone an existing organization",
        action: () => checkout(),
        weight: cache.hasOrgs ? 10 : 3,
      });
      options.sort((a, b) => b.weight - a.weight);
      return await choice(options).then((x) => x);
    }
  } catch (e) {
    throw e;
  }
}
