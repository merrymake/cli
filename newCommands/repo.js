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
exports.repo = exports.repo_create = exports.listRepos = exports.service_template = exports.do_createService = exports.do_duplicate = exports.do_fetch_template = void 0;
const detect_project_type_1 = require("@merrymake/detect-project-type");
const fs_1 = __importDefault(require("fs"));
const config_1 = require("../config");
const prompt_1 = require("../prompt");
const templates_1 = require("../templates");
const utils_1 = require("../utils");
const deploy_1 = require("./deploy");
const post_1 = require("./post");
const types_1 = require("../types");
function do_pull(pth, repo) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let before = process.cwd();
            process.chdir(pth.toString());
            if (fs_1.default.existsSync(".git"))
                yield (0, utils_1.execPromise)(`git pull -q "${repo}"`);
            else {
                yield (0, utils_1.execPromise)(`git clone -q "${repo}" .`);
                fs_1.default.rmSync(".git", { recursive: true, force: true });
            }
            process.chdir(before);
        }
        catch (e) {
            throw e;
        }
    });
}
function do_fetch_template(pth, template, projectType) {
    console.log("Fetching template...");
    return do_pull(pth, `https://github.com/merrymake/${projectType}-${template}-template`);
}
exports.do_fetch_template = do_fetch_template;
function do_duplicate(pth, organizationId, groupId, repositoryId) {
    console.log("Duplicating service...");
    return do_pull(pth, `${config_1.GIT_HOST}/o${organizationId}/g${groupId}/r${repositoryId}`);
}
exports.do_duplicate = do_duplicate;
function service_template_language(pathToService, organizationId, template, projectType) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield do_fetch_template(pathToService, template, projectType);
            return after_service(pathToService, organizationId);
        }
        catch (e) {
            throw e;
        }
    });
}
function do_createService(pth, organizationId, serviceGroupId, folderName, displayName) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let before = process.cwd();
            process.chdir(pth.toString());
            console.log("Creating service...");
            const reply = yield (0, utils_1.sshReq)(`repository-create`, displayName, `--serviceGroupId`, serviceGroupId.toString());
            if (reply.length !== 8)
                throw reply;
            const repositoryId = new types_1.RepositoryId(reply);
            // if (fs.existsSync(pathToRoot + BITBUCKET_FILE)) {
            //   fs.mkdirSync(folderName);
            //   fs.appendFileSync(
            //     pathToRoot + BITBUCKET_FILE,
            //     "\n" + bitbucketStep(group + "/" + displayName)
            //   );
            //   addExitMessage(
            //     `Use '${GREEN}cd ${pth
            //       .with(displayName)
            //       .toString()
            //       .replace(
            //         /\\/g,
            //         "\\\\"
            //       )}${NORMAL_COLOR}' to go to the new service. \nAutomatic deployment added to BitBucket pipeline.`
            //   );
            // } else {
            let repoBase = `${config_1.GIT_HOST}/o${organizationId}/g${serviceGroupId}/r${repositoryId}`;
            try {
                yield (0, utils_1.execPromise)(`git clone -q "${repoBase}" ${folderName}`);
            }
            catch (e) {
                if (("" + e).startsWith("warning: You appear to have cloned an empty repository.")) {
                }
                else
                    throw e;
            }
            yield (0, utils_1.execPromise)(`git symbolic-ref HEAD refs/heads/main`, folderName);
            // addExitMessage(
            //   `Use '${GREEN}cd ${pth
            //     .with(folderName)
            //     .toString()
            //     .replace(
            //       /\\/g,
            //       "\\\\"
            //     )}${NORMAL_COLOR}' to go to the new service. \nThen use '${GREEN}${
            //     process.env["COMMAND"]
            //   } deploy${NORMAL_COLOR}' to deploy it.`
            // );
            // }
            process.chdir(before);
            return repositoryId;
        }
        catch (e) {
            throw e;
        }
    });
}
exports.do_createService = do_createService;
function service_template(pathToService, organizationId, template) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let langs = yield Promise.all(templates_1.templates[template].languages.map((x, i) => (() => __awaiter(this, void 0, void 0, function* () {
                return (Object.assign(Object.assign({}, templates_1.languages[x]), { weight: yield (0, utils_1.execPromise)(detect_project_type_1.VERSION_CMD[templates_1.languages[x].projectType])
                        .then((r) => {
                        return templates_1.templates[template].languages.length + 1 - i;
                    })
                        .catch((e) => {
                        return -i;
                    }) }));
            }))()));
            langs.sort((a, b) => b.weight - a.weight);
            return yield (0, prompt_1.choice)("Which programming language would you like to use?", langs.map((x) => ({
                long: x.long,
                short: x.short,
                text: x.long,
                action: () => service_template_language(pathToService, organizationId, template, x.projectType),
            }))).then();
        }
        catch (e) {
            throw e;
        }
    });
}
exports.service_template = service_template;
function after_service_deploy(pathToService, organizationId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield (0, deploy_1.do_deploy)(pathToService);
            // TODO would you like to call it
            return (0, prompt_1.choice)("Would you like to post and event to the Rapids? (Trigger the service)", [
                {
                    long: "post",
                    text: "post an event to the Rapids",
                    action: () => (0, post_1.post)(organizationId),
                },
            ], { disableAutoPick: true });
        }
        catch (e) {
            throw e;
        }
    });
}
function after_service(pathToService, organizationId) {
    return (0, prompt_1.choice)("Would you like to deploy the new service?", [
        {
            long: "deploy",
            short: "d",
            text: "deploy the service immediately",
            action: () => after_service_deploy(pathToService, organizationId),
        },
    ], { disableAutoPick: true });
}
function duplicate_then(pathToService, organizationId, groupId, repositoryId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield do_duplicate(pathToService, organizationId, groupId, repositoryId);
            return after_service(pathToService, organizationId);
        }
        catch (e) {
            throw e;
        }
    });
}
function duplicate(pathToService, organizationId, serviceGroupId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let repos = yield listRepos(serviceGroupId);
            return yield (0, prompt_1.choice)("Which service would you like to duplicate?", repos.map((x) => ({
                long: x.id,
                text: `${x.name} (${x.id})`,
                action: () => duplicate_then(pathToService, organizationId, serviceGroupId, new types_1.RepositoryId(x.id)),
            }))).then();
        }
        catch (e) {
            throw e;
        }
    });
}
let repoListCache;
function listRepos(serviceGroupId) {
    return __awaiter(this, void 0, void 0, function* () {
        if (repoListCache === undefined) {
            let resp = yield (0, utils_1.sshReq)(`repository-list`, serviceGroupId.toString());
            if (!resp.startsWith("["))
                throw resp;
            repoListCache = JSON.parse(resp);
        }
        return repoListCache;
    });
}
exports.listRepos = listRepos;
function repo_create(pathToGroup, organizationId, serviceGroupId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let num = 1;
            while (fs_1.default.existsSync(pathToGroup.with("repo-" + num).toString()))
                num++;
            let displayName = yield (0, prompt_1.shortText)("Repository name", "This is where the code lives.", "repo-" + num).then();
            const folderName = (0, utils_1.toFolderName)(displayName);
            const pathToRepository = pathToGroup.with(folderName);
            const repositoryId = yield do_createService(pathToGroup, organizationId, serviceGroupId, folderName, displayName);
            let options = [];
            // let repositories = await listRepos(serviceGroupId);
            // if (repositories.length > 0) {
            //   options.push({
            //     long: "duplicate",
            //     short: "d",
            //     text: "duplicate an existing service",
            //     action: () => duplicate(pathToRepository, org, group),
            //   });
            // }
            Object.keys(templates_1.templates).forEach((x) => options.push({
                long: templates_1.templates[x].long,
                short: templates_1.templates[x].short,
                text: templates_1.templates[x].text,
                action: () => service_template(pathToRepository, organizationId, x),
            }));
            return yield (0, prompt_1.choice)("What would you like the new repository to contain?", options).then();
        }
        catch (e) {
            throw e;
        }
    });
}
exports.repo_create = repo_create;
function repo_edit(pathToGroup, displayName, repositoryId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let options = [
                {
                    long: "rename",
                    text: `rename repository`,
                    action: utils_1.TODO,
                },
                {
                    long: "delete",
                    text: `delete repository '${displayName}' permanently`,
                    action: utils_1.TODO,
                },
            ];
            return yield (0, prompt_1.choice)("How would you like to edit the repo?", options).then((x) => x);
        }
        catch (e) {
            throw e;
        }
    });
}
function repo(pathToGroup, organizationId, serviceGroupId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let repos = yield listRepos(serviceGroupId);
            let options = [];
            options.push({
                long: "create",
                text: `create new repository`,
                action: () => repo_create(pathToGroup, organizationId, serviceGroupId),
            });
            repos.forEach((x) => {
                options.push({
                    long: x.id,
                    text: `edit ${x.name} (${x.id})`,
                    action: () => repo_edit(pathToGroup, x.name, x.id),
                });
            });
            return yield (0, prompt_1.choice)("Which repository would you like to manage?", options).then();
        }
        catch (e) {
            throw e;
        }
    });
}
exports.repo = repo;
