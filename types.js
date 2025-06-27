import path from "path";
export class OrganizationId {
    organizationId;
    constructor(organizationId) {
        this.organizationId = organizationId;
    }
    toString() {
        return this.organizationId;
    }
}
export class ServiceGroupId {
    serviceGroupId;
    constructor(serviceGroupId) {
        this.serviceGroupId = serviceGroupId;
    }
    toString() {
        return this.serviceGroupId;
    }
}
export class RepositoryId {
    repositoryId;
    constructor(repositoryId) {
        this.repositoryId = repositoryId;
    }
    toString() {
        return this.repositoryId;
    }
}
export class AccessId {
    accessId;
    constructor(accessId) {
        this.accessId = accessId;
    }
    toString() {
        return this.accessId;
    }
}
export class PathToOrganization {
    pathToOrganization;
    constructor(pathToOrganization) {
        this.pathToOrganization = pathToOrganization;
    }
    with(folder) {
        return new PathToServiceGroup(this, folder);
    }
    toString() {
        return this.pathToOrganization;
    }
}
export class PathToServiceGroup {
    pathToParent;
    folder;
    constructor(pathToParent, folder) {
        this.pathToParent = pathToParent;
        this.folder = folder;
    }
    parent() {
        return this.pathToParent;
    }
    with(folder) {
        return new PathToRepository(this, folder);
    }
    toString() {
        return path.join(this.pathToParent.toString(), this.folder);
    }
}
export class PathToRepository {
    pathToParent;
    folder;
    constructor(pathToParent, folder) {
        this.pathToParent = pathToParent;
        this.folder = folder;
    }
    parent() {
        return this.pathToParent;
    }
    with(folder) {
        return new Path(path.join(this.toString(), folder));
    }
    toString() {
        return path.join(this.pathToParent.toString(), this.folder);
    }
}
export class Path {
    path;
    constructor(path) {
        this.path = path;
    }
    with(folder) {
        return new Path(path.join(this.path, folder));
    }
    toString() {
        return this.path;
    }
}
