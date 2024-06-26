import fs from "fs";
import {
  Path,
  addToExecuteQueue,
  execPromise,
  fetchOrg,
  finish,
  getFiles,
  output2,
  sshReq,
} from "../utils";
import path from "path";
import { fetch_internal } from "../newCommands/fetch";
import { SPECIAL_FOLDERS } from "../executors";
import { Option, choice, shortText } from "../prompt";

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
export function bitbucketStep(pth: string) {
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
    fetch_internal("", structure, (path, team, service) =>
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

function hosting_bitbucket_key_host(org: string, host: string, key: string) {
  addToExecuteQueue(() => do_bitbucket(org, host, key));
  return finish();
}

async function hosting_bitbucket_key(org: string, file: string) {
  try {
    let host = await shortText(
      "Bitbucket repo",
      "The URL to the bitbucket mono-repository.",
      `https://...`
    ).then();
    return hosting_bitbucket_key_host(org, host, file);
  } catch (e) {
    throw e;
  }
}

async function hosting_bitbucket_create(pathToRoot: string, org: string) {
  try {
    let name = await shortText(
      "Name",
      "Display name for the service user",
      `Service User`
    ).then();
    let file = ".merrymake/" + name.toLowerCase().replace(" ", "-") + ".key";
    addToExecuteQueue(() => do_create_deployment_agent(org, name, file));
    return hosting_bitbucket_key(org, file);
  } catch (e) {
    throw e;
  }
}

async function hosting_bitbucket(pathToRoot: string, org: string) {
  try {
    let keyfiles = getFiles(new Path(`${pathToRoot}/.merrymake`)).filter((x) =>
      x.endsWith(".key")
    );
    let options = keyfiles.map<Option>((x) => {
      let f = x.substring(0, x.length - ".key".length);
      return {
        long: f,
        text: `use service user ${f}`,
        action: () => hosting_bitbucket_key(org, `.merrymake/${f}.key`),
      };
    });
    options.push({
      long: `create`,
      short: `c`,
      text: `create service user`,
      action: () => hosting_bitbucket_create(pathToRoot, org),
    });
    return await choice("Which service user would you like to use?", options, {
      invertedQuiet: { cmd: false, select: true },
    }).then();
  } catch (e) {
    throw e;
  }
}

export function hosting(pathToRoot: string, org: string) {
  return choice("Which host would you like to use?", [
    {
      long: "bitbucket",
      short: "b",
      text: "bitbucket",
      action: () => hosting_bitbucket(pathToRoot, org),
    },
    // {
    //   long: "github",
    //   short: "h",
    //   text: "github",
    //   action: () => hosting_github(),
    // },
    // {
    //   long: "gitlab",
    //   short: "h",
    //   text: "gitlab",
    //   action: () => hosting_gitlab(),
    // },
    // {
    //   long: "azure devops",
    //   short: "h",
    //   text: "azure devops",
    //   action: () => hosting_azure_devops(),
    // },
  ]);
}
