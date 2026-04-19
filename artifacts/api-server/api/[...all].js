import app from "../dist/app.mjs";

const appHandler = /** @type {(req: any, res: any) => unknown} */ (app);

export default function handler(req, res) {
  return appHandler(req, res);
}
