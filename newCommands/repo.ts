import { ProjectTypes } from "@merrymake/detect-project-type";
import { Promise_all, Str } from "@merrymake/utils";
import { existsSync } from "fs";
import { appendFile, mkdir, rename, rm } from "fs/promises";
import { GIT_HOST, REPOSITORY } from "../config.js";
import { TODO, addExitMessage, finish } from "../exitMessages.js";
import { Option, choice, output, resetCommand, shortText } from "../prompt.js";
import { languages, templates } from "../templates.js";
import {
  Organization,
  OrganizationId,
  PathToRepository,
  PathToServiceGroup,
  RepositoryId,
  RepositoryWithId,
  ServiceGroup,
  ServiceGroupId,
} from "../types.js";
import { Path, execPromise, sshReq } from "../utils.js";
import { do_deploy } from "./deploy.js";
import { BITBUCKET_FILE, bitbucketStep } from "./hosting.js";
import { post, post_event_payload_type } from "./post.js";
import { isDryrun } from "../dryrun.js";
import { COMMAND_COLOR, outputGit } from "../printUtils.js";

async function do_pull(pth: PathToRepository, repo: string) {
  try {
    const before = process.cwd();
    process.chdir(pth.toString());
    if (existsSync(".git")) await execPromise(`git pull -q "${repo}"`);
    else {
      await execPromise(`git clone -q "${repo}" .`);
      await rm(".git", { recursive: true, force: true });
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
  outputGit(`Fetching ${projectType} template...`);
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
  outputGit(`Duplicating ${REPOSITORY}...`);
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
  if (isDryrun()) {
    output(`DRYRUN: Would create ${REPOSITORY}`);
    return "dryrun_id";
  }
  try {
    const repositoryPath = serviceGroup.pathTo.with(folderName);
    outputGit(`Creating ${REPOSITORY} '${displayName}'...`);
    const reply = await sshReq(
      `repository-create`,
      displayName,
      `--serviceGroupId`,
      serviceGroup.id.toString()
    );
    if (reply.length !== 8) throw reply;
    const repositoryId = new RepositoryId(reply);
    const repoBase = `g${serviceGroup.id.toString()}/r${repositoryId}`;
    if (existsSync(organization.pathTo.with(BITBUCKET_FILE).toString())) {
      await mkdir(repositoryPath.toString(), { recursive: true });
      await appendFile(
        organization.pathTo.with(BITBUCKET_FILE).toString(),
        "\n" +
          bitbucketStep(serviceGroup.pathTo.parent().with(folderName), repoBase)
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

export async function do_renameService(
  oldPathToRepository: PathToRepository,
  newRepository: RepositoryWithId,
  newDisplayName: string
) {
  if (isDryrun()) {
    output(`DRYRUN: Would rename ${REPOSITORY}`);
    return;
  }
  try {
    outputGit(`Renaming ${REPOSITORY} to '${newDisplayName}'...`);
    const reply = await sshReq(
      `repository-modify`,
      `--displayName`,
      newDisplayName,
      newRepository.id.toString()
    );
    if (existsSync(oldPathToRepository.toString()))
      await rename(
        oldPathToRepository.toString(),
        newRepository.pathTo.toString()
      );
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
    return await choice([], async () => {
      const langs = await Promise_all(
        ...templates[template].languages.map((x, i) =>
          (async () => {
            const versionCommands =
              ProjectTypes[languages[x].projectType].versionCommands();
            return {
              ...languages[x],
              weight: (
                await Promise_all(
                  ...Object.keys(versionCommands).map(async (k) =>
                    versionCommands[k] === undefined
                      ? 1
                      : await execPromise(versionCommands[k])
                          .then((r) => 1)
                          .catch((e) => 0)
                  )
                )
              ).reduce((a, x) => a * x, i),
            };
          })()
        )
      );
      return {
        options: langs.map((x) => ({
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
        })),
        header: "Which programming language would you like to use?",
      };
    }).then();
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
    resetCommand("rapids");
    return choice(
      [
        {
          long: "post",
          text: "post an event to the rapids",
          action: () =>
            post_event_payload_type(
              organizationId,
              "hello",
              `text/plain`,
              "mellon"
            ),
        },
      ],
      async () => {
        return {
          options: [],
          header:
            "Would you like to post an event to the Rapids? (run the code)",
        };
      },
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
  resetCommand("");
  return choice(
    [
      {
        long: "deploy",
        short: "d",
        text: `deploy the ${REPOSITORY} immediately`,
        action: () => after_service_deploy(pathToService, organizationId),
      },
    ],
    async () => {
      return {
        options: [],
        header: `Would you like to deploy the new ${REPOSITORY}?`,
      };
    },
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
    return await choice([], async () => {
      const repos = await listRepos(serviceGroupId);
      return {
        options: repos.map((x) => ({
          long: x.id,
          text: `${x.name} (${x.id})`,
          action: () =>
            duplicate_then(
              pathToService,
              organizationId,
              serviceGroupId,
              new RepositoryId(x.id)
            ),
        })),
        header: `Which ${REPOSITORY} would you like to duplicate?`,
      };
    }).then();
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

export async function repo_create_name(
  organization: Organization,
  serviceGroup: ServiceGroup,
  displayName: string
) {
  try {
    resetCommand("repo new " + displayName);
    const folderName = Str.toFolderName(displayName);
    const pathToRepository = serviceGroup.pathTo.with(folderName);
    const repositoryId = await do_createService(
      organization,
      serviceGroup,
      folderName,
      displayName
    );
    addExitMessage(
      `Remember to: '${COMMAND_COLOR}cd ${pathToRepository.toString()}${
        Str.FG_DEFAULT
      }'`
    );
    return await choice(
      [
        {
          long: "empty",
          short: "e",
          text: "nothing, just an empty repo",
          action: () => finish(),
        },
      ],
      async () => {
        const options: Option[] = [];
        // console.log(repositories);
        const repositories = await listRepos(serviceGroup.id);
        const others = repositories.filter(
          (x) => x.id !== repositoryId.toString()
        );
        if (others.length === 1) {
          options.push({
            long: "duplicate",
            short: "d",
            text: `duplicate ${others[0].name}`,
            action: () =>
              duplicate_then(
                pathToRepository,
                organization.id,
                serviceGroup.id,
                new RepositoryId(others[0].id)
              ),
          });
        } else if (others.length > 1) {
          options.push({
            long: "duplicate",
            short: "d",
            text: `duplicate an existing ${REPOSITORY}`,
            action: () =>
              duplicate(pathToRepository, organization.id, serviceGroup.id),
          });
        }
        const langs = await Promise_all(
          ...templates.basic.languages.map((x, i) =>
            (async () => {
              const versionCommands =
                ProjectTypes[languages[x].projectType].versionCommands();
              return {
                ...languages[x],
                weight: (
                  await Promise_all(
                    ...Object.keys(versionCommands).map(async (k) =>
                      versionCommands[k] === undefined
                        ? 1
                        : await execPromise(versionCommands[k])
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
        return {
          options,
          header: `What would you like the new ${REPOSITORY} to contain?`,
        };
      }
    ).then();
  } catch (e) {
    throw e;
  }
}

export async function repo_create(
  organization: Organization,
  serviceGroup: ServiceGroup
) {
  try {
    resetCommand("repo new");
    let num = 1;
    while (existsSync(serviceGroup.pathTo.with("repo-" + num).toString()))
      num++;
    const displayName = await shortText(
      `${REPOSITORY[0].toUpperCase() + REPOSITORY.substring(1)} name`,
      "This is where the code lives.",
      "repo-" + num
    ).then();
    return await repo_create_name(organization, serviceGroup, displayName);
  } catch (e) {
    throw e;
  }
}

async function repo_edit_rename(
  oldPathToRepository: PathToRepository,
  oldDisplayName: string,
  repositoryId: RepositoryId
) {
  try {
    const newDisplayName = await shortText(
      `${REPOSITORY[0].toUpperCase() + REPOSITORY.substring(1)} name`,
      "This is where the code lives.",
      oldDisplayName
    ).then();
    const folderName = Str.toFolderName(newDisplayName);
    const newPathToRepository = oldPathToRepository.parent().with(folderName);
    await do_renameService(
      oldPathToRepository,
      { pathTo: newPathToRepository, id: repositoryId },
      newDisplayName
    );
    return finish();
  } catch (e) {
    throw e;
  }
}

async function repo_edit(
  pathToGroup: PathToServiceGroup,
  displayName: string,
  repositoryId: RepositoryId
) {
  try {
    return await choice(
      [
        {
          long: "rename",
          text: `rename ${REPOSITORY}`,
          action: () =>
            repo_edit_rename(
              pathToGroup.with(Str.toFolderName(displayName)),
              displayName,
              repositoryId
            ),
        },
        {
          long: "delete",
          text: `delete ${REPOSITORY} '${displayName}' permanently`,
          action: TODO,
        },
      ],
      async () => {
        return {
          options: [],
          header: `How would you like to edit the ${REPOSITORY}?`,
        };
      }
    ).then((x) => x);
  } catch (e) {
    throw e;
  }
}

export async function repo(
  organization: Organization,
  serviceGroup: ServiceGroup
) {
  try {
    return await choice(
      [
        {
          long: "new",
          short: "n",
          text: `create a new ${REPOSITORY}`,
          action: () => repo_create(organization, serviceGroup),
        },
      ],
      async () => {
        const repos = await listRepos(serviceGroup.id);
        const options: Option[] = [];
        repos.forEach((x) => {
          options.push({
            long: x.id,
            short: "e",
            text: `edit '${x.name}'`,
            action: () =>
              repo_edit(serviceGroup.pathTo, x.name, new RepositoryId(x.id)),
          });
        });
        return {
          options,
          header: `Which ${REPOSITORY} would you like to manage?`,
        };
      }
    ).then();
  } catch (e) {
    throw e;
  }
}
