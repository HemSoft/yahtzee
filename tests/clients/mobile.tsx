import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { LocalProvider } from "../../apps/mobile/src/local/LocalProvider";
import { NativeGameScreen } from "../../apps/mobile/src/screens/NativeGameScreen";
import { History } from "../../apps/mobile/src/screens/History";
import { Help } from "../../apps/mobile/src/screens/Help";
import { Action } from "../../apps/mobile/src/ui/controls";

// Exercises native screen source through react-native-web, not UIKit navigation.
function Fixture() {
  const [screen, setScreen] = useState("play");
  return <LocalProvider>
    <div style={{ height: "100vh", display: screen === "play" ? "flex" : "none", flexDirection: "column" }}>
      <NativeGameScreen onHistory={() => setScreen("history")} onHelp={() => setScreen("help")} />
    </div>
    {screen !== "play" && <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <Action label="Done" onPress={() => setScreen("play")} />
      {screen === "history" ? <History /> : <Help />}
    </div>}
  </LocalProvider>;
}
document.body.style.margin = "0";
createRoot(document.getElementById("root")!).render(<React.StrictMode><Fixture /></React.StrictMode>);
