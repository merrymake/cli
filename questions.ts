import path from "path";
import os from "os";
import fs from "fs";
import {
  RED,
  NORMAL_COLOR,
  choice,
  shortText,
  spinner_start,
  spinner_stop,
} from "./prompt";
import {
  addToExecuteQueue,
  directoryNames,
  execPromise,
  finish,
  getCache,
  getFiles,
  output2,
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
  do_duplicate,
  do_queue_time,
  printTableHeader,
  alignRight,
  alignLeft,
  do_event,
  do_help,
} from "./executors";
import { VERSION_CMD, type ProjectType } from "@merrymake/detect-project-type";
import { execSync } from "child_process";
import { languages, templates } from "./templates";
import { Run } from "./simulator";
import { getArgs, initializeArgs } from "./args";
import { ADJECTIVE, NOUN } from "./words";

function service_template_language(
  path: Path,
  template: string,
  projectType: string
) {
  addToExecuteQueue(() => fetch_template(path, template, projectType));
  return finish();
}

function register_key_email(keyAction: () => Promise<string>, email: string) {
  addToExecuteQueue(() => do_register(keyAction, email));
  return finish();
}

function deploy() {
  addToExecuteQueue(() => do_deploy(new Path()));
  return finish();
}

function redeploy() {
  addToExecuteQueue(() => do_redeploy());
  return finish();
}

