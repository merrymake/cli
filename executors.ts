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
import { MerrymakeCrypto } from "@merrymake/secret-lib";
import { optimisticMimeTypeOf } from "@merrymake/ext2mime";

export const SPECIAL_FOLDERS = ["event-catalogue", "public"];

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
    fetch(`./${name}/`, struct, (path, team, service) =>
      createServiceFolder(path, name, team, service)
    );
  } catch (e) {
    throw e;
  }
}

async function fetch(
  prefix: string,
  struct: any,
  func: (path: string, team: string, service: string) => void
) {
  try {
    let keys = Object.keys(struct);
    for (let i = 0; i < keys.length; i++) {
      let group = keys[i];
      fs.mkdirSync(`${prefix}${group}`, { recursive: true });
      await createFolderStructure(
        struct[group],
        `${prefix}${group}`,
        group,
        func
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
    await fetch(org.pathToRoot, structure, (path, team, service) =>
      createServiceFolder(path, org.org.name, team, service)
    );
  } catch (e) {
    throw e;
  }
}

async function createServiceFolder(
  path: string,
  org: string,
  team: string,
  service: string
) {
  let repo = `"${GIT_HOST}/${org}/${team}/${service}"`;
  let dir = `${path}/${service}`;
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(dir + "/.git")) {
      await execPromise(`git init --initial-branch=main`, dir);
      await execPromise(`git remote add origin ${repo}`, dir);
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
rm fetch.bat fetch.sh`,
        {}
      );
      fs.chmodSync(dir + "/fetch.sh", "755");
    } else {
      await execPromise(`git remote set-url origin ${repo}`, dir);
    }
  } catch (e) {
    console.log(e);
  }
}

async function createFolderStructure(
  struct: any,
  prefix: string,
  team: string,
  func: (path: string, team: string, service: string) => void
) {
  try {
    let keys = Object.keys(struct);
    for (let i = 0; i < keys.length; i++) {
      let k = keys[i];
      if (struct[k] instanceof Object)
        await createFolderStructure(struct[k], prefix + "/" + k, team, func);
      else {
        func(prefix, team, k);
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
      throw reply;
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
    let { org, pathToRoot } = fetchOrg();
    await sshReq(`service`, name, `--team`, group, `--org`, org.name);
    if (fs.existsSync(pathToRoot + BITBUCKET_FILE)) {
      fs.mkdirSync(name, { recursive: true });
      fs.appendFileSync(
        pathToRoot + BITBUCKET_FILE,
        "\n" + bitbucketStep(group + "/" + name)
      );
      addExitMessage(
        `Use '${GREEN}cd ${pth
          .with(name)
          .toString()
          .replace(
            /\\/g,
            "\\\\"
          )}${NORMAL_COLOR}' to go to the new service. \nAutomatic deployment added to BitBucket pipeline.`
      );
    } else {
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
    }
    process.chdir(before);
  } catch (e) {
    throw e;
  }
}

