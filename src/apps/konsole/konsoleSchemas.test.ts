import { describe, expect, it } from "vitest";
import { defaultKonsoleSchemaId, getKonsoleSchema, konsoleSchemas } from "./konsoleSchemas";

describe("Konsole schemas", () => {
  it("uses the KDE3 light Default schema without replacing White on Black", () => {
    expect(defaultKonsoleSchemaId).toBe("konsole-default");
    expect(getKonsoleSchema(defaultKonsoleSchemaId)).toMatchObject({ foreground: "#000000", background: "#ffffff" });
    expect(konsoleSchemas.find((schema) => schema.id === "white-on-black")).toMatchObject({ foreground: "#ffffff", background: "#000000" });
  });
});
