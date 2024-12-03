import { VERSION_CMD } from "@merrymake/detect-project-type";
import fs from "fs";
import { GIT_HOST } from "../config.js";
import { choice, shortText } from "../prompt.js";
import { languages, templates } from "../templates.js";
import { RepositoryId, } from "../types.js";
import { Path, TODO, execPromise, finish, sshReq, toFolderName, } from "../utils.js";
import { do_deploy } from "./deploy.js";
import { BITBUCKET_FILE, bitbucketStep } from "./hosting.js";
import { post } from "./post.js";
async function do_pull(pth, repo) {
    try {
        const before = process.cwd();
        process.chdir(pth.toString());
        if (fs.existsSync(".git"))
            await execPromise(`git pull -q "${repo}"`);
        else {
            await execPromise(`git clone -q "${repo}" .`);
            fs.rmSync(".git", { recursive: true, force: true });
        }
        process.chdir(before);
    }
    catch (e) {
        throw e;
    }
}
export function do_fetch_template(pth, template, projectType) {
    console.log(`Fetching ${projectType} template...`);
    return do_pull(pth, `https://github.com/merrymake/${projectType}-${template}-template`);
}
export function do_duplicate(pth, organizationId, groupId, repositoryId) {
    console.log(`Duplicating ${"local folder"} service...`);
    return do_pull(pth, `${GIT_HOST}/o${organizationId}/g${groupId}/r${repositoryId}`);
}
async function service_template_language(pathToService, organizationId, template, projectType) {
    try {
        await do_fetch_template(pathToService, template, projectType);
        return after_service(pathToService, organizationId);
    }
    catch (e) {
        throw e;
    }
}
export async function do_createService(organization, serviceGroup, folderName, displayName) {
    try {
        const repositoryPath = serviceGroup.pathTo.with(folderName);
        console.log(`Creating service '${displayName}'...`);
        const reply = await sshReq(`repository-create`, displayName, `--serviceGroupId`, serviceGroup.id.toString());
        if (reply.length !== 8)
            throw reply;
        const repositoryId = new RepositoryId(reply);
        const repoBase = `g${serviceGroup.id.toString()}/r${repositoryId}`;
        if (fs.existsSync(organization.pathTo.with(BITBUCKET_FILE).toString())) {
            fs.mkdirSync(repositoryPath.toString(), { recursive: true });
            fs.appendFileSync(organization.pathTo.with(BITBUCKET_FILE).toString(), "\n" +
                bitbucketStep(new Path(serviceGroup.pathTo.last()).with(folderName), repoBase));
        }
        else {
            try {
                await execPromise(`git clone -q "${GIT_HOST}/o${organization.id.toString()}/${repoBase}" ${folderName}`, serviceGroup.pathTo.toString());
            }
            catch (e) {
                if (("" + e).startsWith("warning: You appear to have cloned an empty repository.")) {
                }
                else
                    throw e;
            }
            await execPromise(`git symbolic-ref HEAD refs/heads/main`, repositoryPath.toString());
        }
        return repositoryId;
    }
    catch (e) {
        throw e;
    }
}
export async function service_template(pathToService, organizationId, template) {
    try {
        const langs = await Promise.all(templates[template].languages.map((x, i) => (async () => ({
            ...languages[x],
            weight: (await Promise.all(Object.keys(VERSION_CMD[languages[x].projectType]).map((k) => execPromise(VERSION_CMD[languages[x].projectType][k])
                .then((r) => 1)
                .catch((e) => -1)))).reduce((a, x) => a * x, i),
        }))()));
        langs.sort((a, b) => b.weight - a.weight);
        return await choice("Which programming language would you like to use?", langs.map((x) => ({
            long: x.long,
            short: x.short,
            text: x.long,
            action: () => service_template_language(pathToService, organizationId, template, x.projectType),
        }))).then();
    }
    catch (e) {
        throw e;
    }
}
async function after_service_deploy(pathToService, organizationId) {
    try {
        await do_deploy(pathToService);
        return choice("Would you like to post and event to the Rapids? (Trigger the service)", [
            {
                long: "post",
                text: "post an event to the rapids",
                action: () => post(organizationId),
            },
        ], { disableAutoPick: true });
    }
    catch (e) {
        throw e;
    }
}
function after_service(pathToService, organizationId) {
    return choice("Would you like to deploy the new service?", [
        {
            long: "deploy",
            short: "d",
            text: "deploy the service immediately",
            action: () => after_service_deploy(pathToService, organizationId),
        },
    ], { disableAutoPick: true });
}
async function duplicate_then(pathToService, organizationId, groupId, repositoryId) {
    try {
        await do_duplicate(pathToService, organizationId, groupId, repositoryId);
        return after_service(pathToService, organizationId);
    }
    catch (e) {
        throw e;
    }
}
async function duplicate(pathToService, organizationId, serviceGroupId) {
    try {
        const repos = await listRepos(serviceGroupId);
        return await choice("Which service would you like to duplicate?", repos.map((x) => ({
            long: x.id,
            text: `${x.name} (${x.id})`,
            action: () => duplicate_then(pathToService, organizationId, serviceGroupId, new RepositoryId(x.id)),
        }))).then();
    }
    catch (e) {
        throw e;
    }
}
let repoListCache;
export async function listRepos(serviceGroupId) {
    if (repoListCache === undefined) {
        const resp = await sshReq(`repository-list`, serviceGroupId.toString());
        if (!resp.startsWith("["))
            throw resp;
        repoListCache = JSON.parse(resp);
    }
    return repoListCache;
}
export async function repo_create(organization, serviceGroup) {
    try {
        let num = 1;
        while (fs.existsSync(serviceGroup.pathTo.with("repo-" + num).toString()))
            num++;
        const displayName = await shortText("Repository name", "This is where the code lives.", "repo-" + num).then();
        const folderName = toFolderName(displayName);
        const pathToRepository = serviceGroup.pathTo.with(folderName);
        const repositoryId = await do_createService(organization, serviceGroup, folderName, displayName);
        const options = [];
        // const repositories = await listRepos(serviceGroupId);
        // if (repositories.length > 0) {
        //   options.push({
        //     long: "duplicate",
        //     short: "d",
        //     text: "duplicate an existing service",
        //     action: () => duplicate(pathToRepository, org, group),
        //   });
        // }
        Object.keys(templates).forEach((x) => options.push({
            long: templates[x].long,
            short: templates[x].short,
            text: templates[x].text,
            action: () => service_template(pathToRepository, organization.id, x),
        }));
        options.push({
            long: "empty",
            short: "e",
            text: "nothing, just an empty repo",
            action: () => finish(),
        });
        return await choice("What would you like the new repository to contain?", options).then();
    }
    catch (e) {
        throw e;
    }
}
async function repo_edit(pathToGroup, displayName, repositoryId) {
    try {
        const options = [
            {
                long: "rename",
                text: `rename repository`,
                action: TODO,
            },
            {
                long: "delete",
                text: `delete repository '${displayName}' permanently`,
                action: TODO,
            },
        ];
        return await choice("How would you like to edit the repo?", options).then((x) => x);
    }
    catch (e) {
        throw e;
    }
}
export async function repo(organization, serviceGroup) {
    try {
        const repos = await listRepos(serviceGroup.id);
        const options = [];
        options.push({
            long: "create",
            text: `create new repository`,
            action: () => repo_create(organization, serviceGroup),
        });
        repos.forEach((x) => {
            options.push({
                long: x.id,
                text: `edit ${x.name} (${x.id})`,
                action: () => repo_edit(serviceGroup.pathTo, x.name, x.id),
            });
        });
        return await choice("Which repository would you like to manage?", options).then();
    }
    catch (e) {
        throw e;
    }
}
