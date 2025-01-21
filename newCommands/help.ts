import { existsSync } from "fs";
import { addToExecuteQueue, finish } from "../exitMessages.js";
import { outputGit } from "../printUtils.js";
import { CYAN, GREEN, NORMAL_COLOR, RED } from "../prompt.js";
import { fetchOrgRaw, sshReq, urlReq } from "../utils.js";
import {
  Organization,
  PathToRepository,
  RepositoryId,
  ServiceGroup,
} from "../types.js";

async function do_help(ctx: {
  repositoryId: RepositoryId | undefined;
  repositoryPath: PathToRepository | undefined;
  serviceGroup: ServiceGroup | undefined;
  organization: Organization | undefined;
  inGit: boolean;
  monorepo: boolean;
}) {
  try {
    await urlReq("https://google.com");
  } catch (e) {
    outputGit(`Error: No internet connection.`);
    return;
  }
  const whoami = JSON.parse(await sshReq("me-whoami"));
  if (whoami === undefined || whoami.length === 0) {
    outputGit(`Warning: No verified email.`);
  } else {
    outputGit(`Logged in as: ${GREEN}${whoami.join(", ")}${NORMAL_COLOR}`);
  }
  if (ctx.organization === undefined) {
    outputGit(`Warning: Not inside organization.`);
  } else {
    outputGit(`${CYAN}Inside organization${NORMAL_COLOR}`);
  }
  if (ctx.serviceGroup === undefined) {
    outputGit(`Warning: Not inside service group.`);
  } else {
    outputGit(`${CYAN}Inside service group${NORMAL_COLOR}`);
  }
  if (!existsSync("merrymake.json")) {
    outputGit(`Warning: Not inside service repo.`);
  } else {
    outputGit(`${CYAN}Inside service repo${NORMAL_COLOR}`);
  }
}

export function help(ctx: {
  repositoryId: RepositoryId | undefined;
  repositoryPath: PathToRepository | undefined;
  serviceGroup: ServiceGroup | undefined;
  organization: Organization | undefined;
  inGit: boolean;
  monorepo: boolean;
}) {
  addToExecuteQueue(() => do_help(ctx));
  return finish();
}
