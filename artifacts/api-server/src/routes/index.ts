import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import teamsRouter from "./teams";
import gameRouter from "./game";
import tasksRouter from "./tasks";
import cardsRouter from "./cards";
import leaderboardRouter from "./leaderboard";
import adminRouter from "./admin";

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
