import { output2, sshReq, addToExecuteQueue, finish } from "../utils";
import { choice, Option, multiSelect } from "../prompt";
import { alignLeft, printTableHeader } from "../executors";
import { stdout } from "process";
import { key_create } from "./apikey";
import { OrganizationId } from "../types";

export async function do_event(
  apikeyId: string,
  events: { [event: string]: boolean }
) {
  try {
    let selected = Object.keys(events).filter((x) => events[x]);
    output2(
      await sshReq(`events-allow`, apikeyId, `--events`, selected.join(","))
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
    const resp = await sshReq(`list-events`, apikeyId);
    const parsed: { event: string; allowed: boolean }[] = JSON.parse(resp);
    const events: { [keyt: string]: boolean } = {};
    parsed.forEach((x) => (events[x.event] = x.allowed));
    return await multiSelect(
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
    let resp = await sshReq(`apikey-list`, organizationId.toString());
    let keys: { name: string; key: string }[] = JSON.parse(resp);
    let options: Option[] = keys.map((x) => {
      let n = x.name || "";
      return {
        long: x.key,
        text: `${x.key} │ ${alignLeft(n, stdout.getWindowSize()[0] - 36 - 9)}`,
        action: () => event_key(x.key),
      };
    });
    options.push({
      long: `new`,
      short: `n`,
      text: `add a new apikey`,
      action: () => key_create(organizationId, event_key),
    });
    let tableHeader = "";
    if (options.length > 1)
      tableHeader = "\n" + printTableHeader("      ", { Key: 36, Name: -12 });
    return await choice(
      "Which key to allow events through?" + tableHeader,
      options
    ).then();
  } catch (e) {
    throw e;
  }
}
