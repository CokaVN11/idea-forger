import { createRoot } from "react-dom/client";
import { Provider } from "./lib/context";
import { App } from "./app";
import "./styles.css";
createRoot(document.getElementById("app")!).render(
  <Provider>
    <App />
  </Provider>,
);
