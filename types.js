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
        return new PathToServiceGroup(path.join(this.pathToOrganization, folder));
    }
    toString() {
        return this.pathToOrganization;
    }
}
export class PathToServiceGroup {
    pathToServiceGroup;
    constructor(pathToServiceGroup) {
        this.pathToServiceGroup = pathToServiceGroup;
    }
    with(folder) {
        return new PathToRepository(path.join(this.pathToServiceGroup, folder));
    }
    last() {
        return this.pathToServiceGroup.substring(this.pathToServiceGroup.lastIndexOf("/"));
    }
    toString() {
        return this.pathToServiceGroup;
    }
}
export class PathToRepository {
    pathToRepository;
    constructor(pathToRepository) {
        this.pathToRepository = pathToRepository;
    }
    with(folder) {
        return new Path(path.join(this.pathToRepository, folder));
    }
    toString() {
        return this.pathToRepository;
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
