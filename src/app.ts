import express from "express";
import { apiRoutes } from "./routes/api.routes";
import { errorHandler } from "./middlewares/error-handler";

export const app = express();

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ success: true, data: { status: "ok" } });
});

app.use("/api", apiRoutes);

app.use((_req, res) => {
  res.status(404).json({ success: false, error: "Endpoint no encontrado" });
});

app.use(errorHandler);
