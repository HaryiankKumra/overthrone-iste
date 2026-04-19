import app from "../artifacts/api-server/src/app.js";

const appHandler = app as unknown as (req: any, res: any) => unknown;

export default function handler(req: any, res: any) {
  return appHandler(req, res);
}
