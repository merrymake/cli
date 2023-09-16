let args: string[] | undefined;
export function initializeArgs(strs: string[]) {
  args = strs;
}
export function getArgs() {
  return args!;
}
