import fs from "fs";
import os from "os";
import {
  OrgFile,
  Path,
  execPromise,
  execStreamPromise,
  fetchOrg,
  output2,
  saveCache,
  addExitMessage,
  sshReq,
  urlReq,
  getCache,
  fetchOrgRaw,
} from "./utils";
import { API_URL, GIT_HOST, HTTP_HOST, RAPIDS_HOST, SSH_USER } from "./config";
import {
  detectProjectType,
  BUILD_SCRIPT_MAKERS,
} from "@merrymake/detect-project-type";
import { ExecOptions, spawn } from "child_process";
import { RED, BLUE, YELLOW, NORMAL_COLOR, GREEN } from "./prompt";
import path from "path";
import { getArgs } from "./args";
import { stdout } from "process";

async function clone(struct: any, name: string) {
  try {
    output2(`Cloning ${name}...`);
    fs.mkdirSync(`${name}/.merrymake`, { recursive: true });
    let orgFile: OrgFile = { name };
    fs.writeFileSync(`${name}/.merrymake/conf.json`, JSON.stringify(orgFile));
    await execPromise(
      `git clone --branch main -q "${GIT_HOST}/${name}/event-catalogue" event-catalogue`,
      name
    );
    let dir = `${name}/public`;
    fs.mkdirSync(dir, { recursive: true });
    await execPromise(`git init --initial-branch=main`, dir);
    await execPromise(
      `git remote add origin "${GIT_HOST}/${name}/public"`,
      dir
    );
    // await execPromise(`git fetch`, dir);
    fetch(`./${name}`, name, struct);
  } catch (e) {
    throw e;
  }
}

async function fetch(prefix: string, org: string, struct: any) {
  try {
    let keys = Object.keys(struct);
    for (let i = 0; i < keys.length; i++) {
      let group = keys[i];
      fs.mkdirSync(`${prefix}/${group}`, { recursive: true });
      await createFolderStructure(
        struct[group],
        `${prefix}/${group}`,
        org,
        group
      );
    }
  } catch (e) {
    throw e;
  }
}

export async function do_fetch() {
  try {
    let org = fetchOrg();
    let reply = await sshReq(`clone`, org.org.name);
    if (!reply.startsWith("{")) {
      output2(reply);
      return;
    }
    output2(`Fetching...`);
    let structure = JSON.parse(reply);
    await fetch(org.pathToRoot, org.org.name, structure);
  } catch (e) {
    throw e;
  }
}

async function createFolderStructure(
  struct: any,
  prefix: string,
  org: string,
  team: string
) {
  try {
    let keys = Object.keys(struct);
    for (let i = 0; i < keys.length; i++) {
      let k = keys[i];
      if (struct[k] instanceof Object)
        await createFolderStructure(struct[k], prefix + "/" + k, org, team);
      else {
        // output(`git clone "${HOST}/${org}/${team}/${k}" "${prefix}/${k}"`);
        let repo = `"${GIT_HOST}/${org}/${team}/${k}"`;
        let dir = `${prefix}/${k}`;
        try {
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          if (!fs.existsSync(dir + "/.git")) {
            output2("Here1 " + dir);
            await execPromise(`git init --initial-branch=main`, dir);
            output2("Here2 " + dir);
            await execPromise(`git remote add origin ${repo}`, dir);
            output2("Here3 " + dir);
            fs.writeFileSync(
              dir + "/fetch.bat",
              `@echo off
git fetch
git reset --hard origin/main
del fetch.sh
(goto) 2>nul & del fetch.bat`
            );
            fs.writeFileSync(
              dir + "/fetch.sh",
              `#!/bin/sh
git fetch
git reset --hard origin/main
rm fetch.bat fetch.sh`
            );
          } else {
            await execPromise(`git remote set-url origin ${repo}`, dir);
          }
        } catch (e) {
          console.log(e);
        }
      }
    }
  } catch (e) {
    throw e;
  }
}

export async function do_clone(name: string) {
  try {
    let reply = await sshReq(`clone`, name);
    if (!reply.startsWith("{")) {
      output2(reply);
      return;
    }
    let structure = JSON.parse(reply);
    await clone(structure, name);
  } catch (e) {
    throw e;
  }
}

export async function createOrganization(name: string) {
  try {
    let reply = await sshReq(`org`, name);
    if (!reply.startsWith("{")) {
      output2(reply);
      return;
    }
    let structure = JSON.parse(reply);
    await clone(structure, name);
  } catch (e) {
    throw e;
  }
}

