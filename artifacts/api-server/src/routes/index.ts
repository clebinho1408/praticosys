import { Router, type IRouter } from "express";
import healthRouter from "./health";
import praticosysRouter from "./praticosys";

const router: IRouter = Router();

router.use(healthRouter);
router.use(praticosysRouter);

export default router;