async function do_pull(pth: Path, repo: string) {
  try {
    let before = process.cwd();
    process.chdir(pth.toString());
    if (fs.existsSync(".git")) await execPromise(`git pull -q "${repo}"`);
    else {
      await execPromise(`git clone -q "${repo}" .`);
      fs.rmSync(".git", { recursive: true, force: true });
    }
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
    if (!fs.existsSync(os.homedir() + "/.ssh"))
      fs.mkdirSync(os.homedir() + "/.ssh");
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

export async function do_replay(org: string, id: string, river: string) {
  try {
    await sshReq(`replay`, id, `--river`, river, `--org`, org);
    output2("Replayed event.");
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
  secret: boolean
) {
  try {
    let struct = fetchOrgRaw();
    let val: string;
    if (secret === true) {
      let repoBase = `${GIT_HOST}/${org}/${group}/.key`;
      await execPromise(
        `git clone -q "${repoBase}"`,
        path.join(struct.pathToRoot!, ".merrymake")
      );
      let key = fs.readFileSync(
        path.join(struct.pathToRoot!, ".merrymake", ".key", "merrymake.key")
      );
      val = new MerrymakeCrypto()
        .encrypt(Buffer.from(value), key)
        .toString("base64");
    } else {
      val = value;
    }
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
        val,
        secret ? "--encrypted" : "--public"
      )
    );
    if (secret === true) {
      fs.rmSync(path.join(struct.pathToRoot!, ".merrymake", ".key"), {
        force: true,
        recursive: true,
      });
    }
  } catch (e) {
    throw e;
  }
}

export async function do_cron(
  org: string,
  name: string,
  overwrite: string,
  event: string,
  expr: string,
  timezone: string
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
      org,
      `--timezone`,
      timezone
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
  if (getArgs().length > 0) return "";
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
  let result = header + "\n";
  let divider =
    prefix +
    Object.keys(widths)
      .map((k) =>
        "─".repeat(widths[k] < 0 ? Math.max(rest, -widths[k]) : widths[k])
      )
      .join("─┼─");
  result += divider;
  return result;
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
    output2(
      printTableHeader("", {
        Id: 6,
        River: 12,
        Event: 12,
        Status: 7,
        "Queue time": 20,
      })
    );
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

export async function do_post_file(
  eventType: string,
  key: string,
  filename: string
) {
  try {
    let content = fs.readFileSync(filename).toString();
    let type = optimisticMimeTypeOf(
      filename.substring(filename.lastIndexOf(".") + 1)
    );
    if (type === null) throw "Could not determine content type";
    let resp = await urlReq(
      `${RAPIDS_HOST}/${key}/${eventType}`,
      "POST",
      content,
      type.toString()
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
      mth: string;
      grp: string;
      srv: string;
      hook: string;
      cnt: string;
      time_ms: number;
      cost_eur: string;
    }[] = JSON.parse(await sshReq(`spending`, `--org`, org));
    let mth = 0;
    let grp = "";
    let srv = "";
    rows.forEach((x) => {
      if (x.mth === null) return;
      let nmth = +x.mth;
      if (mth !== nmth) {
        if (mth !== 0) output2("");
        mth = nmth;
        output2(`Month: ${MONTHS[mth - 1]}`);
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
      let count = +x.cnt;
      let count_unit = " ";
      let count_str = "" + count + "  ";
      if (count > 1000) {
        count /= 1000;
        count_unit = "k";
        if (count > 1000) {
          count /= 1000;
          count_unit = "M";
          if (count > 1000) {
            count /= 1000;
            count_unit = "B";
          }
        }
        count_str = count.toFixed(1);
      }
      let time = x.time_ms;
      let time_unit = "ms";
      let time_str = "" + time + " ";
      if (time > 1000) {
        time /= 1000;
        time_unit = "s";
        if (time > 60) {
          time /= 60;
          time_unit = "m";
          if (time > 60) {
            time /= 60;
            time_unit = "h";
            if (time > 24) {
              time /= 24;
              time_unit = "d";
              if (time > 30) {
                time /= 30;
                time_unit = "M";
              }
            }
          }
        }
        time_str = time.toFixed(1);
      }
      let hook = x.srv === null ? "" : x.hook === null ? "= Total" : x.hook;
      output2(
        `${alignLeft(group, 11)} │ ${alignLeft(service, 11)} │ ${alignLeft(
          hook,
          20
        )} │ ${alignRight("" + count_str + " " + count_unit, 7)} │ ${alignRight(
          "" + time_str + " " + time_unit,
          7
        )} │ € ${alignRight(x.cost_eur, 7)}`
      );
    });
  } catch (e) {
    throw e;
  }
}

export async function do_event(
  key: string,
  events: { [event: string]: boolean }
) {
  try {
    let selected = Object.keys(events).filter((x) => events[x]);
    output2(await sshReq(`event`, `--key`, key, selected.join(",")));
  } catch (e) {
    throw e;
  }
}

export async function do_delete_service(
  org: string,
  group: string,
  service: string
) {
  try {
    output2(
      await sshReq(
        `service`,
        `--delete`,
        `--org`,
        org,
        `--team`,
        group,
        service
      )
    );
    if (fs.existsSync(service)) fs.renameSync(service, `(deleted) ${service}`);
  } catch (e) {
    throw e;
  }
}

export async function do_delete_group(org: string, group: string) {
  try {
    output2(await sshReq(`team`, `--delete`, `--org`, org, group));
    if (fs.existsSync(group)) fs.renameSync(group, `(deleted) ${group}`);
  } catch (e) {
    throw e;
  }
}

export async function do_delete_org(org: string) {
  try {
    output2(await sshReq(`org`, `--delete`, org));
    if (fs.existsSync(org)) fs.renameSync(org, `(deleted) ${org}`);
  } catch (e) {
    throw e;
  }
}

export async function do_create_deployment_agent(
  org: string,
  name: string,
  file: string
) {
  try {
    output2("Creating service user...");
    let cmd = [`service-user`, org];
    if (name !== "") cmd.push(`--name`, name);
    let key = await sshReq(...cmd);
    fs.writeFileSync(file, key);
  } catch (e) {
    throw e;
  }
}

export const BITBUCKET_FILE = "bitbucket-pipelines.yml";
function bitbucketStep(pth: string) {
  return `          - step:
              name: ${pth}
              script:
                - ./.merrymake/deploy.sh ${pth}`;
}

export async function do_bitbucket(org: string, host: string, key: string) {
  try {
    let struct = fetchOrg();
    fs.writeFileSync(
      struct.pathToRoot + path.join(".merrymake", "deploy.sh"),
      `set -o errexit
chmod 600 ${key}
eval \`ssh-agent\`
ssh-add ${key}
echo "api.merrymake.io ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOW2dgo+0nuahOzHD7XVnSdrCwhkK9wMnAZyr6XOKotO" >> ~/.ssh/known_hosts
cd $1
git init
git remote add merrymake ssh://mist@api.merrymake.io/${org}/$1
git fetch merrymake
git reset merrymake/main || echo "No previous deployment"
git config --global user.email "support@merrymake.eu"
git config --global user.name "Merrymake"
git add -A && (git diff-index --quiet HEAD || git commit -m 'Deploy from BitBucket')
export RES=$(git push merrymake HEAD:main --force 2>&1); echo "\${RES}"
case $RES in "Everything up-to-date"*) exit 0 ;; *"if/when the smoke test succeeds"*) exit 0 ;; *"Processed events"*) exit 0 ;; *) echo "Deployment failed"; exit -1 ;; esac`
    );
    let reply = await sshReq(`clone`, struct.org.name);
    if (!reply.startsWith("{")) {
      output2(reply);
      return;
    }
    let structure = JSON.parse(reply);
    let pipelineFile = [
      `pipelines:
  branches:
    master:
      - parallel:
# SERVICES ARE AUTOMATICALLY ADDED BELOW`,
    ];
    let folders: string[] = [...SPECIAL_FOLDERS];
    fetch("", structure, (path, team, service) =>
      folders.push(path + "/" + service)
    );
    for (let i = 0; i < folders.length; i++) {
      let folder = folders[i];
      output2(`Processing ${folder}`);
      let toService = struct.pathToRoot + folder;
      try {
        await execPromise(`git fetch`, toService);
        await execPromise(`git reset origin/main`, toService);
      } catch (e) {}
      fs.rmSync(`${toService}/.git`, { recursive: true, force: true });
      pipelineFile.push(bitbucketStep(folder));
    }
    fs.writeFileSync(
      struct.pathToRoot + BITBUCKET_FILE,
      pipelineFile.join("\n")
    );
    await execPromise(`git init`, struct.pathToRoot);
    await execPromise(
      `git update-index --add --chmod=+x .merrymake/deploy.sh`,
      struct.pathToRoot
    );
    await execPromise(`git remote add origin ${host}`, struct.pathToRoot);
  } catch (e) {
    throw e;
  }
}
