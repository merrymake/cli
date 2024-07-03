import fs from "fs";
import { shortText } from "../prompt";
import {
  Organization,
  OrganizationId,
  PathToServiceGroup,
  ServiceGroupId,
} from "../types";
import { sshReq, toFolderName } from "../utils";
import { repo_create } from "./repo";

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
