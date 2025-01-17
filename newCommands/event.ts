import { addToExecuteQueue, finish } from "../exitMessages.js";
import { Option, choice, multiSelect } from "../prompt.js";
import { OrganizationId } from "../types.js";
import { sshReq } from "../utils.js";
import { key_create } from "./apikey.js";
import { outputGit } from "../printUtils.js";

export async function do_event(
  apikeyId: string,
  events: { [event: string]: boolean }
) {
  try {
    const selected = Object.keys(events).filter((x) => events[x]);
    await sshReq(`events-allow`, apikeyId, `--events`, selected.join(","));
    outputGit(
      `Allowed event${selected.length > 1 ? "s" : ""} ${selected.join(
        ", "
      )} on key ${apikeyId}.`
    );
  } catch (e) {
    throw e;
  }
}

function event_key_events(
  apikeyId: string,
  events: { [event: string]: boolean }
) {
  addToExecuteQueue(() => do_event(apikeyId, events));
  return finish();
}

async function event_key(apikeyId: string) {
  try {
    const resp = await sshReq(`events-list`, apikeyId);
    const parsed: { event: string; allowed: boolean }[] = JSON.parse(resp);
    const events: { [keyt: string]: boolean } = {};
    parsed.forEach((x) => (events[x.event] = x.allowed));
    return await multiSelect(
      "Which events do you want to allow and disallow?",
      events,
      (s) => event_key_events(apikeyId, s),
      "No events in event-catalogue. Make sure you have added events to the event-catalogue and deployed it."
    );
  } catch (e) {
    throw e;
  }
}

export async function event(organizationId: OrganizationId) {
  try {
    const resp = await sshReq(`apikey-list`, organizationId.toString());
    const keys: { name: string; id: string }[] = JSON.parse(resp);
    const options: Option[] = keys.map((x) => {
      const n = x.name || "";
      return {
        long: x.id,
        text: x.name === null ? x.id : `${x.name} (${x.id})`,
        action: () => event_key(x.id),
      };
    });
    options.push({
      long: `new`,
      short: `n`,
      text: `add a new apikey`,
      action: () => key_create(organizationId, event_key),
    });
    return await choice("Which key to allow events through?", options).then();
  } catch (e) {
    throw e;
  }
}
