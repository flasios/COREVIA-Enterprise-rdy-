import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";

function generatePassword(): string {
	const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
	const bytes = randomBytes(20);
	let password = "Aa2!";
	for (let index = 4; index < bytes.length; index += 1) {
		password += alphabet[(bytes[index] ?? 0) % alphabet.length];
	}
	return password.slice(0, 20);
}

function run(command: string, args: string[], env: NodeJS.ProcessEnv): Promise<number> {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, { stdio: "inherit", shell: true, env });
		child.on("error", reject);
		child.on("exit", (code) => resolve(code ?? 0));
	});
}

async function main(): Promise<void> {
	const password = process.env.E2E_PASSWORD || generatePassword();
	const baseUrl = process.env.BASE_URL || "http://127.0.0.1:5001";
	const sharedEnv = {
		...process.env,
		SUPERADMIN_PASSWORD: password,
	};

	const bootstrapExitCode = await run(
		"node",
		["--import", "tsx", "infrastructure/scripts/create-super-admin.ts"],
		sharedEnv,
	);

	if (bootstrapExitCode !== 0) {
		process.exit(bootstrapExitCode);
	}

	const testExitCode = await run(
		"npx",
		[
			"playwright",
			"test",
			"e2e/auth.spec.ts",
			"e2e/authenticated-flows.spec.ts",
			"e2e/enterprise-readiness.spec.ts",
			"e2e/project-lifecycle.spec.ts",
		],
		{
			...sharedEnv,
			BASE_URL: baseUrl,
			E2E_USERNAME: process.env.E2E_USERNAME || "superadmin",
			E2E_PASSWORD: password,
		},
	);

	process.exit(testExitCode);
}

void main();