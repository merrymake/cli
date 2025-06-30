import { finish } from "../exitMessages.js";
import { choice, multiSelect, output } from "../prompt.js";
import { sshReq } from "../utils.js";
import { key_create } from "./apikey.js";
import { outputGit } from "../printUtils.js";
import { Str } from "@merrymake/utils";
import { isDryrun } from "../dryrun.js";
import { DEFAULT_EVENT_CATALOGUE_NAME } from "../config.js";
export async function do_event(apikeyId, events) {
    if (isDryrun()) {
        output("DRYRUN: Would allow events");
        return;
    }
    try {
        const selected = Object.keys(events).filter((x) => events[x]);
        await sshReq(`events-allow`, apikeyId, `--events`, selected.join(","));
        outputGit(`Allowed ${Str.plural("event", selected.length)} ${Str.list(selected)} on the key ${apikeyId}.`);
    }
    catch (e) {
        throw e;
    }
}
async function event_key_events(apikeyId, events) {
    await do_event(apikeyId, events);
    return finish();
}
async function event_key(apikeyId) {
    try {
        const resp = await sshReq(`events-list`, apikeyId);
        const parsed = JSON.parse(resp);
        const events = {};
        parsed.forEach((x) => (events[x.event] = x.allowed));
        return await multiSelect("Which events would you like to allow and disallow?", events, (s) => event_key_events(apikeyId, s), `No events in ${DEFAULT_EVENT_CATALOGUE_NAME}. Make sure you have added events to the ${DEFAULT_EVENT_CATALOGUE_NAME} and deployed it.`);
    }
    catch (e) {
        throw e;
    }
}
export async function event(organizationId) {
    try {
        return await choice([
            {
                long: `new`,
                short: `n`,
                text: `add a new apikey`,
                action: () => key_create(organizationId, event_key),
            },
        ], async () => {
            const resp = await sshReq(`apikey-list`, organizationId.toString());
            const keys = JSON.parse(resp);
            const options = keys.map((x) => {
                return {
                    long: x.id,
                    text: x.name === null ? x.id : `${x.name} (${x.id})`,
                    action: () => event_key(x.id),
                };
            });
            return { options, header: "Which key to allow events through?" };
        }).then();
    }
    catch (e) {
        throw e;
    }
}
