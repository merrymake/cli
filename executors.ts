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
  sshReq,
  urlReq,
} from "./utils";
import { GIT_HOST, HTTP_HOST } from "./config";
import path from "path";
import {
  detectProjectType,
  BUILD_SCRIPT_MAKERS,
} from "@mist-cloud-eu/project-type-detect";
import { ExecOptions, spawn } from "child_process";

async function clone(struct: any, name: string) {
  try {
    output2(`Cloning ${name}...`);
    fs.mkdirSync(`${name}/.merrymake`, { recursive: true });
    let orgFile: OrgFile = { name };
    fs.writeFileSync(`${name}/.merrymake/conf.json`, JSON.stringify(orgFile));
    await execPromise(
      `git clone -q "${GIT_HOST}/${name}/event-catalogue" event-catalogue`,
      name
    );
    fetch(".", name, struct);
  } catch (e) {
    throw e;
  }
}

async function fetch(prefix: string, org: string, struct: any) {
  try {
    Object.keys(struct).forEach((team) => {
      fs.mkdirSync(`${prefix}/${org}/${team}`, { recursive: true });
      createFolderStructure(
        struct[team],
        `${prefix}/${org}/${team}`,
        org,
        team
      );
    });
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

function createFolderStructure(
  struct: any,
  prefix: string,
  org: string,
  team: string
) {
  Object.keys(struct).forEach(async (k) => {
    if (struct[k] instanceof Object)
      createFolderStructure(struct[k], prefix + "/" + k, org, team);
    else {
      // output(`git clone "${HOST}/${org}/${team}/${k}" "${prefix}/${k}"`);
      let repo = `"${GIT_HOST}/${org}/${team}/${k}"`;
      let dir = `${prefix}/${k}`;
      try {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
          await execPromise(`git init --initial-branch=main`, dir);
          await execPromise(`git remote add origin ${repo}`, dir);
          await fs.writeFile(
            dir + "/fetch.bat",
            `@echo off
git fetch
git reset --hard origin/main
del fetch.sh
(goto) 2>nul & del fetch.bat`,
            () => {}
          );
          await fs.writeFile(
            dir + "/fetch.sh",
            `#!/bin/sh
git fetch
git reset --hard origin/main
rm fetch.bat fetch.sh`,
            () => {}
          );
        }
      } catch (e) {
        console.log(e);
      }
    }
  });
}

export async function do_clone(name: string) {
  let reply = await sshReq(`clone`, name);
  if (!reply.startsWith("{")) {
    output2(reply);
    return;
  }
  let structure = JSON.parse(reply);
  await clone(structure, name);
}

export async function createOrganization(name: string) {
  let reply = await sshReq(`org`, name);
  if (!reply.startsWith("{")) {
    output2(reply);
    return;
  }
  let structure = JSON.parse(reply);
  await clone(structure, name);
}

export async function createServiceGroup(pth: Path, name: string) {
  let before = process.cwd();
  process.chdir(pth.toString());
  console.log("Creating service group...");
  let { org } = fetchOrg();
  fs.mkdirSync(name);
  await sshReq(`team`, name, `--org`, org.name);
  process.chdir(before);
}

export async function createService(pth: Path, group: string, name: string) {
  let before = process.cwd();
  process.chdir(pth.toString());
  console.log("Creating service...");
  let { org } = fetchOrg();
  await sshReq(`service`, name, `--team`, group, `--org`, org.name);
  let repoBase = `${GIT_HOST}/${org.name}/${group}`;
  await execPromise(`git clone -q "${repoBase}/${name}" ${name}`);
  console.log(
    `Use 'cd ${pth.with(name).toString().replace(/\\/g, "\\\\")}' to go there`
  );
  process.chdir(before);
}

export async function fetch_template(
  path: Path,
  template: string,
  language: string
) {
  // TODO
  console.log("Fetching template...");
  // await execPromise(`git pull -q "${repoBase}/${this.name}" ${name}`);
}

export async function do_register(
  keyAction: () => Promise<string>,
  email: string
) {
  let key = await keyAction();
  console.log("Registering...");
  fs.appendFileSync(
    `${os.homedir()}/.ssh/known_hosts`,
    "\napi.mist-cloud.io ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOW2dgo+0nuahOzHD7XVnSdrCwhkK9wMnAZyr6XOKotO\n"
  );
  let result = await urlReq(`${HTTP_HOST}/admin/user`, "POST", {
    email,
    key,
  });
  if (/^\d+$/.test(result.body)) {
    saveCache({ registered: true, hasOrgs: +result.body > 0 });
    output2("Registered user.");
  } else {
    if (result.code === 200) {
      saveCache({ registered: true, hasOrgs: false });
    }
    output2(result.body);
  }
}

export async function useExistingKey(path: string) {
  console.log(`Reading ${path}.pub`);
  return "" + fs.readFileSync(os.homedir() + `/.ssh/${path}.pub`);
}

export async function generateNewKey() {
  console.log(`Generating new ssh key`);
  if (!fs.existsSync(os.homedir() + "/.ssh"))
    fs.mkdirSync(os.homedir() + "/.ssh");
  await execPromise(
    `ssh-keygen -t rsa -b 4096 -f "${os.homedir()}/.ssh/merrymake" -N ""`
  );
  fs.appendFileSync(
    `${os.homedir()}/.ssh/config`,
    `\nHost api.mist-cloud.io
    User mist
    HostName api.mist-cloud.io
    PreferredAuthentications publickey
    IdentityFile ~/.ssh/merrymake\n`
  );
  return "" + fs.readFileSync(os.homedir() + "/.ssh/merrymake.pub");
}

async function deploy_internal(commit: string) {
  await execStreamPromise(
    `git add -A && ${commit} && git push origin HEAD 2>&1`,
    output2
  );
}

export async function do_deploy() {
  deploy_internal("(git diff-index --quiet HEAD || git commit -m 'Deploy')");
}
export async function do_redeploy() {
  deploy_internal("git commit --allow-empty -m 'Redeploy'");
}

export async function do_build() {
  let projectType = detectProjectType(".");
  BUILD_SCRIPT_MAKERS[projectType](".").forEach((x) => {
    let [cmd, ...args] = x.split(" ");
    const options: ExecOptions = {
      shell: "sh",
    };
    if (process.env["DEBUG"]) console.log(cmd, args);
    output2(`Building ${projectType} project...`);
    let ls = spawn(cmd, args, options);
    ls.stdout.on("data", (data: Buffer | string) => {
      output2(data.toString());
    });
    ls.stderr.on("data", (data: Buffer | string) => {
      output2(data.toString());
    });
  });
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

export async function do_cron(
  org: string,
  name: string,
  overwrite: string,
  event: string,
  expr: string
) {
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
}
