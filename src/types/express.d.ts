import "express-serve-static-core";
declare module "express-serve-static-core" {
  interface Request { rawBody?: string }
}
export {};

declare module "express-serve-static-core" {
  interface Request {
    rawBody?: Buffer;
    user?: {
      id: string | number;
      email?: string;
      roles?: string[];
      tenant?: string;
      [k: string]: any;
      rawBody?: string;
    };
  }
}
// src/types/express.d.ts
import type { Request } from "express";

declare global {
  namespace Express {
    interface Request {
      rawBody?: Buffer;
      // หรือ ถ้าคุณใช้เป็น string บางที่: rawBody?: Buffer | string;
    }
  }
}

// src/types/express.d.ts
export {};

declare global {
  namespace Express {
    interface Request {
      bot?: any; // ถ้ามี type ของ Bot อยู่แล้วใช้ Bot แทน any
    }
  }
}
