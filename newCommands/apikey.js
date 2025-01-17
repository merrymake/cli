import { stdout } from "process";
import { alignLeft, printTableHeader } from "../executors.js";
import { finish } from "../exitMessages.js";
import { NORMAL_COLOR, RED, YELLOW, choice, output, shortText, } from "../prompt.js";
import { sshReq } from "../utils.js";
import { outputGit } from "../printUtils.js";
export async function do_key_create(organizationId, description, duration) {
    try {
        const cmd = [
            `apikey-create`,
            duration,
            `--organizationId`,
            organizationId.toString(),
        ];
        if (description !== "")
            cmd.push(`--description`, description);
        const reply = await sshReq(...cmd);
        if (reply.length !== 8)
            throw reply;
        output(`Created apikey ${description !== "" ? `'${description}'` : ""}: ${YELLOW}${reply}${NORMAL_COLOR}\n`);
        const apikeyId = reply;
        return apikeyId;
    }
    catch (e) {
        throw e;
    }
}
export async function do_key_modify(apikeyId, description, duration) {
    try {
        const cmd = [`apikey-modify`, `--duration`, duration, apikeyId];
        if (description !== "")
            cmd.push(`--description`, description);
        await sshReq(...cmd);
        outputGit(`Updated key.`);
    }
    catch (e) {
        throw e;
    }
}
async function key_key_name(description, continuation) {
    try {
        const duration = await shortText("Duration", "How long should the key be active? Ex. 1 hour", "14 days");
        return continuation(description, duration);
    }
    catch (e) {
        throw e;
    }
}
async function key_key(currentName, continuation) {
    try {
        const description = await shortText("Apikey display name", "Used to identify this key", currentName);
        return key_key_name(description, continuation);
    }
    catch (e) {
        throw e;
    }
}
async function composeAwait(f, g) {
    try {
        const b = await g;
        return f(b);
    }
    catch (e) {
        throw e;
    }
}
export async function key_create(organizationId, continuation) {
    try {
        const description = await shortText("Apikey display name", "Used to identify this key", "");
        return key_key_name(description, (description, duration) => composeAwait(continuation, do_key_create(organizationId, description, duration)));
    }
    catch (e) {
        throw e;
    }
}
export async function key(organizationId) {
    try {
        const resp = await sshReq(`apikey-list`, organizationId.toString());
        const keys = JSON.parse(resp);
        const options = keys.map((x) => {
            const d = new Date(x.expiresOn);
            const ds = d.getTime() < Date.now()
                ? `${RED}${d.toLocaleString()}${NORMAL_COLOR}`
                : d.toLocaleString();
            const n = x.name || "";
            return {
                long: x.id,
                text: `${x.id} │ ${alignLeft(n, Math.max((typeof stdout.getWindowSize !== "function"
                    ? 80
                    : stdout.getWindowSize()[0]) -
                    8 -
                    23 -
                    "─┼──┼─".length -
                    "      ".length, 12))} │ ${ds}`,
                action: () => key_key(x.name, (description, duration) => composeAwait(finish, do_key_modify(x.id, description, duration))),
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
                        Key: 8,
                        "Display name": -12,
                        "Expiry time": 23,
                    });
        return await choice("Which apikey would you like to edit?" + tableHeader, options).then();
    }
    catch (e) {
        throw e;
    }
}
