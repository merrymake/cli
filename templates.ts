import { ProjectType } from "@merrymake/detect-project-type";

export type Languages = {
  [key: string]: {
    long: string;
    short: string;
    projectType: ProjectType;
  };
};
export const languages: Languages = {
  python: { long: "python", short: "p", projectType: "python" },
  csharp: { long: "c#", short: "#", projectType: "csharp" },
  java: { long: "java", short: "j", projectType: "gradle" },
  typescript: { long: "typescript", short: "t", projectType: "typescript" },
  rust: { long: "rust", short: "r", projectType: "rust" },
  go: { long: "go", short: "g", projectType: "go" },
  javascript: { long: "javascript", short: "¤", projectType: "nodejs" },
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
    languages: [
      "python",
      "csharp",
      "java",
      "typescript",
      "rust",
      "go",
      "javascript",
    ],
  },
  // web: {
  //   long: "web",
  //   short: "w",
  //   text: "initialize with a webapp/website template",
  //   languages: ["typescript"],
  // },
  // service: {
  //   long: "service",
  //   short: "s",
  //   text: "initialize with a backend service template",
  //   languages: ["typescript"],
  // },
};
