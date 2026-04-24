import { BtGate } from "./pages/BtGate.js";
import { Chat } from "./pages/Chat.js";
import { Login } from "./pages/Login.js";
import { useStore } from "./store.js";

export default function App() {
  const page = useStore((s) => s.page);
  return (
    <div className="h-full min-h-full bg-stage text-white">
      {(page === "login" || page === "terminated") && <Login />}
      {page === "bt_gate" && <BtGate />}
      {page === "chat" && <Chat />}
    </div>
  );
}
