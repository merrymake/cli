import { existsSync } from "fs";
import { readFile } from "fs/promises";
import path from "path";
import { do_startSimulator } from "../Execute.js";
import { choice } from "../prompt.js";
import { OrganizationId, PathToOrganization, PathToRepository, PathToServiceGroup, RepositoryId, ServiceGroupId, } from "../types.js";
import { execPromise } from "../utils.js";
import { key } from "./apikey.js";
import { build } from "./build.js";
import { deploy } from "./deploy.js";
import { envvar } from "./envvar.js";
import { event } from "./event.js";
import { fetch } from "./fetch.js";
import { group } from "./group.js";
import { help } from "./help.js";
import { BITBUCKET_FILE, hosting } from "./hosting.js";
import { orgAction, rename } from "./org.js";
import { queue } from "./rapids.js";
import { register } from "./register.js";
import { repo } from "./repo.js";
import { role } from "./role.js";
import { rollback } from "./rollback.js";
import { update } from "./update.js";
import { upgrade } from "./upgrade.js";
import { REPOSITORY, SERVICE_GROUP } from "../config.js";
import { Str } from "@merrymake/utils";
function partitionLast(str, radix) {
    const index = str.lastIndexOf(radix);
    if (index < 0)
        return [str, ""];
    return [str.substring(0, index), str.substring(index + radix.length)];
}
async function getContext() {
    let repositoryPath;
    let repositoryId;
    let serviceGroup;
    let organization;
    let inGit = false;
    const cwd = process.cwd().split(/\/|\\/);
    let out = "." + path.sep;
    for (let i = cwd.length - 1; i >= 0; i--) {
        if (existsSync(path.join(out, ".git")))
            inGit = true;
        if (existsSync(path.join(out, "merrymake.json"))) {
            const [serviceGroupPath, repositoryFolder] = partitionLast(out, "/");
            const [organizationPath, serviceGroupFolder] = partitionLast(serviceGroupPath, "/");
            repositoryPath = new PathToRepository(new PathToServiceGroup(new PathToOrganization(organizationPath), serviceGroupFolder), repositoryFolder);
            if (existsSync(path.join(out, ".git"))) {
                const repositoryUrl = await execPromise(`git ls-remote --get-url origin`);
                const buffer = repositoryUrl.trim().split("/");
                repositoryId = new RepositoryId(buffer[buffer.length - 1].substring(1));
            }
        }
        else if (existsSync(path.join(out, ".group-id"))) {
            const [organizationPath, serviceGroupFolder] = partitionLast(out, "/");
            serviceGroup = {
                id: new ServiceGroupId(await readFile(path.join(out, ".group-id"), "utf-8")),
                pathTo: new PathToServiceGroup(new PathToOrganization(organizationPath), serviceGroupFolder),
            };
        }
        else if (existsSync(path.join(out, ".merrymake", "conf.json"))) {
            const orgFile = JSON.parse(await readFile(path.join(out, ".merrymake", "conf.json"), "utf-8"));
            organization = {
                id: new OrganizationId(orgFile.organizationId),
                pathTo: new PathToOrganization(out),
            };
            const monorepo = existsSync(path.join(out, ".git"));
            return {
                repositoryId,
                repositoryPath,
                serviceGroup,
                organization,
                inGit,
                monorepo,
            };
        }
        out = path.join(out, "..");
    }
    return {
        repositoryId,
        repositoryPath,
        serviceGroup,
        organization,
        inGit,
        monorepo: false,
    };
}
export async function index() {
    try {
        return choice([
            {
                long: "register",
                text: "register a new device or new user",
                weight: 100,
                action: () => register(),
            },
        ], async () => {
            const options = [];
            const context = await getContext();
            const { repositoryId, repositoryPath, serviceGroup, organization, inGit, monorepo, } = context;
            if (inGit) {
                options.push({
                    long: "deploy",
                    short: "d",
                    text: `deploy this ${REPOSITORY} with git`,
                    weight: 900,
                    action: () => deploy(monorepo),
                });
            }
            if (repositoryId !== undefined) {
                options.push({
                    long: "rollback",
                    short: "r",
                    text: `rollback individual hooks or the entire ${REPOSITORY} to a stable version`,
                    weight: 800,
                    action: () => rollback(repositoryId),
                });
            }
            if (repositoryPath !== undefined) {
                options.push({
                    long: "build",
                    short: "b",
                    text: `build this ${REPOSITORY} locally`,
                    weight: 800,
                    action: () => build(),
                });
                options.push({
                    long: "update",
                    short: "u",
                    text: "upgrade dependencies no breaking changes (Minor)",
                    weight: 800,
                    action: () => update(),
                });
                options.push({
                    long: "upgrade",
                    short: "g",
                    text: "upgrade dependencies including breaking changes (Major)",
                    weight: 800,
                    action: () => upgrade(),
                });
            }
            if (serviceGroup !== undefined) {
                options.push({
                    long: "envvar",
                    short: "e",
                    text: `add or edit an envvar in this ${SERVICE_GROUP}`,
                    weight: 800,
                    action: () => envvar(organization.pathTo, organization.id, serviceGroup.id),
                }, {
                    long: "repo",
                    short: "r",
                    text: `add or edit a ${REPOSITORY}`,
                    weight: 700,
                    action: () => repo(organization, serviceGroup),
                });
            }
            if (organization !== undefined) {
                if (!existsSync(organization.pathTo.with(BITBUCKET_FILE).toString())) {
                    options.push({
                        long: "fetch",
                        short: "f",
                        text: `fetch updates to ${Str.plural(2, SERVICE_GROUP)}s and ${Str.plural(2, REPOSITORY)}`,
                        weight: 600,
                        action: () => fetch(organization),
                    });
                }
                if (serviceGroup === undefined) {
                    if (!existsSync(organization.pathTo.with(BITBUCKET_FILE).toString())) {
                        options.push({
                            long: "hosting",
                            short: "h",
                            text: "configure git hosting with bitbucket",
                            weight: 100,
                            action: () => hosting(organization),
                        });
                    }
                    options.push({
                        long: "group",
                        short: "g",
                        text: `add or edit a ${SERVICE_GROUP}`,
                        weight: 500,
                        action: () => group(organization),
                    }, {
                        long: "role",
                        short: "o",
                        text: "add or assign a role to a user in the organization",
                        weight: 200,
                        action: () => role(organization),
                    }, {
                        long: "rename",
                        short: "_",
                        text: "rename this organization",
                        weight: 1,
                        action: () => rename(organization.id),
                    });
                }
                options.push({
                    long: "rapids",
                    short: "q",
                    text: "view or post a message to the rapids",
                    weight: 1000,
                    action: () => queue(organization.id),
                }, {
                    long: "sim",
                    short: "s",
                    text: "simulate your system locally",
                    weight: 700,
                    action: () => do_startSimulator(organization.pathTo),
                }, {
                    long: "key",
                    short: "k",
                    text: "add or edit an api-key for the organization",
                    weight: 400,
                    action: () => key(organization.id),
                }, {
                    long: "event",
                    short: "v",
                    text: "allow or disallow an event through api-keys for the organization",
                    weight: 300,
                    action: () => event(organization.id),
                });
            }
            else if (organization === undefined) {
                options.push({
                    long: "org",
                    short: "o",
                    text: "manage or checkout an organization",
                    weight: 500,
                    action: () => orgAction(),
                });
            }
            options.push({
                long: "help",
                text: "display helpful information",
                weight: 1,
                action: () => help(context),
            });
            return { options, header: "What would you like to do?" };
        });
    }
    catch (e) {
        throw e;
    }
}
