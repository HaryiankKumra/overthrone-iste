import app from "../src/app.ts";

const appHandler = /** @type {(req: any, res: any) => unknown} */ (app);

export default function handler(req, res) {
  return appHandler(req, res);
}
