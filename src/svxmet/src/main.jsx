import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App_met.jsx";
import "./index.css"; // wichtig: globale Styles + Theme-Variablen

createRoot(document.getElementById("root")).render(<App />);
