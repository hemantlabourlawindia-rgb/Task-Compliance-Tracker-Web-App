import { Router, type IRouter } from "express";
import healthRouter from "./health";
import dropdownsRouter from "./dropdowns";
import submissionsRouter from "./submissions";

const router: IRouter = Router();

router.use(healthRouter);
router.use(dropdownsRouter);
router.use(submissionsRouter);

export default router;