function help() {
  addToExecuteQueue(() => do_help());
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

async function service_template(pathToService: Path, template: string) {
  try {
    let langs = await Promise.all(
      templates[template].languages.map((x, i) =>
        (async () => ({
          ...languages[x],
          weight: await execPromise(VERSION_CMD[languages[x].projectType])
            .then((r) => {
              return templates[template].languages.length + 1 - i;
            })
            .catch((e) => {
              return -i;
            }),
        }))()
      )
    );
    langs.sort((a, b) => b.weight - a.weight);
    return await choice(
      langs.map((x) => ({
        long: x.long,
        short: x.short,
        text: x.long,
        action: () =>
          service_template_language(pathToService, template, x.projectType),
      }))
    ).then((x) => x);
  } catch (e) {
    throw e;
  }
}

function duplicate_service_deploy(
  pathToService: Path,
  org: string,
  group: string,
  service: string,
  deploy: boolean
) {
  addToExecuteQueue(() => do_duplicate(pathToService, org, group, service));
  if (deploy) addToExecuteQueue(() => do_deploy(pathToService));
  return finish();
}

function duplicate_service(
  pathToService: Path,
  org: string,
  group: string,
  service: string
) {
  return choice([
    {
      long: "deploy",
      short: "d",
      text: "deploy the service immediately",
      action: () =>
        duplicate_service_deploy(pathToService, org, group, service, true),
    },
    {
      long: "clone",
      short: "c",
      text: "only clone it, no deploy",
      action: () =>
        duplicate_service_deploy(pathToService, org, group, service, false),
    },
  ]);
}

async function duplicate(pathToService: Path, org: string, group: string) {
  try {
    let resp = await sshReq(`list-services`, `--org`, org, `--team`, group);
    let repos: string[] = JSON.parse(resp);
    return await choice(
      repos.map((x) => ({
        long: x,
        text: `${x}`,
        action: () => duplicate_service(pathToService, org, group, x),
      }))
    ).then((x) => x);
  } catch (e) {
    throw e;
  }
}

async function service(pathToGroup: Path, org: string, group: string) {
  try {
    let name = await shortText(
      "Repository name",
      "This is where the code lives.",
      "Merrymake"
    ).then((x) => x);
    addToExecuteQueue(() => createService(pathToGroup, group, name));
    let options: Option[] = [];
    let services = directoryNames(pathToGroup, []);
    if (services.length > 0) {
      options.push({
        long: "duplicate",
        short: "d",
        text: "duplicate an existing service",
        action: () => duplicate(pathToGroup.with(name), org, group),
      });
    }
    Object.keys(templates).forEach((x) =>
      options.push({
        long: templates[x].long,
        short: templates[x].short,
        text: templates[x].text,
        action: () => service_template(pathToGroup.with(name), x),
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

async function group(path: Path, org: string) {
  try {
    let name = await shortText(
      "Service group name",
      "Used to share envvars.",
      "services"
    ).then((x) => x);
    addToExecuteQueue(() => createServiceGroup(path, name));
    return service(path.with(name), org, name);
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

async function org() {
  try {
    let orgName = generateOrgName();
    let name = await shortText(
      "Organization name",
      "Used when collaborating with others.",
      orgName
    ).then((x) => x);
    addToExecuteQueue(() => createOrganization(name));
    return group(new Path(name), name);
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

async function register_manual() {
  try {
    let key = await shortText("Public key", "", "ssh-rsa ...").then((x) => x);
    return register_key(() => Promise.resolve(key));
  } catch (e) {
    throw e;
  }
}

async function register() {
  try {
    let keyfiles = getFiles(new Path(`${os.homedir()}/.ssh`), "").filter((x) =>
      x.endsWith(".pub")
    );
    let keys = keyfiles.map<Option>((x) => {
      let f = x.substring(0, x.length - ".pub".length);
      return {
        long: f,
        text: `Use key ${f}`,
        action: () => register_key(() => useExistingKey(f)),
      };
    });
    keys.push({
      long: "add",
      short: "a",
      text: "Manually add key",
      action: () => register_manual(),
    });
    if (keyfiles.includes("merrymake")) {
      keys.push({
        long: "new",
        short: "n",
        text: "Setup new key specifically for Merrymake",
        action: () => register_key(generateNewKey),
      });
    }
    return await choice(
      keys,
      { cmd: false, select: true },
      keys.length - 1
    ).then((x) => x);
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
  e: string;
  r: string;
  s: string;
}[];

function queue_id(org: string, id: string) {
  printTableHeader("      ", {
    River: 12,
    Event: 12,
    Status: 7,
    "Queue time": 20,
  });
  return choice(
    cache_queue
      .filter((x) => x.id === id)
      .map((x) => ({
        long: x.r,
        text: `${alignRight(x.r, 12)} │ ${alignLeft(x.e, 12)} │ ${alignLeft(
          x.s,
          7
        )} │ ${new Date(x.q).toLocaleString()}`,
        action: () => queue_event(org, x.id, x.r),
      })),
    { cmd: true, select: true }
  ).then((x) => x);
}

function queue_time_value(org: string, time: number) {
  addToExecuteQueue(() => do_queue_time(org, time));
  return finish();
}

async function queue_time(org: string) {
  try {
    let d = new Date(
      await shortText(
        "Time",
        "Displays events _around_ specified time.",
        "1995-12-17T03:24:00"
      )
    ).getTime();
    while (isNaN(d)) {
      output2("Invalid date, please try again.");
      d = new Date(
        await shortText(
          "Time",
          "Displays events _around_ specified time.",
          "1995-12-17T03:24:00"
        )
      ).getTime();
    }
    return queue_time_value(org, d);
  } catch (e) {
    throw e;
  }
}

const QUEUE_COUNT = 15;
async function queue(org: string, offset: number) {
  try {
    let options: Option[];
    if (["time", "next"].includes(getArgs()[0])) {
      options = [];
    } else {
      let resp = await sshReq(
        `queue`,
        `--org`,
        org,
        "--count",
        "" + QUEUE_COUNT,
        "--offset",
        "" + offset
      );
      cache_queue = JSON.parse(resp);
      printTableHeader("      ", {
        Id: 6,
        River: 12,
        Event: 12,
        Status: 7,
        "Queue time": 20,
      });
      options = cache_queue.map((x) => ({
        long: x.id,
        text: `${x.id} │ ${alignRight(x.r, 12)} │ ${alignLeft(
          x.e,
          12
        )} │ ${alignLeft(x.s, 7)} │ ${new Date(x.q).toLocaleString()}`,
        action: () => {
          if (getArgs().length === 0) initializeArgs([x.r]);
          return queue_id(org, x.id);
        },
      }));
    }
    options.push({
      long: `next`,
      short: `n`,
      text: `next page`,
      action: () => queue(org, offset + QUEUE_COUNT),
    });
    options.push({
      long: `time`,
      short: `t`,
      text: `specify time`,
      action: () => queue_time(org),
    });
    return await choice(options, { cmd: false, select: false }).then((x) => x);
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

function envvar_key_value_access(
  org: string,
  group: string,
  overwrite: string,
  key: string,
  value: string,
  access: string[]
) {
  return choice([
    {
      long: "secret",
      short: "s",
      text: "keep the value secret",
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
}

function envvar_key_value(
  org: string,
  group: string,
  overwrite: string,
  key: string,
  value: string
) {
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
        envvar_key_value_access(org, group, overwrite, key, value, ["--prod"]),
    },
    {
      long: "test",
      short: "t",
      text: "accessible in test",
      action: () =>
        envvar_key_value_access(org, group, overwrite, key, value, ["--test"]),
    },
  ]);
}

async function envvar_key(
  org: string,
  group: string,
  overwrite: string,
  key: string,
  currentValue: string
) {
  try {
    let value = await shortText("Value", "The value...", "");
    if (value !== "")
      return envvar_key_value(org, group, overwrite, key, value);
    else
      return envvar_key_value_access_visible(
        org,
        group,
        overwrite,
        key,
        value,
        ["--prod", "--test"],
        "--public"
      );
  } catch (e) {
    throw e;
  }
}

async function keys(org: string) {
  try {
    let resp = await sshReq(`list-keys`, `--org`, org);
    let keys: { name: string; key: string; expiry: Date }[] = JSON.parse(resp);
    let options: Option[] = keys.map((x) => {
      let d = new Date(x.expiry);
      let ds =
        d.getTime() < Date.now()
          ? `${RED}${d.toLocaleString()}${NORMAL_COLOR}`
          : d.toLocaleString();
      let n = x.name || "";
      return {
        long: x.key,
        text: `${x.key} │ ${alignLeft(n, 12)} │ ${ds}`,
        action: () => keys_key(org, x.key, x.name),
      };
    });
    options.push({
      long: `new`,
      short: `n`,
      text: `add a new apikey`,
      action: () => keys_key(org, null, ""),
    });
    if (options.length > 1)
      printTableHeader("      ", { Key: 36, Name: 12, "Expiry time": 20 });
    return await choice(options).then((x) => x);
  } catch (e) {
    throw e;
  }
}

function event_key_event(
  org: string,
  key: string,
  event: string,
  create: boolean
) {
  addToExecuteQueue(() => do_event(org, key, event, create));
  return finish();
}

async function event_key_new(org: string, key: string) {
  try {
    let eventType = await shortText(
      "Event type",
      "Event type to allow through key",
      "hello"
    );
    return event_key_event(org, key, eventType, true);
  } catch (e) {
    throw e;
  }
}

async function event_key(org: string, key: string) {
  try {
    let resp = await sshReq(`list-events`, `--org`, org, `--key`, key);
    let events: { event: string }[] = JSON.parse(resp);
    let options: Option[] = events.map((x) => {
      return {
        long: x.event,
        text: `disallow ${x.event}`,
        action: () => event_key_event(org, key, x.event, false),
      };
    });
    options.push({
      long: `new`,
      short: `n`,
      text: `allow a new event type`,
      action: () => event_key_new(org, key),
    });
    return await choice(options).then((x) => x);
  } catch (e) {
    throw e;
  }
}

async function event(org: string) {
  try {
    let resp = await sshReq(`list-keys`, `--org`, org, `--active`);
    let keys: { name: string; key: string }[] = JSON.parse(resp);
    let options: Option[] = keys.map((x) => {
      let n = x.name || "";
      return {
        long: x.key,
        text: `${x.key} │ ${alignLeft(n, 12)}`,
        action: () => event_key(org, x.key),
      };
    });
    options.push({
      long: `new`,
      short: `n`,
      text: `add a new apikey`,
      action: () => keys_key(org, null, ""),
    });
    if (options.length > 1) printTableHeader("      ", { Key: 36, Name: 12 });
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
      text: `[${x.test ? "T" : " "}${x.prod ? "P" : " "}] ${x.key}: ${
        x.val ? x.val : "***"
      }`,
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
      ""
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
      text: `${alignRight(x.name, 10)} │ ${alignRight(x.event, 10)} │ ${
        x.expression
      }`,
      action: () => cron_name(org, x.name, x.event, x.expression),
    }));
    options.push({
      long: `new`,
      short: `n`,
      text: `setup a new cron job`,
      action: () => cron_new(org),
    });
    if (options.length > 1)
      printTableHeader("      ", { Name: 10, Event: 10, Expression: 20 });
    return await choice(options).then((x) => x);
  } catch (e) {
    throw e;
  }
}

function generateOrgName() {
  if (
    process.env["MERRYMAKE_NAME_LENGTH"] !== undefined &&
    !Number.isNaN(+process.env["MERRYMAKE_NAME_LENGTH"])
  )
    return "org" + generateString(+process.env["MERRYMAKE_NAME_LENGTH"] - 3);
  else
    return (
      ADJECTIVE[~~(ADJECTIVE.length * Math.random())] +
      "-" +
      NOUN[~~(NOUN.length * Math.random())] +
      "-" +
      NOUN[~~(NOUN.length * Math.random())]
    );
}

function quickstart() {
  let cache = getCache();
  if (!cache.registered)
    addToExecuteQueue(() => do_register(generateNewKey, ""));
  let orgName = generateOrgName();
  let pth = new Path();
  addToExecuteQueue(() => createOrganization(orgName));
  let pathToOrg = pth.with(orgName);
  addToExecuteQueue(() => do_key(orgName, null, "from quickcreate", "14days"));
  addToExecuteQueue(() => createServiceGroup(pathToOrg, "services"));
  let pathToGroup = pathToOrg.with("services");
  addToExecuteQueue(() => createService(pathToGroup, "services", "Merrymake"));
  let pathToService = pathToGroup.with("Merrymake");
  return service_template(pathToService, "basic");
}

function sim() {
  addToExecuteQueue(() => new Run(3000).execute());
  return finish();
}

export async function start() {
  try {
    let rawStruct = fetchOrgRaw();
    if (rawStruct.org !== null) {
      let orgName = rawStruct.org.name;
      // If in org
      let options: Option[] = [];
      let selectedGroup: { name: string; path: Path } | null = null;
      let struct = {
        org: rawStruct.org,
        serviceGroup:
          rawStruct.serviceGroup !== "event-catalogue"
            ? rawStruct.serviceGroup
            : null,
        inEventCatalogue: rawStruct.serviceGroup === "event-catalogue",
        pathToRoot: rawStruct.pathToRoot,
      };
      if (struct.serviceGroup !== null) {
        selectedGroup = {
          name: struct.serviceGroup,
          path: new Path(struct.pathToRoot).withoutLastUp(),
        };
      } else {
        let serviceGroups = directoryNames(new Path(), ["event-catalogue"]);
        if (serviceGroups.length === 1) {
          selectedGroup = {
            name: serviceGroups[0].name,
            path: new Path(serviceGroups[0].name),
          };
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
        action: () => queue(orgName, 0),
      });
      if (
        fs.existsSync("mist.json") ||
        fs.existsSync("merrymake.json") ||
        struct.inEventCatalogue
      ) {
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
      } else {
        // Not inside a service
        options.push({
          long: "fetch",
          short: "f",
          text: "fetch updates to service groups and services",
          action: () => fetch(),
        });
        if (selectedGroup !== null) {
          // Inside a service group or has one service
          let selectedGroup_hack = selectedGroup;
          options.push({
            long: "repo",
            short: "r",
            text: "create a new repo",
            action: () =>
              service(
                selectedGroup_hack.path,
                orgName,
                selectedGroup_hack.name
              ),
          });
        }
      }
      if (fs.existsSync("mist.json") || fs.existsSync("merrymake.json")) {
        options.push({
          long: "build",
          short: "b",
          text: "build service locally",
          action: () => build(),
        });
      }

      if (selectedGroup !== null) {
        // Inside a service group or service
        let selectedGroup_hack = selectedGroup;
        options.push({
          long: "envvar",
          short: "e",
          text: "add or edit envvar for service group",
          action: () => envvar(orgName, selectedGroup_hack.name),
        });
      }

      if (struct.serviceGroup === null) {
        // In top level of organization
        options.push({
          long: "group",
          short: "g",
          text: "create a new service group",
          action: () => group(new Path(), orgName),
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
      options.push({
        long: "event",
        short: "v",
        text: "allow or disallow events through api-keys for the organization",
        action: () => event(orgName),
      });
      options.push({
        long: "help",
        text: "help diagnose potential issues",
        action: () => help(),
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
        text: "quickstart with auto registration and a standard demo organization",
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
      options.push({
        long: "help",
        text: "help diagnose potential issues",
        action: () => help(),
        weight: 0,
      });
      options.sort((a, b) => b.weight - a.weight);
      return await choice(options).then((x) => x);
    }
  } catch (e) {
    throw e;
  }
}
