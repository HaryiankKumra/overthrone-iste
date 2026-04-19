import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import teamsRouter from "./teams.js";
import gameRouter from "./game.js";
import tasksRouter from "./tasks.js";
import cardsRouter from "./cards.js";
import leaderboardRouter from "./leaderboard.js";
import adminRouter from "./admin.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(teamsRouter);
router.use(gameRouter);
router.use(tasksRouter);
router.use(cardsRouter);
router.use(leaderboardRouter);
router.use(adminRouter);

export default router;
