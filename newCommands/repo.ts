import { ProjectTypes } from "@merrymake/detect-project-type";
import fs from "fs";
import { GIT_HOST } from "../config.js";
import { TODO, finish } from "../exitMessages.js";
import { Option, choice, shortText } from "../prompt.js";
import { languages, templates } from "../templates.js";
import {
  Organization,
  OrganizationId,
  PathToRepository,
  PathToServiceGroup,
  RepositoryId,
  ServiceGroup,
  ServiceGroupId,
} from "../types.js";
import { Path, execPromise, sshReq, toFolderName } from "../utils.js";
import { do_deploy } from "./deploy.js";
import { BITBUCKET_FILE, bitbucketStep } from "./hosting.js";
import { post } from "./post.js";

async function do_pull(pth: PathToRepository, repo: string) {
  try {
    const before = process.cwd();
    process.chdir(pth.toString());
    if (fs.existsSync(".git")) await execPromise(`git pull -q "${repo}"`);
    else {
      await execPromise(`git clone -q "${repo}" .`);
      fs.rmSync(".git", { recursive: true, force: true });
    }
    process.chdir(before);
  } catch (e) {
    throw e;
  }
}

export function do_fetch_template(
  pth: PathToRepository,
  template: string,
  projectType: string
) {
  console.log(`Fetching ${projectType} template...`);
  return do_pull(
    pth,
    `https://github.com/merrymake/${projectType}-${template}-template`
  );
}

export function do_duplicate(
  pth: PathToRepository,
  organizationId: OrganizationId,
  groupId: ServiceGroupId,
  repositoryId: RepositoryId
) {
  console.log(`Duplicating ${"local folder"} service...`);
  return do_pull(
    pth,
    `${GIT_HOST}/o${organizationId}/g${groupId}/r${repositoryId}`
  );
}

async function service_template_language(
  pathToService: PathToRepository,
  organizationId: OrganizationId,
  template: string,
  projectType: string
) {
  try {
    await do_fetch_template(pathToService, template, projectType);
    return after_service(pathToService, organizationId);
  } catch (e) {
    throw e;
  }
}

export async function do_createService(
  organization: Organization,
  serviceGroup: ServiceGroup,
  folderName: string,
  displayName: string
) {
  try {
    const repositoryPath = serviceGroup.pathTo.with(folderName);
    console.log(`Creating service '${displayName}'...`);
    const reply = await sshReq(
      `repository-create`,
      displayName,
      `--serviceGroupId`,
      serviceGroup.id.toString()
    );
    if (reply.length !== 8) throw reply;
    const repositoryId = new RepositoryId(reply);
    const repoBase = `g${serviceGroup.id.toString()}/r${repositoryId}`;
    if (fs.existsSync(organization.pathTo.with(BITBUCKET_FILE).toString())) {
      fs.mkdirSync(repositoryPath.toString(), { recursive: true });
      fs.appendFileSync(
        organization.pathTo.with(BITBUCKET_FILE).toString(),
        "\n" +
          bitbucketStep(
            new Path(serviceGroup.pathTo.last()).with(folderName),
            repoBase
          )
      );
    } else {
      try {
        await execPromise(
          `git clone -q "${GIT_HOST}/o${organization.id.toString()}/${repoBase}" ${folderName}`,
          serviceGroup.pathTo.toString()
        );
      } catch (e) {
        if (
          ("" + e).startsWith(
            "warning: You appear to have cloned an empty repository."
          )
        ) {
        } else throw e;
      }
      await execPromise(
        `git symbolic-ref HEAD refs/heads/main`,
        repositoryPath.toString()
      );
    }
    return repositoryId;
  } catch (e) {
    throw e;
  }
}

export async function service_template(
  pathToService: PathToRepository,
  organizationId: OrganizationId,
  template: string
) {
  try {
    const langs = await Promise.all(
      templates[template].languages.map((x, i) =>
        (async () => {
          const versionCommands =
            ProjectTypes[languages[x].projectType].versionCommands();
          return {
            ...languages[x],
            weight: (
              await Promise.all(
                Object.keys(versionCommands).map((k) =>
                  versionCommands[k] === undefined
                    ? 1
                    : execPromise(versionCommands[k])
                        .then((r) => 1)
                        .catch((e) => 0)
                )
              )
            ).reduce((a, x) => a * x, i),
          };
        })()
      )
    );
    langs.sort((a, b) => b.weight - a.weight);
    return await choice(
      "Which programming language would you like to use?",
      langs.map((x) => ({
        long: x.long,
        short: x.short,
        text: x.long,
        action: () =>
          service_template_language(
            pathToService,
            organizationId,
            template,
            x.projectType
          ),
      }))
    ).then();
  } catch (e) {
    throw e;
  }
}

async function after_service_deploy(
  pathToService: PathToRepository,
  organizationId: OrganizationId
) {
  try {
    await do_deploy(pathToService);
    return choice(
      "Would you like to post and event to the Rapids? (Trigger the service)",
      [
        {
          long: "post",
          text: "post an event to the rapids",
          action: () => post(organizationId),
        },
      ],
      { disableAutoPick: true }
    );
  } catch (e) {
    throw e;
  }
}

