import fs from "fs";
import path from "path";
import { do_startSimulator } from "../Execute.js";
import { Option, choice } from "../prompt.js";
import {
  Organization,
  OrganizationId,
  PathToOrganization,
  PathToRepository,
  PathToServiceGroup,
  Repository,
  RepositoryId,
  RepositoryWithId,
  ServiceGroup,
  ServiceGroupId,
} from "../types.js";
import { OrgFile, execPromise } from "../utils.js";
import { key } from "./apikey.js";
import { build } from "./build.js";
import { deploy } from "./deploy.js";
import { envvar } from "./envvar.js";
import { event } from "./event.js";
import { fetch } from "./fetch.js";
import { group } from "./group.js";
import { BITBUCKET_FILE, hosting } from "./hosting.js";
import { orgAction, rename } from "./org.js";
import { queue } from "./queue.js";
import { register } from "./register.js";
import { repo } from "./repo.js";
import { role } from "./role.js";

async function getContext() {
  let repository: Repository | RepositoryWithId | undefined;
  let serviceGroup: ServiceGroup | undefined;
  let organization: Organization | undefined;
  let inGit = false;
  const cwd = process.cwd().split(/\/|\\/);
  let out = "." + path.sep;
  for (let i = cwd.length - 1; i >= 0; i--) {
    if (fs.existsSync(path.join(out, ".git"))) inGit = true;
    if (fs.existsSync(path.join(out, "merrymake.json"))) {
      if (fs.existsSync(path.join(out, ".git"))) {
        const repositoryUrl = await execPromise(
          `git ls-remote --get-url origin`
        );
        const buffer = repositoryUrl.split("/");
        repository = {
          id: new RepositoryId(buffer[buffer.length - 1]),
          pathTo: new PathToRepository(out),
        };
      } else {
        repository = {
          pathTo: new PathToRepository(out),
        };
      }
      // TODO bitbucket
    } else if (fs.existsSync(path.join(out, ".group-id"))) {
      serviceGroup = {
        id: new ServiceGroupId(
          fs.readFileSync(path.join(out, ".group-id")).toString()
        ),
        pathTo: new PathToServiceGroup(out),
      };
    } else if (fs.existsSync(path.join(out, ".merrymake", "conf.json"))) {
      const orgFile: OrgFile = JSON.parse(
        fs.readFileSync(path.join(out, ".merrymake", "conf.json")).toString()
      );
      organization = {
        id: new OrganizationId(orgFile.organizationId),
        pathTo: new PathToOrganization(out),
      };
      return { repository, serviceGroup, organization, inGit };
    }
    out = path.join(out, "..");
  }
  return {
    repository,
    serviceGroup,
    organization,
  };
}

export async function index() {
  try {
    const options: (Option & { weight: number })[] = [];
    const { repository, serviceGroup, organization, inGit } =
      await getContext();
    if (inGit) {
      options.push({
        long: "deploy",
        short: "d",
        text: "deploy service with git",
        weight: 900,
        action: () => deploy(),
      });
    }
    if (repository !== undefined) {
      options.push({
        long: "build",
        short: "b",
        text: "build service locally",
        weight: 800,
        action: () => build(),
      });
    }
    if (serviceGroup !== undefined) {
      options.push(
        {
          long: "envvar",
          short: "e",
          text: "add or edit envvar for service group",
          weight: 800,
          action: () =>
            envvar(organization!.pathTo, organization!.id, serviceGroup.id),
        },
        {
          long: "repo",
          short: "r",
          text: "add or edit repository",
          weight: 700,
          action: () => repo(organization!, serviceGroup),
        }
      );
    }
    if (organization !== undefined) {
      if (!fs.existsSync(organization.pathTo.with(BITBUCKET_FILE).toString())) {
        options.push({
          long: "fetch",
          short: "f",
          text: "fetch updates to service groups and repos",
          weight: 600,
          action: () => fetch(organization),
        });
      }
      if (serviceGroup === undefined) {
        if (
          !fs.existsSync(organization.pathTo.with(BITBUCKET_FILE).toString())
        ) {
          options.push({
            long: "hosting",
            short: "h",
            text: "configure git hosting with bitbucket",
            weight: 100,
            action: () => hosting(organization),
          });
        }
        options.push(
          {
            long: "delete",
            short: "d",
            text: "delete a service group",
            weight: 100,
            action: () => hosting(organization),
          },
          {
            long: "group",
            short: "g",
            text: "create a service group",
            weight: 500,
            action: () => group(organization),
          },
          {
            long: "role",
            short: "o",
            text: "add or assign roles to users in the organization",
            weight: 200,
            action: () => role(organization),
          },
          {
            long: "rename",
            short: "_",
            text: "rename the organization",
            weight: 1,
            action: () => rename(organization.id),
          }
        );
      }
      options.push(
        {
          long: "rapids",
          short: "q",
          text: "view or post messages to the rapids",
          weight: 1000,
          action: () => queue(organization.id),
        },
        {
          long: "sim",
          short: "s",
          text: "simulate your system locally",
          weight: 700,
          action: () => do_startSimulator(organization.pathTo),
        },
        {
          long: "key",
          short: "k",
          text: "add or edit api-keys for the organization",
          weight: 400,
          action: () => key(organization.id),
        },
        {
          long: "event",
          short: "v",
          text: "allow or disallow events through api-keys for the organization",
          weight: 300,
          action: () => event(organization.id),
        }
      );
    } else if (organization === undefined) {
      options.push(
        {
          long: "start",
          text: "start for new user or new device",
          weight: 900,
          action: () => register(),
        },
        {
          long: "org",
          short: "o",
          text: "manage or checkout organizations",
          weight: 500,
          action: () => orgAction(),
        }
      );
    }
    options.sort((a, b) => b.weight - a.weight);
    return choice("What would you like to do?", options);
  } catch (e) {
    throw e;
  }
}
