import { existsSync } from "fs";
import { addToExecuteQueue, finish } from "../exitMessages.js";
import { outputGit } from "../printUtils.js";
import { CYAN, GRAY, GREEN, NORMAL_COLOR } from "../prompt.js";
import {
  Organization,
  PathToRepository,
  RepositoryId,
  ServiceGroup,
} from "../types.js";
import { sshReq, urlReq } from "../utils.js";
import { Str } from "@merrymake/utils";
import { getCommand } from "../mmCommand.js";

async function do_help(ctx: {
  repositoryId: RepositoryId | undefined;
  repositoryPath: PathToRepository | undefined;
  serviceGroup: ServiceGroup | undefined;
  organization: Organization | undefined;
  inGit: boolean;
  monorepo: boolean;
}) {
  try {
    const whoami: string[] = JSON.parse(await sshReq("me-whoami"));
    if (whoami === undefined || whoami.length === 0) {
      outputGit(`Warning: No verified email. Run 'mm register'`);
    } else {
      outputGit(
        `Logged with: ${GREEN}${Str.list(
          whoami.map((x) => Str.censor(x))
        )}${NORMAL_COLOR}`
      );
    }
  } catch (e) {
    try {
      await urlReq("https://google.com");
    } catch (e) {
      outputGit(`Error: No internet connection.`);
    }
  }
  if (ctx.organization === undefined) {
    outputGit(`Warning: Not inside organization.`);
  } else {
    outputGit(
      `${GRAY}Inside organization (${ctx.organization.id}).${NORMAL_COLOR}`
    );
  }
  if (ctx.serviceGroup === undefined) {
    outputGit(`Warning: Not inside service group.`);
  } else {
    outputGit(
      `${GRAY}Inside service group (${ctx.serviceGroup.id}).${NORMAL_COLOR}`
    );
  }
  if (!existsSync("merrymake.json")) {
    outputGit(`Warning: Not inside service repo.`);
  } else {
    outputGit(
      `${GRAY}Inside service repo (${ctx.repositoryId}).${NORMAL_COLOR}`
    );
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
