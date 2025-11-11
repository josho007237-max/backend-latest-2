import { Request, Response, NextFunction } from "express";

export const logger = (req: Request, res: Response, next: NextFunction) => {
  const t0 = Date.now();
  const end = () => {
    const dt = Date.now() - t0;
    // console.log(`[${req.method}] ${req.originalUrl} ${dt}ms`);
  };
  res.on("finish", end);
  res.on("close", end);
  next();
};
