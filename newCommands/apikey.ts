import { Str } from "@merrymake/utils";
import { finish } from "../exitMessages.js";
import { outputGit } from "../printUtils.js";
import {
  NORMAL_COLOR,
  Option,
  RED,
  YELLOW,
  choice,
  output,
  resetCommand,
  shortText,
} from "../prompt.js";
import { OrganizationId } from "../types.js";
import { sshReq } from "../utils.js";
import { isDryrun } from "../dryrun.js";

export async function do_key_create(
  organizationId: OrganizationId,
  description: string,
  duration: string
) {
  if (isDryrun()) {
    output("DRYRUN: Would create apikey");
    return "dryrun_id";
  }
  try {
    const cmd = [
      `apikey-create`,
      duration,
      `--organizationId`,
      organizationId.toString(),
    ];
    if (description !== "") cmd.push(`--description`, description);
    const reply = await sshReq(...cmd);
    if (reply.length !== 8) throw reply;
    output(
      `Created apikey${
        description !== "" ? ` '${description}'` : ""
      }: ${YELLOW}${reply}${NORMAL_COLOR}\n`
    );
    return reply;
  } catch (e) {
    throw e;
  }
}

export async function do_key_modify(
  apikeyId: string,
  description: string,
  duration: string
) {
  try {
    if (isDryrun()) {
      output("DRYRUN: Would modify apikey");
      return;
    }
    const cmd = [`apikey-modify`, `--duration`, duration, apikeyId];
    if (description !== "") cmd.push(`--description`, description);
    await sshReq(...cmd);
    outputGit(`Updated key.`);
  } catch (e) {
    throw e;
  }
}

async function key_key_name(
  description: string,
  continuation: (description: string, duration: string) => Promise<never>
) {
  try {
    const duration = await shortText(
      "Duration",
      "How long should the key be active? Ex. 1 hour",
      "14 days"
    );
    return continuation(description, duration);
  } catch (e) {
    throw e;
  }
}

async function key_key(
  currentName: string,
  continuation: (description: string, duration: string) => Promise<never>
) {
  try {
    const description = await shortText(
      "Apikey display name",
      "Used to identify this key",
      currentName
    );
    return key_key_name(description, continuation);
  } catch (e) {
    throw e;
  }
}

async function composeAwait<B, C>(f: (_: B) => Promise<C>, g: Promise<B>) {
  try {
    const b = await g;
    return f(b);
  } catch (e) {
    throw e;
  }
}

export async function key_create(
  organizationId: OrganizationId,
  continuation: (apikeyId: string) => Promise<never>
) {
  try {
    resetCommand("key");
    const description = await shortText(
      "Apikey display name",
      "Used to identify this key",
      ""
    );
    return key_key_name(description, (description, duration) =>
      composeAwait(
        continuation,
        do_key_create(organizationId, description, duration)
      )
    );
  } catch (e) {
    throw e;
  }
}

export async function key(organizationId: OrganizationId) {
  try {
    return await choice(
      [
        {
          long: `new`,
          short: `n`,
          text: `add a new apikey`,
          action: () => key_create(organizationId, finish),
        },
      ],
      async () => {
        const resp = await sshReq(`apikey-list`, organizationId.toString());
        const keys: { name: string; id: string; expiresOn: Date }[] =
          JSON.parse(resp);
        const options: Option[] = [];
        const tableHeader = Str.AsciiTable.advanced(
          {
            Key: 8,
            "Display name>": -12,
            "<Expiry time": 23,
          },
          keys,
          (x) => {
            const d = new Date(x.expiresOn);
            const ds =
              d.getTime() < Date.now()
                ? `${RED}${d.toLocaleString()}${NORMAL_COLOR}`
                : d.toLocaleString();
            const n = x.name || "";
            return [x.id, n, ds];
          },
          (text, x) => {
            options.push({
              long: x.id,
              text,
              action: () =>
                key_key(x.name, (description, duration) =>
                  composeAwait(
                    finish,
                    do_key_modify(x.id, description, duration)
                  )
                ),
            });
          },
          "      "
        );
        return {
          options,
          header: "Which apikey would you like to edit?\n" + tableHeader,
        };
      }
    ).then();
  } catch (e) {
    throw e;
  }
}