export async function createServiceGroup(pth: Path, name: string) {
  try {
    let before = process.cwd();
    process.chdir(pth.toString());
    console.log("Creating service group...");
    let { org } = fetchOrg();
    fs.mkdirSync(name);
    await sshReq(`team`, name, `--org`, org.name);
    process.chdir(before);
  } catch (e) {
    throw e;
  }
}

export async function createService(pth: Path, group: string, name: string) {
  try {
    let before = process.cwd();
    process.chdir(pth.toString());
    console.log("Creating service...");
    let { org } = fetchOrg();
    await sshReq(`service`, name, `--team`, group, `--org`, org.name);
    let repoBase = `${GIT_HOST}/${org.name}/${group}`;
    try {
      await execPromise(`git clone -q "${repoBase}/${name}" ${name}`);
    } catch (e) {
      if (
        ("" + e).startsWith(
          "warning: You appear to have cloned an empty repository."
        )
      ) {
      } else throw e;
    }
    await execPromise(`git symbolic-ref HEAD refs/heads/main`, name);
    addExitMessage(
      `Use '${GREEN}cd ${pth
        .with(name)
        .toString()
        .replace(
          /\\/g,
          "\\\\"
        )}${NORMAL_COLOR}' to go to the new service. \nThen use '${GREEN}${
        process.env["COMMAND"]
      } deploy${NORMAL_COLOR}' to deploy it.`
    );
    process.chdir(before);
  } catch (e) {
    throw e;
  }
}

async function do_pull(pth: Path, repo: string) {
  try {
    let before = process.cwd();
    process.chdir(pth.toString());
    await execPromise(`git pull -q "${repo}"`);
    process.chdir(before);
  } catch (e) {
    throw e;
  }
}

export function fetch_template(
  pth: Path,
  template: string,
  projectType: string
) {
  console.log("Fetching template...");
  return do_pull(
    pth,
    `https://github.com/merrymake/${projectType}-${template}-template`
  );
}
export function do_duplicate(
  pth: Path,
  org: string,
  group: string,
  service: string
) {
  console.log("Duplicating service...");
  return do_pull(pth, `${GIT_HOST}/${org}/${group}/${service}`);
}

export function addKnownHost() {
  let isKnownHost = false;
  if (fs.existsSync(`${os.homedir()}/.ssh/known_hosts`)) {
    let lines = (
      "" + fs.readFileSync(`${os.homedir()}/.ssh/known_hosts`)
    ).split("\n");
    isKnownHost = lines.some((x) =>
      x.includes(
        `${API_URL} ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOW2dgo+0nuahOzHD7XVnSdrCwhkK9wMnAZyr6XOKotO`
      )
    );
  }
  if (!isKnownHost) {
    console.log("Adding fingerprint...");
    fs.appendFileSync(
      `${os.homedir()}/.ssh/known_hosts`,
      `\n${API_URL} ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOW2dgo+0nuahOzHD7XVnSdrCwhkK9wMnAZyr6XOKotO\n`
    );
  }
}

export type KeyAction = () => Promise<{ key: string; keyFile: string }>;
export async function do_register(keyAction: KeyAction, email: string) {
  try {
    let { key, keyFile } = await keyAction();
    console.log("Registering...");
    addKnownHost();
    if (email === "") {
      addExitMessage(`Notice: Anonymous accounts are automatically deleted permanently after ~2 weeks, without warning. To add an email and avoid automatic deletion, run the command:
  ${YELLOW}${process.env["COMMAND"]} register ${keyFile}${NORMAL_COLOR}`);
    }
    let result = await urlReq(
      `${HTTP_HOST}/admin/user`,
      "POST",
      JSON.stringify({
        email,
        key,
      })
    );
    if (/^\d+$/.test(result.body)) {
      saveCache({ registered: true, hasOrgs: +result.body > 0 });
      output2("Registered user.");
    } else {
      if (result.code === 200) {
        saveCache({ registered: true, hasOrgs: false });
      }
      output2(result.body);
    }
  } catch (e) {
    throw e;
  }
}

