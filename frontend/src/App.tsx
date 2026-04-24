import { BtGate } from "./pages/BtGate.js";
import { Chat } from "./pages/Chat.js";
import { Login } from "./pages/Login.js";
import { useStore } from "./store.js";

export default function App() {
  const page = useStore((s) => s.page);
  return (
    <div className="min-h-screen h-screen bg-attrax-bg text-attrax-text">
      {(page === "login" || page === "terminated") && <Login />}
      {page === "bt_gate" && <BtGate />}
      {page === "chat" && <Chat />}
    </div>
  );
}
