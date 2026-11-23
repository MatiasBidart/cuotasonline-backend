import type { ErrorRequestHandler } from "express";
import { HttpError } from "../errors/http-error";

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  const status = error instanceof HttpError ? error.statusCode : 500;
  const message = error instanceof HttpError ? error.message : "Error interno del servidor";
  if (status >= 500) {
    const details = error instanceof Error
      ? error as Error & { code?: string; status?: number; responseCode?: number; command?: string }
      : null;
    console.error("[api] Request failed", {
      method: _req.method,
      route: _req.route?.path ? `${_req.baseUrl}${_req.route.path}` : _req.baseUrl || "unmatched",
      status,
      name: details?.name,
      code: details?.code,
      errorStatus: details?.status,
      responseCode: details?.responseCode,
      command: details?.command,
    });
  }
  res.status(status).json({ success: false, error: message });
};
