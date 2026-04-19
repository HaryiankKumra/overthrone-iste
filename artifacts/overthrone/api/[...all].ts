import app from "../../api-server/src/app";

export default function handler(req: any, res: any) {
  return app(req, res);
}
