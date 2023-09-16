import { ProjectType } from "@mist-cloud-eu/project-type-detect";

export type Languages = {
  [key: string]: {
    long: string;
    short: string;
    projectType: ProjectType;
  };
};
export const languages: Languages = {
  python: { long: "python", short: "p", projectType: "python" },
  typescript: { long: "typescript", short: "t", projectType: "typescript" },
  javascript: { long: "javascript", short: "¤", projectType: "nodejs" },
  rust: { long: "rust", short: "r", projectType: "rust" },
  java: { long: "java", short: "j", projectType: "gradle" },
  csharp: { long: "c#", short: "#", projectType: "csharp" },
  go: { long: "go", short: "g", projectType: "go" },
};

export const templates: {
  [key: string]: {
    long: string;
    short: string;
    text: string;
    languages: (keyof typeof languages)[];
  };
} = {
  basic: {
    long: "basic",
    short: "b",
    text: "initialize with a basic template",
    languages: ["typescript"],
  },
  web: {
    long: "web",
    short: "w",
    text: "initialize with a webapp/website template",
    languages: ["typescript"],
  },
  service: {
    long: "service",
    short: "s",
    text: "initialize with a backend service template",
    languages: ["typescript"],
  },
};
