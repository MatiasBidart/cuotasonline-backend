import { Request, Response, NextFunction } from "express";
import { supabase } from "../config/supabase";

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        error: "Token requerido",
      });
    }

    const token = authHeader.replace("Bearer ", "");

    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      return res.status(401).json({
        success: false,
        error: "Token inválido",
      });
    }

    req.user = data.user;

    next();
  } catch (error) {
    next(error);
  }
};