function after_service(
  pathToService: PathToRepository,
  organizationId: OrganizationId
) {
  return choice(
    "Would you like to deploy the new service?",
    [
      {
        long: "deploy",
        short: "d",
        text: "deploy the service immediately",
        action: () => after_service_deploy(pathToService, organizationId),
      },
    ],
    { disableAutoPick: true }
  );
}

async function duplicate_then(
  pathToService: PathToRepository,
  organizationId: OrganizationId,
  groupId: ServiceGroupId,
  repositoryId: RepositoryId
) {
  try {
    await do_duplicate(pathToService, organizationId, groupId, repositoryId);
    return after_service(pathToService, organizationId);
  } catch (e) {
    throw e;
  }
}

async function duplicate(
  pathToService: PathToRepository,
  organizationId: OrganizationId,
  serviceGroupId: ServiceGroupId
) {
  try {
    const repos = await listRepos(serviceGroupId);
    return await choice(
      "Which service would you like to duplicate?",
      repos.map((x) => ({
        long: x.id,
        text: `${x.name} (${x.id})`,
        action: () =>
          duplicate_then(
            pathToService,
            organizationId,
            serviceGroupId,
            new RepositoryId(x.id)
          ),
      }))
    ).then();
  } catch (e) {
    throw e;
  }
}

let repoListCache: { name: string; id: string }[] | undefined;
export async function listRepos(serviceGroupId: ServiceGroupId) {
  if (repoListCache === undefined) {
    const resp = await sshReq(`repository-list`, serviceGroupId.toString());
    if (!resp.startsWith("[")) throw resp;
    repoListCache = JSON.parse(resp);
  }
  return repoListCache!;
}

export async function repo_create(
  organization: Organization,
  serviceGroup: ServiceGroup
) {
  try {
    let num = 1;
    while (fs.existsSync(serviceGroup.pathTo.with("repo-" + num).toString()))
      num++;
    const displayName = await shortText(
      "Repository name",
      "This is where the code lives.",
      "repo-" + num
    ).then();
    const folderName = toFolderName(displayName);
    const pathToRepository = serviceGroup.pathTo.with(folderName);
    const repositories = await listRepos(serviceGroup.id);
    const repositoryId = await do_createService(
      organization,
      serviceGroup,
      folderName,
      displayName
    );
    const options: Option[] = [];
    // console.log(repositories);
    if (repositories.length === 1) {
      options.push({
        long: "duplicate",
        short: "d",
        text: `duplicate ${repositories[0].name}`,
        action: () =>
          duplicate_then(
            pathToRepository,
            organization.id,
            serviceGroup.id,
            new RepositoryId(repositories[0].id)
          ),
      });
    } else if (repositories.length > 0) {
      options.push({
        long: "duplicate",
        short: "d",
        text: "duplicate an existing service",
        action: () =>
          duplicate(pathToRepository, organization.id, serviceGroup.id),
      });
    }
    const langs = await Promise.all(
      templates.basic.languages.map((x, i) =>
        (async () => {
          const versionCommands =
            ProjectTypes[languages[x].projectType].versionCommands();
          return {
            ...languages[x],
            weight: (
              await Promise.all(
                Object.keys(versionCommands).map((k) =>
                  versionCommands[k] === undefined
                    ? 1
                    : execPromise(versionCommands[k])
                        .then((r) => 1)
                        .catch((e) => 0)
                )
              )
            ).reduce((a, x) => a * x, i),
          };
        })()
      )
    );
    langs.sort((a, b) => b.weight - a.weight);
    langs.forEach((x) =>
      options.push({
        long: x.long,
        short: x.short,
        text: `initialize with the basic ${x.long} template`,
        action: () =>
          service_template_language(
            pathToRepository,
            organization.id,
            "basic",
            x.projectType
          ),
      })
    );
    // Object.keys(templates).forEach((x) =>
    //   options.push({
    //     long: templates[x].long,
    //     short: templates[x].short,
    //     text: templates[x].text,
    //     action: () => service_template(pathToRepository, organization.id, x),
    //   })
    // );
    options.push({
      long: "empty",
      short: "e",
      text: "nothing, just an empty repo",
      action: () => finish(),
    });
    return await choice(
      "What would you like the new repository to contain?",
      options
    ).then();
  } catch (e) {
    throw e;
  }
}

async function repo_edit(
  pathToGroup: PathToServiceGroup,
  displayName: string,
  repositoryId: string
) {
  try {
    const options: Option[] = [
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
    return await choice("How would you like to edit the repo?", options).then(
      (x) => x
    );
  } catch (e) {
    throw e;
  }
}

export async function repo(
  organization: Organization,
  serviceGroup: ServiceGroup
) {
  try {
    const repos = await listRepos(serviceGroup.id);
    const options: Option[] = [];
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
    return await choice(
      "Which repository would you like to manage?",
      options
    ).then();
  } catch (e) {
    throw e;
  }
}
