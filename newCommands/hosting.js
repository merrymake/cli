import { Str } from "@merrymake/utils";
import { rm, writeFile } from "fs/promises";
import { API_URL, FINGERPRINT, GIT_HOST, SPECIAL_FOLDERS } from "../config.js";
import { addToExecuteQueue, finish } from "../exitMessages.js";
import { outputGit } from "../printUtils.js";
import { choice, output, shortText } from "../prompt.js";
import { Path, RepositoryId, ServiceGroupId, } from "../types.js";
import { execPromise, getFiles, sshReq } from "../utils.js";
import { do_fetch } from "./fetch.js";
import { isDryrun } from "../dryrun.js";
export async function do_create_deployment_agent(organization, name, file) {
    if (isDryrun()) {
        output("DRYRUN: Would create service user");
        return;
    }
    try {
        outputGit("Creating service user...");
        const cmd = [`user-create-service`, organization.id.toString()];
        if (name !== "")
            cmd.push(`--name`, name);
        const key = await sshReq(...cmd);
        await writeFile(file, key);
    }
    catch (e) {
        throw e;
    }
}
export const BITBUCKET_FILE = "bitbucket-pipelines.yml";
export function bitbucketStep(group_service, repo) {
    return `          - step:
              name: ${group_service.toString().replace(/\\/g, "/")}
              script:
                - ./.merrymake/deploy.sh ${group_service
        .toString()
        .replace(/\\/g, "/")} ${repo}`;
}
export async function do_bitbucket(organization, host, key, releaseBranch) {
    try {
        const structure = await do_fetch(organization);
        await writeFile(organization.pathTo.with(".merrymake").with("deploy.sh").toString(), `set -o errexit
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
case $RES in "Everything up-to-date"*) exit 0 ;; *"Releasing service"*) exit 0 ;; *"Processed events"*) exit 0 ;; *) echo "Deployment failed"; exit -1 ;; esac`);
        const pipelineFile = [
            `pipelines:
  branches:
    ${releaseBranch}:
      - parallel:
# SERVICES ARE AUTOMATICALLY ADDED BELOW`,
        ];
        const folders = SPECIAL_FOLDERS.map((x) => ({ localPath: new Path(x), remotePath: x }));
        Object.keys(structure).forEach((serviceGroupId) => {
            const group = structure[serviceGroupId];
            const folderName = Str.toFolderName(group.displayName);
            const serviceGroup = {
                pathTo: organization.pathTo.with(folderName),
                id: new ServiceGroupId(serviceGroupId),
            };
            Object.keys(group.repositories).forEach((repositoryId) => {
                const repositoryDisplayName = group.repositories[repositoryId];
                const folderName = Str.toFolderName(repositoryDisplayName);
                const repository = {
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
            outputGit(`Processing ${localPath}`);
            try {
                await execPromise(`git fetch`, localPath.toString());
                await execPromise(`git reset origin/main`, localPath.toString());
            }
            catch (e) { }
            await rm(localPath.with(".git").toString(), {
                recursive: true,
                force: true,
            });
            pipelineFile.push(bitbucketStep(localPath, remotePath));
        }
        await writeFile(organization.pathTo.with(BITBUCKET_FILE).toString(), pipelineFile.join("\n"));
        await execPromise(`git init`, organization.pathTo.toString());
        // For mac
        await execPromise(`chmod +x .merrymake/deploy.sh`, organization.pathTo.toString());
        // For windows
        await execPromise(`git update-index --add --chmod=+x .merrymake/deploy.sh`, organization.pathTo.toString());
        await execPromise(`git remote add origin ${host}`, organization.pathTo.toString());
    }
    catch (e) {
        throw e;
    }
}
async function hosting_bitbucket_key_host(organization, host, key) {
    try {
        const branch = await shortText("Release branch", "Pushes or pull requests to this branch will trigger a deploy. Normally: main, master, trunk, or release", `master`).then();
        addToExecuteQueue(() => do_bitbucket(organization, host, key, branch));
        return finish();
    }
    catch (e) {
        throw e;
    }
}
async function hosting_bitbucket_key(organization, file) {
    try {
        const host = await shortText("Bitbucket repo", "The URL to the bitbucket mono-repository.", `https://...`).then();
        return hosting_bitbucket_key_host(organization, host, file);
    }
    catch (e) {
        throw e;
    }
}
async function hosting_bitbucket_create(organization) {
    try {
        const name = await shortText("Name", "Display name for the service user", `Service User`).then();
        const file = ".merrymake/" + Str.toFolderName(name) + ".key";
        addToExecuteQueue(() => do_create_deployment_agent(organization, name, file));
        return hosting_bitbucket_key(organization, file);
    }
    catch (e) {
        throw e;
    }
}
async function hosting_bitbucket(organization) {
    try {
        return await choice([
            {
                long: `create`,
                short: `c`,
                text: `create service user`,
                action: () => hosting_bitbucket_create(organization),
            },
        ], async () => {
            const keyfiles = (await getFiles(organization.pathTo.with(`.merrymake`))).filter((x) => x.endsWith(".key"));
            const options = keyfiles.map((x) => {
                const f = x.substring(0, x.length - ".key".length);
                return {
                    long: f,
                    text: `use service user ${f}`,
                    action: () => hosting_bitbucket_key(organization, `.merrymake/${f}.key`),
                };
            });
            return { options, header: "Which service user would you like to use?" };
        }, {
            invertedQuiet: { cmd: false },
        }).then();
    }
    catch (e) {
        throw e;
    }
}
export function hosting(organization) {
    return choice([
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
    ], async () => {
        return { options: [], header: "Which host would you like to use?" };
    });
}
