"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BITBUCKET_FILE = void 0;
exports.do_create_deployment_agent = do_create_deployment_agent;
exports.bitbucketStep = bitbucketStep;
exports.do_bitbucket = do_bitbucket;
exports.hosting = hosting;
const fs_1 = __importDefault(require("fs"));
const config_1 = require("../config");
const prompt_1 = require("../prompt");
const types_1 = require("../types");
const utils_1 = require("../utils");
const fetch_1 = require("./fetch");
function do_create_deployment_agent(organization, name, file) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            (0, utils_1.output2)("Creating service user...");
            const cmd = [`user-create-service`, organization.id.toString()];
            if (name !== "")
                cmd.push(`--name`, name);
            const key = yield (0, utils_1.sshReq)(...cmd);
            fs_1.default.writeFileSync(file, key);
        }
        catch (e) {
            throw e;
        }
    });
}
exports.BITBUCKET_FILE = "bitbucket-pipelines.yml";
function bitbucketStep(group_service, repo) {
    return `          - step:
              name: ${group_service.toString().replace(/\\/g, "/")}
              script:
                - ./.merrymake/deploy.sh ${group_service
        .toString()
        .replace(/\\/g, "/")} ${repo}`;
}
function do_bitbucket(organization, host, key) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const structure = yield (0, fetch_1.do_fetch)(organization);
            fs_1.default.writeFileSync(organization.pathTo.with(".merrymake").with("deploy.sh").toString(), `set -o errexit
chmod 600 ${key}
eval \`ssh-agent\`
ssh-add ${key}
echo "${config_1.API_URL} ssh-ed25519 ${config_1.FINGERPRINT}" >> ~/.ssh/known_hosts
cd $1
git init
git remote add merrymake "${config_1.GIT_HOST}/o${organization.id.toString()}/$2"
git fetch merrymake
git reset merrymake/main || echo "No previous deployment"
git config --global user.email "support@merrymake.eu"
git config --global user.name "Merrymake"
git add -A && (git diff-index --quiet HEAD || git commit -m 'Deploy from BitBucket')
export RES=$(git push merrymake HEAD:main --force 2>&1); echo "\${RES}"
case $RES in "Everything up-to-date"*) exit 0 ;; *"if/when the smoke test succeeds"*) exit 0 ;; *"Processed events"*) exit 0 ;; *) echo "Deployment failed"; exit -1 ;; esac`);
            const pipelineFile = [
                `pipelines:
  branches:
    master:
      - parallel:
# SERVICES ARE AUTOMATICALLY ADDED BELOW`,
            ];
            const folders = config_1.SPECIAL_FOLDERS.map((x) => ({ localPath: new types_1.Path(x), remotePath: x }));
            Object.keys(structure).forEach((serviceGroupId) => {
                const group = structure[serviceGroupId];
                const folderName = (0, utils_1.toFolderName)(group.displayName);
                const serviceGroup = {
                    pathTo: organization.pathTo.with(folderName),
                    id: new types_1.ServiceGroupId(serviceGroupId),
                };
                Object.keys(group.repositories).forEach((repositoryId) => {
                    const repositoryDisplayName = group.repositories[repositoryId];
                    const folderName = (0, utils_1.toFolderName)(repositoryDisplayName);
                    const repository = {
                        pathTo: serviceGroup.pathTo.with(folderName),
                        id: new types_1.RepositoryId(repositoryId),
                    };
                    const localPath = repository.pathTo;
                    const remotePath = `g${serviceGroup.id.toString()}/r${repository.id.toString()}`;
                    folders.push({ localPath, remotePath });
                });
            });
            for (let i = 0; i < folders.length; i++) {
                const { localPath, remotePath } = folders[i];
                (0, utils_1.output2)(`Processing ${localPath}`);
                try {
                    yield (0, utils_1.execPromise)(`git fetch`, localPath.toString());
                    yield (0, utils_1.execPromise)(`git reset origin/main`, localPath.toString());
                }
                catch (e) { }
                fs_1.default.rmSync(localPath.with(".git").toString(), {
                    recursive: true,
                    force: true,
                });
                pipelineFile.push(bitbucketStep(localPath, remotePath));
            }
            fs_1.default.writeFileSync(organization.pathTo.with(exports.BITBUCKET_FILE).toString(), pipelineFile.join("\n"));
            yield (0, utils_1.execPromise)(`git init`, organization.pathTo.toString());
            yield (0, utils_1.execPromise)(`git update-index --add --chmod=+x .merrymake/deploy.sh`, organization.pathTo.toString());
            yield (0, utils_1.execPromise)(`git remote add origin ${host}`, organization.pathTo.toString());
        }
        catch (e) {
            throw e;
        }
    });
}
function hosting_bitbucket_key_host(organization, host, key) {
    (0, utils_1.addToExecuteQueue)(() => do_bitbucket(organization, host, key));
    return (0, utils_1.finish)();
}
function hosting_bitbucket_key(organization, file) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const host = yield (0, prompt_1.shortText)("Bitbucket repo", "The URL to the bitbucket mono-repository.", `https://...`).then();
            return hosting_bitbucket_key_host(organization, host, file);
        }
        catch (e) {
            throw e;
        }
    });
}
function hosting_bitbucket_create(organization) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const name = yield (0, prompt_1.shortText)("Name", "Display name for the service user", `Service User`).then();
            const file = ".merrymake/" + (0, utils_1.toFolderName)(name) + ".key";
            (0, utils_1.addToExecuteQueue)(() => do_create_deployment_agent(organization, name, file));
            return hosting_bitbucket_key(organization, file);
        }
        catch (e) {
            throw e;
        }
    });
}
function hosting_bitbucket(organization) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const keyfiles = (0, utils_1.getFiles)(organization.pathTo.with(`.merrymake`)).filter((x) => x.endsWith(".key"));
            const options = keyfiles.map((x) => {
                const f = x.substring(0, x.length - ".key".length);
                return {
                    long: f,
                    text: `use service user ${f}`,
                    action: () => hosting_bitbucket_key(organization, `.merrymake/${f}.key`),
                };
            });
            options.push({
                long: `create`,
                short: `c`,
                text: `create service user`,
                action: () => hosting_bitbucket_create(organization),
            });
            return yield (0, prompt_1.choice)("Which service user would you like to use?", options, {
                invertedQuiet: { cmd: false, select: true },
            }).then();
        }
        catch (e) {
            throw e;
        }
    });
}
function hosting(organization) {
    return (0, prompt_1.choice)("Which host would you like to use?", [
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
