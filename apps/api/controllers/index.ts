export { getHealthStatus, healthController as basicHealthController } from "./healthController";
export {
	coreviaHealthzController,
	healthController,
	readinessController,
	serviceHealthController,
} from "./platformHealthController";