function saveSSHConfig(path: string) {
  let lines: string[] = [];
  let changed = false;
  let foundHost = false;
  if (fs.existsSync(`${os.homedir()}/.ssh/config`)) {
    lines = fs
      .readFileSync(`${os.homedir()}/.ssh/config`)
      .toString()
      .split("\n");
    let inHost = false;
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      if ((line.startsWith("\t") || line.startsWith(" ")) && inHost) {
        if (line.includes("User ")) {
          lines[i] =
            line.substring(0, line.indexOf("User ")) + `User ${SSH_USER}`;
          changed = true;
        } else if (line.includes("IdentityFile ")) {
          lines[i] =
            line.substring(0, line.indexOf("IdentityFile ")) +
            `IdentityFile ~/.ssh/${path}`;
          changed = true;
        }
      } else if (line.startsWith("\t") || line.startsWith(" ")) {
      } else if (line.startsWith(`Host ${API_URL}`)) {
        inHost = true;
        foundHost = true;
      } else {
        inHost = false;
      }
    }
  }
  if (!foundHost) {
    lines.unshift(
      `Host ${API_URL}`,
      `\tUser ${SSH_USER}`,
      `\tHostName ${API_URL}`,
      `\tPreferredAuthentications publickey`,
      `\tIdentityFile ~/.ssh/${path}\n`
    );
    changed = true;
  }
  if (changed) {
    console.log(`Saving preference...`);
    fs.writeFileSync(`${os.homedir()}/.ssh/config`, lines.join("\n"));
  }
}

export async function useExistingKey(path: string) {
  try {
    saveSSHConfig(path);
    console.log(`Reading ${path}.pub...`);
    return {
      key: "" + fs.readFileSync(os.homedir() + `/.ssh/${path}.pub`),
      keyFile: path,
    };
  } catch (e) {
    throw e;
  }
}

export async function generateNewKey() {
  try {
    console.log(`Generating new ssh key...`);
    if (!fs.existsSync(os.homedir() + "/.ssh"))
      fs.mkdirSync(os.homedir() + "/.ssh");
    await execPromise(
      `ssh-keygen -t rsa -b 4096 -f "${os.homedir()}/.ssh/merrymake" -N ""`
    );
    saveSSHConfig("merrymake");
    return {
      key: "" + fs.readFileSync(os.homedir() + "/.ssh/merrymake.pub"),
      keyFile: "merrymake",
    };
  } catch (e) {
    throw e;
  }
}

async function deploy_internal(commit: string) {
  try {
    await execStreamPromise(
      `git add -A && ${commit} && git push origin HEAD 2>&1`,
      output2
    );
  } catch (e) {
    throw e;
  }
}

export async function do_deploy(pathToService: Path) {
  try {
    let before = process.cwd();
    process.chdir(pathToService.toString());
    await deploy_internal(
      "(git diff-index --quiet HEAD || git commit -m 'Deploy')"
    );
    process.chdir(before);
  } catch (e) {
    throw e;
  }
}
export function do_redeploy() {
  return deploy_internal("git commit --allow-empty -m 'Redeploy'");
}

function spawnPromise(str: string) {
  return new Promise<void>((resolve, reject) => {
    let [cmd, ...args] = str.split(" ");
    const options: ExecOptions = {
      cwd: ".",
      shell: "sh",
    };
    let ls = spawn(cmd, args, options);
    ls.stdout.on("data", (data: Buffer | string) => {
      output2(data.toString());
    });
    ls.stderr.on("data", (data: Buffer | string) => {
      output2(data.toString());
    });
    ls.on("close", (code) => {
      if (code === 0) resolve();
      else reject();
    });
  });
}

export async function do_build() {
  try {
    let projectType = detectProjectType(".");
    output2(`Building ${projectType} project...`);
    let buildCommands = BUILD_SCRIPT_MAKERS[projectType](".");
    for (let i = 0; i < buildCommands.length; i++) {
      let x = buildCommands[i];
      await spawnPromise(x);
    }
  } catch (e) {
    throw e;
  }
}

export async function do_inspect(org: string, id: string, river: string) {
  try {
    let res = JSON.parse(
      await sshReq(`inspect`, id, `--river`, river, `--org`, `${org}`)
    );
    let resout = res.output;
    delete res.output;
    console.log(res);
    output2("Output:");
    output2(resout);
  } catch (e) {
    throw e;
  }
}

