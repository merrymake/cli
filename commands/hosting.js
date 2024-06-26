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
exports.hosting = exports.do_bitbucket = exports.bitbucketStep = exports.BITBUCKET_FILE = exports.do_create_deployment_agent = void 0;
const fs_1 = __importDefault(require("fs"));
const utils_1 = require("../utils");
const path_1 = __importDefault(require("path"));
const fetch_1 = require("../newCommands/fetch");
const executors_1 = require("../executors");
const prompt_1 = require("../prompt");
function do_create_deployment_agent(org, name, file) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            (0, utils_1.output2)("Creating service user...");
            let cmd = [`service-user`, org];
            if (name !== "")
                cmd.push(`--name`, name);
            let key = yield (0, utils_1.sshReq)(...cmd);
            fs_1.default.writeFileSync(file, key);
        }
        catch (e) {
            throw e;
        }
    });
}
exports.do_create_deployment_agent = do_create_deployment_agent;
exports.BITBUCKET_FILE = "bitbucket-pipelines.yml";
function bitbucketStep(pth) {
    return `          - step:
              name: ${pth}
              script:
                - ./.merrymake/deploy.sh ${pth}`;
}
exports.bitbucketStep = bitbucketStep;
function do_bitbucket(org, host, key) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let struct = (0, utils_1.fetchOrg)();
            fs_1.default.writeFileSync(struct.pathToRoot + path_1.default.join(".merrymake", "deploy.sh"), `set -o errexit
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
case $RES in "Everything up-to-date"*) exit 0 ;; *"if/when the smoke test succeeds"*) exit 0 ;; *"Processed events"*) exit 0 ;; *) echo "Deployment failed"; exit -1 ;; esac`);
            let reply = yield (0, utils_1.sshReq)(`clone`, struct.org.name);
            if (!reply.startsWith("{")) {
                (0, utils_1.output2)(reply);
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
            let folders = [...executors_1.SPECIAL_FOLDERS];
            (0, fetch_1.fetch_internal)("", structure, (path, team, service) => folders.push(path + "/" + service));
            for (let i = 0; i < folders.length; i++) {
                let folder = folders[i];
                (0, utils_1.output2)(`Processing ${folder}`);
                let toService = struct.pathToRoot + folder;
                try {
                    yield (0, utils_1.execPromise)(`git fetch`, toService);
                    yield (0, utils_1.execPromise)(`git reset origin/main`, toService);
                }
                catch (e) { }
                fs_1.default.rmSync(`${toService}/.git`, { recursive: true, force: true });
                pipelineFile.push(bitbucketStep(folder));
            }
            fs_1.default.writeFileSync(struct.pathToRoot + exports.BITBUCKET_FILE, pipelineFile.join("\n"));
            yield (0, utils_1.execPromise)(`git init`, struct.pathToRoot);
            yield (0, utils_1.execPromise)(`git update-index --add --chmod=+x .merrymake/deploy.sh`, struct.pathToRoot);
            yield (0, utils_1.execPromise)(`git remote add origin ${host}`, struct.pathToRoot);
        }
        catch (e) {
            throw e;
        }
    });
}
exports.do_bitbucket = do_bitbucket;
function hosting_bitbucket_key_host(org, host, key) {
    (0, utils_1.addToExecuteQueue)(() => do_bitbucket(org, host, key));
    return (0, utils_1.finish)();
}
function hosting_bitbucket_key(org, file) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let host = yield (0, prompt_1.shortText)("Bitbucket repo", "The URL to the bitbucket mono-repository.", `https://...`).then();
            return hosting_bitbucket_key_host(org, host, file);
        }
        catch (e) {
            throw e;
        }
    });
}
function hosting_bitbucket_create(pathToRoot, org) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let name = yield (0, prompt_1.shortText)("Name", "Display name for the service user", `Service User`).then();
            let file = ".merrymake/" + name.toLowerCase().replace(" ", "-") + ".key";
            (0, utils_1.addToExecuteQueue)(() => do_create_deployment_agent(org, name, file));
            return hosting_bitbucket_key(org, file);
        }
        catch (e) {
            throw e;
        }
    });
}
function hosting_bitbucket(pathToRoot, org) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let keyfiles = (0, utils_1.getFiles)(new utils_1.Path(`${pathToRoot}/.merrymake`)).filter((x) => x.endsWith(".key"));
            let options = keyfiles.map((x) => {
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
            return yield (0, prompt_1.choice)("Which service user would you like to use?", options, {
                invertedQuiet: { cmd: false, select: true },
            }).then();
        }
        catch (e) {
            throw e;
        }
    });
}
function hosting(pathToRoot, org) {
    return (0, prompt_1.choice)("Which host would you like to use?", [
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
exports.hosting = hosting;
