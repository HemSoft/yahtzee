import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("platform", {
  name: "electron",
});
