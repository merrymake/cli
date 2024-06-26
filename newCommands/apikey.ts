import { stdout } from "process";
import { alignLeft, printTableHeader } from "../executors";
import { NORMAL_COLOR, Option, RED, choice, shortText } from "../prompt";
import { finish, output2, sshReq } from "../utils";
import { OrganizationId } from "../types";

export async function do_key_create(
  organizationId: OrganizationId,
  description: string,
  duration: string
) {
  try {
    let cmd = [
      `apikey-create`,
      duration,
      `--organizationId`,
      organizationId.toString(),
    ];
    if (description !== "") cmd.push(`--description`, description);
    let reply = await sshReq(...cmd);
    if (reply.length !== 8) throw reply;
    const apikeyId = reply;
    return apikeyId;
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
    let cmd = [`apikey-modify`, `--duration`, duration, apikeyId];
    if (description !== "") cmd.push(`--description`, description);
    await sshReq(...cmd);
    output2(`Updated key.`);
  } catch (e) {
    throw e;
  }
}

async function key_key_name(
  description: string,
  continuation: (description: string, duration: string) => Promise<never>
) {
  try {
    let duration = await shortText(
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
    let description = await shortText(
      "Human readable description",
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
    let description = await shortText(
      "Human readable description",
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
    let resp = await sshReq(`apikey-list`, organizationId.toString());
    let keys: { name: string; id: string; expiresOn: Date }[] =
      JSON.parse(resp);
    let options: Option[] = keys.map((x) => {
      let d = new Date(x.expiresOn);
      let ds =
        d.getTime() < Date.now()
          ? `${RED}${d.toLocaleString()}${NORMAL_COLOR}`
          : d.toLocaleString();
      let n = x.name || "";
      return {
        long: x.id,
        text: `${x.id} │ ${alignLeft(
          n,
          Math.max(
            stdout.getWindowSize()[0] -
              36 -
              23 -
              "─┼──┼─".length -
              "      ".length,
            12
          )
        )} │ ${ds}`,
        action: () =>
          key_key(x.name, (description, duration) =>
            composeAwait(finish, do_key_modify(x.id, description, duration))
          ),
      };
    });
    options.push({
      long: `new`,
      short: `n`,
      text: `add a new apikey`,
      action: () => key_create(organizationId, finish),
    });
    let tableHeader = "";
    if (options.length > 1)
      tableHeader =
        "\n" +
        printTableHeader("      ", {
          Key: 36,
          Description: -12,
          "Expiry time": 23,
        });
    return await choice(
      "Which apikey would you like to edit?" + tableHeader,
      options
    ).then();
  } catch (e) {
    throw e;
  }
}