export async function do_key(
  org: string,
  key: string | null,
  name: string,
  duration: string
) {
  try {
    let cmd = [`key`, duration, `--org`, org];
    if (name !== "") cmd.push(`--name`, name);
    if (key === null) {
      let { key, expiry }: { key: string; expiry: string } = JSON.parse(
        await sshReq(...cmd)
      );
      output2(`${key} expires on ${new Date(expiry).toLocaleString()}.`);
      addExitMessage(`Key: ${GREEN}${key}${NORMAL_COLOR}`);
    } else {
      cmd.push(`--update`, key);
      let { count, expiry }: { count: number; expiry: string } = JSON.parse(
        await sshReq(...cmd)
      );
      output2(
        `Updated ${count} keys to expire on ${new Date(
          expiry
        ).toLocaleString()}.`
      );
    }
  } catch (e) {
    throw e;
  }
}

export async function do_envvar(
  org: string,
  group: string,
  overwrite: string,
  key: string,
  value: string,
  access: string[],
  visibility: string
) {
  try {
    output2(
      await sshReq(
        `secret`,
        key,
        overwrite,
        ...access,
        `--org`,
        org,
        `--team`,
        group,
        `--value`,
        value,
        visibility
      )
    );
  } catch (e) {
    throw e;
  }
}

export async function do_event(
  org: string,
  key: string,
  event: string,
  create: boolean
) {
  try {
    output2(
      await sshReq(
        `event`,
        event,
        `--key`,
        key,
        ...(create ? [] : [`--delete`])
      )
    );
  } catch (e) {
    throw e;
  }
}

export async function do_cron(
  org: string,
  name: string,
  overwrite: string,
  event: string,
  expr: string
) {
  try {
    let call = await sshReq(
      `cron`,
      name,
      overwrite,
      event,
      `--expr`,
      expr,
      `--org`,
      org
    );
    if (expr === "") {
      output2(call);
    } else {
      let { s, n }: { s: string; n: Date } = JSON.parse(call);
      output2(
        `Cron '${s}' set to run next time at ${new Date(n).toLocaleString()}`
      );
    }
  } catch (e) {
    throw e;
  }
}

export function alignRight(str: string, width: number) {
  return str.length > width
    ? str.substring(0, width - 3) + "..."
    : str.padStart(width, " ");
}

export function alignLeft(str: string, width: number) {
  return str.length > width
    ? str.substring(0, width - 3) + "..."
    : str.padEnd(width, " ");
}

export function printTableHeader(
  prefix: string,
  widths: { [key: string]: number }
) {
  if (getArgs().length > 0) return;
  let totalWidth = stdout.getWindowSize()[0] - prefix.length;
  let vals = Object.values(widths);
  let rest =
    totalWidth -
    vals.reduce((acc, x) => acc + Math.max(x, 0)) -
    3 * (vals.length - 1);
  let header =
    prefix +
    Object.keys(widths)
      .map((k) =>
        k.trim().padEnd(widths[k] < 0 ? Math.max(rest, -widths[k]) : widths[k])
      )
      .join(" │ ");
  output2(header);
  let divider =
    prefix +
    Object.keys(widths)
      .map((k) =>
        "─".repeat(widths[k] < 0 ? Math.max(rest, -widths[k]) : widths[k])
      )
      .join("─┼─");
  output2(divider);
}

export async function do_queue_time(org: string, time: number) {
  try {
    let resp = await sshReq(`queue`, `--org`, org, `--time`, "" + time);
    let queue: {
      id: string;
      q: string;
      e: string;
      r: string;
      s: string;
    }[] = JSON.parse(resp);
    printTableHeader("", {
      Id: 6,
      River: 12,
      Event: 12,
      Status: 7,
      "Queue time": 20,
    });
    queue.forEach((x) =>
      output2(
        `${x.id} │ ${alignRight(x.r, 12)} │ ${alignLeft(x.e, 12)} │ ${alignLeft(
          x.s,
          7
        )} │ ${new Date(x.q).toLocaleString()}`
      )
    );
  } catch (e) {
    throw e;
  }
}

