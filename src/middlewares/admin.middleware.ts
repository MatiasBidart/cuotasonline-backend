import type { NextFunction, Request, Response } from "express";
import { supabase } from "../config/supabase";

export async function adminMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: "Autenticación requerida" });
      return;
    }

    const { data, error } = await supabase
      .from("user")
      .select("admin_status")
      .eq("id", req.user.id)
      .maybeSingle();

    if (error) throw error;
    if (!data?.admin_status) {
      res.status(403).json({ success: false, error: "Se requiere rol de administrador" });
      return;
    }

    next();
  } catch (error) {
    next(error);
  }
}
