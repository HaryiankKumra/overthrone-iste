import app from "../artifacts/api-server/src/app.js";

export default function handler(req: any, res: any) {
  return app(req, res);
}
