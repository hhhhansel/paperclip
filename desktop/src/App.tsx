import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Sidebar } from "./components/Sidebar";
import { AgentsPanel } from "./modules/agents/AgentsPanel";
import { CaelPanel } from "./modules/cael/CaelPanel";
import { MaisonPanel } from "./modules/mm/MaisonPanel";
import { OpsPanel } from "./modules/ops/OpsPanel";
import "./theme/global.css";

function App() {
  return (
    <BrowserRouter>
      <div style={{ display: "flex", height: "100vh" }}>
        <Sidebar />
        <main style={{ flex: 1, overflow: "hidden" }}>
          <Routes>
            <Route path="/" element={<AgentsPanel />} />
            <Route path="/cael" element={<CaelPanel />} />
            <Route path="/mm" element={<MaisonPanel />} />
            <Route path="/ops" element={<OpsPanel />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