export async function do_help() {
  try {
    await urlReq("https://google.com");
  } catch (e) {
    output2(`${RED}No internet connection.${NORMAL_COLOR}`);
    return;
  }
  let whoami = JSON.parse(await sshReq("whoami"));
  if (whoami === undefined || whoami.length === 0) {
    let cache = getCache();
    if (!cache.registered) {
      output2(
        `${YELLOW}No key registered with ${process.env["COMMAND"]}.${NORMAL_COLOR}`
      );
    }
    output2(`${RED}No verified email.${NORMAL_COLOR}`);
  } else {
    output2(`${GREEN}Logged in as: ${whoami.join(", ")}.${NORMAL_COLOR}`);
  }
  let rawStruct = fetchOrgRaw();
  if (rawStruct.org === null) {
    output2(`${YELLOW}Not inside organization.${NORMAL_COLOR}`);
  } else {
    output2(
      `${GREEN}Inside organization: ${rawStruct.org.name}${NORMAL_COLOR}`
    );
  }
  if (rawStruct.serviceGroup === null) {
    output2(`${YELLOW}Not inside service group.${NORMAL_COLOR}`);
  } else {
    output2(
      `${GREEN}Inside service group: ${rawStruct.serviceGroup}${NORMAL_COLOR}`
    );
  }
  if (!fs.existsSync("mist.json") && !fs.existsSync("merrymake.json")) {
    output2(`${YELLOW}Not inside service repo.${NORMAL_COLOR}`);
  } else {
    output2(`${GREEN}Inside service repo.${NORMAL_COLOR}`);
  }
}

export async function do_post(
  eventType: string,
  key: string,
  contentType: string,
  payload: string
) {
  try {
    let resp = await urlReq(
      `${RAPIDS_HOST}/${key}/${eventType}`,
      "POST",
      payload,
      contentType
    );
    output2(resp.body);
  } catch (e) {
    throw e;
  }
}

export async function do_join(org: string) {
  try {
    output2(await sshReq(`org`, `--join`, org));
  } catch (e) {
    throw e;
  }
}

export async function do_attach_role(org: string, user: string, role: string) {
  try {
    output2(await sshReq(`role`, `--user`, user, `--org`, org, role));
  } catch (e) {
    throw e;
  }
}

export async function do_auto_approve(
  org: string,
  domain: string,
  role: string
) {
  try {
    output2(await sshReq(`preapprove`, `--add`, role, `--org`, org, domain));
  } catch (e) {
    throw e;
  }
}

export async function do_remove_auto_approve(org: string, domain: string) {
  try {
    output2(await sshReq(`preapprove`, `--org`, org, domain));
  } catch (e) {
    throw e;
  }
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export async function do_spending(org: string) {
  try {
    let rows: {
      mth: number;
      grp: string;
      srv: string;
      hook: string;
      cnt: number;
      time_ms: number;
      cost_eur: string;
    }[] = JSON.parse(await sshReq(`spending`, `--org`, org));
    let mth = 0;
    let grp = "";
    let srv = "";
    rows.forEach((x) => {
      if (x.mth === null) return;
      if (mth !== x.mth) {
        if (mth !== 0) output2("");
        mth = x.mth;
        output2(`Month: ${MONTHS[x.mth - 1]}`);
        printTableHeader("", {
          Group: 11,
          Service: 11,
          Hook: 20,
          Count: 7,
          Time: 7,
          "Est. Cost": 9,
        });
      }
      let group = x.grp === null ? "= Total" : x.grp === grp ? "" : x.grp;
      grp = x.grp;
      let service =
        x.grp === null
          ? ""
          : x.srv === null
          ? "= Total"
          : x.srv === srv
          ? ""
          : x.srv;
      srv = x.srv;
      let count = x.cnt;
      let count_unit = " ";
      if (count > 1000) {
        count /= 1000;
        count_unit = "k";
      }
      if (count > 1000) {
        count /= 1000;
        count_unit = "M";
      }
      if (count > 1000) {
        count /= 1000;
        count_unit = "B";
      }
      let time = x.time_ms;
      let time_unit = "ms";
      if (time > 1000) {
        time /= 1000;
        time_unit = "s";
      }
      if (time > 60) {
        time /= 60;
        time_unit = "m";
      }
      if (time > 60) {
        time /= 60;
        time_unit = "h";
      }
      if (time > 24) {
        time /= 24;
        time_unit = "d";
      }
      if (time > 30) {
        time /= 30;
        time_unit = "M";
      }
      let hook = x.srv === null ? "" : x.hook === null ? "= Total" : x.hook;
      output2(
        `${alignLeft(group, 11)} │ ${alignLeft(service, 11)} │ ${alignLeft(
          hook,
          20
        )} │ ${alignRight(
          "" + count.toFixed(1) + " " + count_unit,
          7
        )} │ ${alignRight(
          "" + time.toFixed(1) + " " + time_unit,
          7
        )} │ € ${alignRight(x.cost_eur, 7)}`
      );
    });
  } catch (e) {
    throw e;
  }
}
