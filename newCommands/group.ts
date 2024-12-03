import fs from "fs";
import { choice, Option, shortText } from "../prompt.js";
import {
  Organization,
  OrganizationId,
  PathToServiceGroup,
  ServiceGroup,
  ServiceGroupId,
} from "../types.js";
import { addToExecuteQueue, finish, sshReq, toFolderName } from "../utils.js";
import { repo_create } from "./repo.js";

export async function do_deleteServiceGroup(
  serviceGroup: ServiceGroup,
  displayName: string
) {
  try {
    console.log(`Deleting service group '${displayName}'...`);
    const reply = await sshReq(`group-delete`, serviceGroup.id.toString());
    console.log(reply);
    if (fs.existsSync(serviceGroup.pathTo.toString()))
      fs.renameSync(
        serviceGroup.pathTo.toString(),
        `(deleted) ${serviceGroup.pathTo}`
      );
  } catch (e) {
    throw e;
  }
}

function deleteServiceGroupId(serviceGroup: ServiceGroup, displayName: string) {
  addToExecuteQueue(async () =>
    do_deleteServiceGroup(serviceGroup, displayName)
  );
  return finish();
}

export async function deleteServiceGroup(organizationId: OrganizationId) {
  try {
    const resp = await sshReq(`group-list`, organizationId.toString());
    if (!resp.startsWith("[")) throw resp;
    const groups: { id: string; name: string }[] = JSON.parse(resp);
    const options: Option[] = groups.map((group) => {
      const folderName = toFolderName(group.name);
      return {
        long: folderName,
        text: `Delete ${group.name} (${folderName})`,
        action: () =>
          deleteServiceGroupId(
            {
              id: new ServiceGroupId(group.id),
              pathTo: new PathToServiceGroup(folderName),
            },
            group.name
          ),
      };
    });
    return await choice(
      "Which service group would you like to delete?",
      options
    ).then();
  } catch (e) {
    throw e;
  }
}

export async function do_createServiceGroup(
  path: PathToServiceGroup,
  organizationId: OrganizationId,
  displayName: string
) {
  try {
    console.log(`Creating service group '${displayName}'...`);
    const reply = await sshReq(
      `group-create`,
      displayName,
      `--organizationId`,
      organizationId.toString()
    );
    if (reply.length !== 8) throw reply;
    fs.mkdirSync(path.toString(), { recursive: true });
    const serviceGroupId = new ServiceGroupId(reply);
    fs.writeFileSync(
      path.with(".group-id").toString(),
      serviceGroupId.toString()
    );
    return serviceGroupId;
  } catch (e) {
    throw e;
  }
}

export async function group(organization: Organization) {
  try {
    let num = 1;
    while (
      fs.existsSync(organization.pathTo.with("service-group-" + num).toString())
    )
      num++;
    const displayName = await shortText(
      "Service group name",
      "Used to share envvars.",
      "service-group-" + num
    ).then();
    const folderName = toFolderName(displayName);
    const pathToServiceGroup = organization.pathTo.with(folderName);
    const serviceGroupId = await do_createServiceGroup(
      pathToServiceGroup,
      organization.id,
      displayName
    );
    return repo_create(organization, {
      pathTo: pathToServiceGroup,
      id: serviceGroupId,
    });
  } catch (e) {
    throw e;
  }
}
