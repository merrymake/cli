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
} from "./utils";
import { GIT_HOST, HTTP_HOST } from "./config";
import {
  detectProjectType,
  BUILD_SCRIPT_MAKERS,
} from "@merrymake/detect-project-type";
import { ExecOptions, spawn } from "child_process";
import { COLOR3, NORMAL_COLOR } from "./prompt";
import path from "path";

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
    addExitMessage(
      `Use '${COLOR3}cd ${pth
        .with(name)
        .toString()
        .replace(
          /\\/g,
          "\\\\"
        )}${NORMAL_COLOR}' to go to the new service. \nThen use '${COLOR3}${
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

export async function do_register(
  keyAction: () => Promise<string>,
  email: string
) {
  try {
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
  } catch (e) {
    throw e;
  }
}

export async function useExistingKey(path: string) {
  try {
    console.log(`Reading ${path}.pub`);
    return "" + fs.readFileSync(os.homedir() + `/.ssh/${path}.pub`);
  } catch (e) {
    throw e;
  }
}

export async function generateNewKey() {
  try {
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
      addExitMessage(`Key: ${COLOR3}${key}${NORMAL_COLOR}`);
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
