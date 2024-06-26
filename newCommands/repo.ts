import { VERSION_CMD } from "@merrymake/detect-project-type";
import fs from "fs";
import { GIT_HOST } from "../config";
import { Option, choice, shortText } from "../prompt";
import { languages, templates } from "../templates";
import { Path, TODO, execPromise, sshReq, toFolderName } from "../utils";
import { do_deploy } from "./deploy";
import { post } from "./post";
import {
  OrganizationId,
  PathToRepository,
  PathToServiceGroup,
  RepositoryId,
  ServiceGroupId,
} from "../types";

async function do_pull(pth: PathToRepository, repo: string) {
  try {
    let before = process.cwd();
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
  console.log("Fetching template...");
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
  console.log("Duplicating service...");
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
  pth: PathToServiceGroup,
  organizationId: OrganizationId,
  serviceGroupId: ServiceGroupId,
  folderName: string,
  displayName: string
) {
  try {
    let before = process.cwd();
    process.chdir(pth.toString());
    console.log("Creating service...");
    const reply = await sshReq(
      `repository-create`,
      displayName,
      `--serviceGroupId`,
      serviceGroupId.toString()
    );
    if (reply.length !== 8) throw reply;
    const repositoryId = new RepositoryId(reply);
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
    let repoBase = `${GIT_HOST}/o${organizationId}/g${serviceGroupId}/r${repositoryId}`;
    try {
      await execPromise(`git clone -q "${repoBase}" ${folderName}`);
    } catch (e) {
      if (
        ("" + e).startsWith(
          "warning: You appear to have cloned an empty repository."
        )
      ) {
      } else throw e;
    }
    await execPromise(`git symbolic-ref HEAD refs/heads/main`, folderName);
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
    let langs = await Promise.all(
      templates[template].languages.map((x, i) =>
        (async () => ({
          ...languages[x],
          weight: await execPromise(VERSION_CMD[languages[x].projectType])
            .then((r) => {
              return templates[template].languages.length + 1 - i;
            })
            .catch((e) => {
              return -i;
            }),
        }))()
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
    // TODO would you like to call it
    return choice(
      "Would you like to post and event to the Rapids? (Trigger the service)",
      [
        {
          long: "post",
          text: "post an event to the Rapids",
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
    let repos = await listRepos(serviceGroupId);
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
    let resp = await sshReq(`repository-list`, serviceGroupId.toString());
    if (!resp.startsWith("[")) throw resp;
    repoListCache = JSON.parse(resp);
  }
  return repoListCache!;
}

export async function repo_create(
  pathToGroup: PathToServiceGroup,
  organizationId: OrganizationId,
  serviceGroupId: ServiceGroupId
) {
  try {
    let num = 1;
    while (fs.existsSync(pathToGroup.with("repo-" + num).toString())) num++;
    let displayName = await shortText(
      "Repository name",
      "This is where the code lives.",
      "repo-" + num
    ).then();
    const folderName = toFolderName(displayName);
    const pathToRepository = pathToGroup.with(folderName);
    const repositoryId = await do_createService(
      pathToGroup,
      organizationId,
      serviceGroupId,
      folderName,
      displayName
    );
    let options: Option[] = [];
    // let repositories = await listRepos(serviceGroupId);
    // if (repositories.length > 0) {
    //   options.push({
    //     long: "duplicate",
    //     short: "d",
    //     text: "duplicate an existing service",
    //     action: () => duplicate(pathToRepository, org, group),
    //   });
    // }
    Object.keys(templates).forEach((x) =>
      options.push({
        long: templates[x].long,
        short: templates[x].short,
        text: templates[x].text,
        action: () => service_template(pathToRepository, organizationId, x),
      })
    );
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
    let options: Option[] = [
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
  pathToGroup: PathToServiceGroup,
  organizationId: OrganizationId,
  serviceGroupId: ServiceGroupId
) {
  try {
    let repos = await listRepos(serviceGroupId);
    let options: Option[] = [];
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
    return await choice(
      "Which repository would you like to manage?",
      options
    ).then();
  } catch (e) {
    throw e;
  }
}
