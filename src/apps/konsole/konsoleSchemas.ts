export type KonsoleSchemaId = "konsole-default" | "linux-colors" | "green-on-black" | "white-on-black" | "xterm-colors";

export type KonsoleSchema = {
  readonly id: KonsoleSchemaId;
  readonly label: string;
  readonly foreground: string;
  readonly background: string;
  readonly prompt: string;
  readonly stderr: string;
  readonly system: string;
  readonly completion: string;
};

/**
 * A compact KDE3 schema subset. The historical default schema uses the normal
 * terminal color slots: black foreground on a white background.
 */
export const konsoleSchemas = [
  {
    id: "konsole-default",
    label: "Konsole Default",
    foreground: "#000000",
    background: "#ffffff",
    prompt: "#000000",
    stderr: "#a00000",
    system: "#5a4b00",
    completion: "#004080",
  },
  {
    id: "linux-colors",
    label: "Linux Colors",
    foreground: "#b2b2b2",
    background: "#000000",
    prompt: "#ffffff",
    stderr: "#ff5454",
    system: "#ffff54",
    completion: "#54ffff",
  },
  {
    id: "green-on-black",
    label: "Green on Black",
    foreground: "#18f018",
    background: "#000000",
    prompt: "#54ff54",
    stderr: "#ff5454",
    system: "#ffff54",
    completion: "#54ffff",
  },
  {
    id: "white-on-black",
    label: "White on Black",
    foreground: "#ffffff",
    background: "#000000",
    prompt: "#ffffff",
    stderr: "#ff5454",
    system: "#ffff54",
    completion: "#54ffff",
  },
  {
    id: "xterm-colors",
    label: "XTerm Colors",
    foreground: "#000000",
    background: "#ffffff",
    prompt: "#000000",
    stderr: "#cd0000",
    system: "#cdcd00",
    completion: "#0000cd",
  },
] as const satisfies readonly KonsoleSchema[];

export const defaultKonsoleSchemaId: KonsoleSchemaId = "konsole-default";

export function getKonsoleSchema(id: KonsoleSchemaId): KonsoleSchema {
  return konsoleSchemas.find((schema) => schema.id === id) ?? konsoleSchemas[0];
}
