import { describe, expect, it } from "vitest";
import { formatVirtualVfsFileUri } from "./klipperUri";

describe("virtual VFS file URI formatting", () => {
  it("uses the canonical file URI prefix and standard URL encoding", () => {
    expect(formatVirtualVfsFileUri("/home/user/Documents/A.txt")).toBe("file:///home/user/Documents/A.txt");
    expect(formatVirtualVfsFileUri("/home/user/My File.txt")).toBe("file:///home/user/My%20File.txt");
    expect(formatVirtualVfsFileUri("/home/user/机器人 #?%.txt")).toBe(
      "file:///home/user/%E6%9C%BA%E5%99%A8%E4%BA%BA%20%23%3F%25.txt",
    );
  });

  it("rejects non-canonical relative paths", () => {
    expect(() => formatVirtualVfsFileUri("Documents/A.txt")).toThrow("absolute path");
  });
});
