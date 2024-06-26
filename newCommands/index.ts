import path from "path";
import { Option, choice } from "../prompt";
import {
  OrganizationId,
  PathToOrganization,
  PathToRepository,
  PathToServiceGroup,
  RepositoryId,
  ServiceGroupId,
} from "../types";
import { OrgFile, execPromise } from "../utils";
import { queue } from "./queue";
import { register } from "./register";
import { role } from "./role";
import fs from "fs";
import { org, orgAction } from "./org";
import { key } from "./apikey";
import { event } from "./event";
import { group } from "./group";
import { repo } from "./repo";
import { fetch } from "./fetch";
import { deploy } from "./deploy";
import { envvar } from "./envvar";

async function getContext() {
  let repository: { id: RepositoryId; pathTo: PathToRepository } | undefined;
  let serviceGroup:
    | { id: ServiceGroupId; pathTo: PathToServiceGroup }
    | undefined;
  let organization:
    | { id: OrganizationId; pathTo: PathToOrganization }
    | undefined;
  let cwd = process.cwd().split(/\/|\\/);
  let out = "";
  for (let i = cwd.length - 1; i >= 0; i--) {
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
      return { repository, serviceGroup, organization };
    }
    out += ".." + path.sep;
  }
  return {
    repository,
    serviceGroup,
    organization,
  };
}

export async function index() {
  try {
    const options: Option[] = [];
    const { repository, serviceGroup, organization } = await getContext();
    if (repository !== undefined) {
      options.push({
        long: "deploy",
        short: "d",
        text: "deploy service to the cloud",
        action: () => deploy(),
      });
    }
    if (serviceGroup !== undefined) {
      if (repository === undefined) {
        options.push({
          long: "fetch",
          short: "f",
          text: "fetch updates to service groups and repos",
          action: () => fetch(organization!.pathTo, organization!.id),
        });
      }
      options.push(
        {
          long: "envvar",
          short: "e",
          text: "add or edit envvar for service group",
          action: () =>
            envvar(organization!.pathTo, organization!.id, serviceGroup.id),
        },
        {
          long: "repo",
          short: "r",
          text: "add or edit repository",
          action: () =>
            repo(serviceGroup.pathTo, organization!.id, serviceGroup.id),
        }
      );
    }
    if (organization !== undefined) {
      if (serviceGroup === undefined) {
        options.push({
          long: "group",
          short: "g",
          text: "create a service group",
          action: () => group(organization.pathTo, organization.id),
        });
      }
      options.push(
        {
          long: "rapids",
          short: "q",
          text: "view or post messages to the rapids",
          action: () => queue(organization.id),
        },
        {
          long: "key",
          short: "k",
          text: "add or edit api-keys for the organization",
          action: () => key(organization.id),
        },
        {
          long: "event",
          short: "v",
          text: "allow or disallow events through api-keys for the organization",
          action: () => event(organization.id),
        },
        {
          long: "role",
          short: "o",
          text: "add or assign roles to users in the organization",
          action: () => role(organization.id),
        }
      );
    } else if (organization === undefined) {
      options.push(
        {
          long: "start",
          text: "start for new user or new device",
          action: () => register(),
        },
        {
          long: "org",
          short: "o",
          text: "manage or checkout organizations",
          action: () => orgAction(),
        }
      );
    }
    return choice("What would you like to do?", options);
  } catch (e) {
    throw e;
  }
}
