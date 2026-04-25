import { BtGate } from "./pages/BtGate.js";
import { Chat } from "./pages/Chat.js";
import { Landing } from "./pages/Landing.js";
import { Login } from "./pages/Login.js";
import { useStore } from "./store.js";

export default function App() {
  const page = useStore((s) => s.page);
  // Each page paints its own scene background (Landing has Aurora; Login +
  // BtGate share the light mesh; Chat has its own haze). The outer shell
  // stays transparent so the per-page backdrop isn't overpainted.
  return (
    <div className="h-full min-h-full">
      {page === "landing" && <Landing />}
      {(page === "login" || page === "terminated") && <Login />}
      {page === "bt_gate" && <BtGate />}
      {page === "chat" && <Chat />}
    </div>
  );
}
