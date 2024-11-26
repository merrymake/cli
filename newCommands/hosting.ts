import fs from "fs";
import {
  API_URL,
  FINGERPRINT,
  GIT_HOST,
  MERRYMAKE_IO,
  SPECIAL_FOLDERS,
} from "../config";
import { Option, choice, shortText } from "../prompt";
import {
  Organization,
  Path,
  PathTo,
  Repository,
  RepositoryId,
  ServiceGroup,
  ServiceGroupId,
} from "../types";
import {
  addToExecuteQueue,
  execPromise,
  finish,
  getFiles,
  output2,
  sshReq,
  toFolderName,
} from "../utils";
import { ToBeStructure, do_fetch, ensureGroupStructure } from "./fetch";

export async function do_create_deployment_agent(
  organization: Organization,
  name: string,
  file: string
) {
  try {
    output2("Creating service user...");
    const cmd = [`user-create-service`, organization.id.toString()];
    if (name !== "") cmd.push(`--name`, name);
    const key = await sshReq(...cmd);
    fs.writeFileSync(file, key);
  } catch (e) {
    throw e;
  }
}

export const BITBUCKET_FILE = "bitbucket-pipelines.yml";
export function bitbucketStep(group_service: PathTo, repo: string) {
  return `          - step:
              name: ${group_service.toString().replace(/\\/g, "/")}
              script:
                - ./.merrymake/deploy.sh ${group_service
                  .toString()
                  .replace(/\\/g, "/")} ${repo}`;
}

export async function do_bitbucket(
  organization: Organization,
  host: string,
  key: string
) {
  try {
    const structure = await do_fetch(organization);
    fs.writeFileSync(
      organization.pathTo.with(".merrymake").with("deploy.sh").toString(),
      `set -o errexit
chmod 600 ${key}
eval \`ssh-agent\`
ssh-add ${key}
echo "${API_URL} ssh-ed25519 ${FINGERPRINT}" >> ~/.ssh/known_hosts
cd $1
git init
git remote add merrymake "${GIT_HOST}/o${organization.id.toString()}/$2"
git fetch merrymake
git reset merrymake/main || echo "No previous deployment"
git config --global user.email "support@merrymake.eu"
git config --global user.name "Merrymake"
git add -A && (git diff-index --quiet HEAD || git commit -m 'Deploy from BitBucket')
export RES=$(git push merrymake HEAD:main --force 2>&1); echo "\${RES}"
case $RES in "Everything up-to-date"*) exit 0 ;; *"if/when the smoke test succeeds"*) exit 0 ;; *"Processed events"*) exit 0 ;; *) echo "Deployment failed"; exit -1 ;; esac`
    );
    const pipelineFile = [
      `pipelines:
  branches:
    master:
      - parallel:
# SERVICES ARE AUTOMATICALLY ADDED BELOW`,
    ];
    const folders: { localPath: PathTo; remotePath: string }[] =
      SPECIAL_FOLDERS.map((x) => ({ localPath: new Path(x), remotePath: x }));
    Object.keys(structure).forEach((serviceGroupId) => {
      const group = structure[serviceGroupId];
      const folderName = toFolderName(group.displayName);
      const serviceGroup: ServiceGroup = {
        pathTo: organization.pathTo.with(folderName),
        id: new ServiceGroupId(serviceGroupId),
      };
      Object.keys(group.repositories).forEach((repositoryId) => {
        const repositoryDisplayName = group.repositories[repositoryId];
        const folderName = toFolderName(repositoryDisplayName);
        const repository: Repository = {
          pathTo: serviceGroup.pathTo.with(folderName),
          id: new RepositoryId(repositoryId),
        };
        const localPath = repository.pathTo;
        const remotePath = `g${serviceGroup.id.toString()}/r${repository.id.toString()}`;
        folders.push({ localPath, remotePath });
      });
    });
    for (let i = 0; i < folders.length; i++) {
      const { localPath, remotePath } = folders[i];
      output2(`Processing ${localPath}`);
      try {
        await execPromise(`git fetch`, localPath.toString());
        await execPromise(`git reset origin/main`, localPath.toString());
      } catch (e) {}
      fs.rmSync(localPath.with(".git").toString(), {
        recursive: true,
        force: true,
      });
      pipelineFile.push(bitbucketStep(localPath, remotePath));
    }
    fs.writeFileSync(
      organization.pathTo.with(BITBUCKET_FILE).toString(),
      pipelineFile.join("\n")
    );
    await execPromise(`git init`, organization.pathTo.toString());
    await execPromise(
      `git update-index --add --chmod=+x .merrymake/deploy.sh`,
      organization.pathTo.toString()
    );
    await execPromise(
      `git remote add origin ${host}`,
      organization.pathTo.toString()
    );
  } catch (e) {
    throw e;
  }
}

function hosting_bitbucket_key_host(
  organization: Organization,
  host: string,
  key: string
) {
  addToExecuteQueue(() => do_bitbucket(organization, host, key));
  return finish();
}

async function hosting_bitbucket_key(organization: Organization, file: string) {
  try {
    const host = await shortText(
      "Bitbucket repo",
      "The URL to the bitbucket mono-repository.",
      `https://...`
    ).then();
    return hosting_bitbucket_key_host(organization, host, file);
  } catch (e) {
    throw e;
  }
}

async function hosting_bitbucket_create(organization: Organization) {
  try {
    const name = await shortText(
      "Name",
      "Display name for the service user",
      `Service User`
    ).then();
    const file = ".merrymake/" + toFolderName(name) + ".key";
    addToExecuteQueue(() =>
      do_create_deployment_agent(organization, name, file)
    );
    return hosting_bitbucket_key(organization, file);
  } catch (e) {
    throw e;
  }
}

async function hosting_bitbucket(organization: Organization) {
  try {
    const keyfiles = getFiles(organization.pathTo.with(`.merrymake`)).filter(
      (x) => x.endsWith(".key")
    );
    const options = keyfiles.map<Option>((x) => {
      const f = x.substring(0, x.length - ".key".length);
      return {
        long: f,
        text: `use service user ${f}`,
        action: () =>
          hosting_bitbucket_key(organization, `.merrymake/${f}.key`),
      };
    });
    options.push({
      long: `create`,
      short: `c`,
      text: `create service user`,
      action: () => hosting_bitbucket_create(organization),
    });
    return await choice("Which service user would you like to use?", options, {
      invertedQuiet: { cmd: false, select: true },
    }).then();
  } catch (e) {
    throw e;
  }
}

export function hosting(organization: Organization) {
  return choice("Which host would you like to use?", [
    {
      long: "bitbucket",
      short: "b",
      text: "bitbucket",
      action: () => hosting_bitbucket(organization),
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
