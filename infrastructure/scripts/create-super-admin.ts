import { randomBytes } from "node:crypto";
import { eq, or } from "drizzle-orm";
import { db, pool } from "../../platform/db";
import { users, auditLogs } from "@shared/schema";
import { BcryptPasswordHasher } from "../../domains/identity/infrastructure/passwordHasher";
import { SUPERADMIN_USER_ID } from "../../platform/notifications";

const DEFAULT_USERNAME = "superadmin";
const DEFAULT_EMAIL = "admin@corevia.local";
const DEFAULT_DISPLAY_NAME = "COREVIA Superadmin";
const DEFAULT_ROLE = "super_admin";
const DEFAULT_ORGANIZATION_NAME = "Corevia";
const DEFAULT_ORGANIZATION_TYPE = "private-sector";
const DEFAULT_DEPARTMENT_NAME = "Corevia Command Center";

function generatePassword(): string {
	const uppercase = "ABCDEFGHJKLMNPQRSTUVWXYZ";
	const lowercase = "abcdefghijkmnopqrstuvwxyz";
	const digits = "23456789";
	const symbols = "!@#$%^&*";
	const alphabet = `${uppercase}${lowercase}${digits}${symbols}`;
	const bytes = randomBytes(20);
	const firstByte = bytes.at(0) ?? 0;
	const secondByte = bytes.at(1) ?? 0;
	const thirdByte = bytes.at(2) ?? 0;
	const fourthByte = bytes.at(3) ?? 0;
	const prefix = [
		uppercase[firstByte % uppercase.length],
		lowercase[secondByte % lowercase.length],
		digits[thirdByte % digits.length],
		symbols[fourthByte % symbols.length],
	].join("");
	let password = prefix;
	for (let index = 4; index < bytes.length; index += 1) {
		const byte = bytes[index] ?? 0;
		password += alphabet[byte % alphabet.length];
	}
	return password.slice(0, 20);
}

async function main(): Promise<void> {
	const password = process.env.SUPERADMIN_PASSWORD || generatePassword();
	const hasher = new BcryptPasswordHasher();
	const hashedPassword = await hasher.hash(password);

	const existing = await db.select().from(users).where(
		or(
			eq(users.id, SUPERADMIN_USER_ID),
			eq(users.username, DEFAULT_USERNAME),
			eq(users.email, DEFAULT_EMAIL),
		),
	);

	const target = existing[0];

	if (target) {
		await db.update(users)
			.set({
				username: DEFAULT_USERNAME,
				email: DEFAULT_EMAIL,
				displayName: DEFAULT_DISPLAY_NAME,
				role: DEFAULT_ROLE,
				organizationName: DEFAULT_ORGANIZATION_NAME,
				organizationType: DEFAULT_ORGANIZATION_TYPE,
				department: DEFAULT_DEPARTMENT_NAME,
				departmentName: DEFAULT_DEPARTMENT_NAME,
				password: hashedPassword,
				isActive: true,
				updatedAt: new Date(),
			})
			.where(eq(users.id, target.id));

		await db.insert(auditLogs).values({
			userId: target.id,
			action: "reset_super_admin",
			result: "success",
			details: {
				username: DEFAULT_USERNAME,
				email: DEFAULT_EMAIL,
				alignedWithMirroringId: target.id === SUPERADMIN_USER_ID,
			},
		});

		console.log(JSON.stringify({
			status: "updated",
			userId: target.id,
			username: DEFAULT_USERNAME,
			email: DEFAULT_EMAIL,
			role: DEFAULT_ROLE,
			password,
			alignedWithMirroringId: target.id === SUPERADMIN_USER_ID,
		}, null, 2));
	} else {
		const [created] = await db.insert(users).values({
			id: SUPERADMIN_USER_ID,
			username: DEFAULT_USERNAME,
			email: DEFAULT_EMAIL,
			displayName: DEFAULT_DISPLAY_NAME,
			role: DEFAULT_ROLE,
			organizationName: DEFAULT_ORGANIZATION_NAME,
			organizationType: DEFAULT_ORGANIZATION_TYPE,
			department: DEFAULT_DEPARTMENT_NAME,
			departmentName: DEFAULT_DEPARTMENT_NAME,
			password: hashedPassword,
			isActive: true,
		}).returning();

		await db.insert(auditLogs).values({
			userId: created!.id,
			action: "create_super_admin",
			result: "success",
			details: {
				username: DEFAULT_USERNAME,
				email: DEFAULT_EMAIL,
			},
		});

		console.log(JSON.stringify({
			status: "created",
			userId: created!.id,
			username: DEFAULT_USERNAME,
			email: DEFAULT_EMAIL,
			role: DEFAULT_ROLE,
			password,
			alignedWithMirroringId: created!.id === SUPERADMIN_USER_ID,
		}, null, 2));
	}
}

try {
	await main();
} catch (error) {
	const message = error instanceof Error ? error.message : String(error);
	const isConnectionFailure = /ECONNREFUSED|DATABASE_URL|connect/i.test(message);

	if (isConnectionFailure) {
		console.error([
			"[create-super-admin] Unable to reach the configured PostgreSQL instance.",
			`DATABASE_URL=${process.env.DATABASE_URL ?? "<unset>"}`,
			"Start the local database first with `npm run dev:infra` or set DATABASE_URL to a reachable Postgres instance, then retry.",
		].join("\n"));
	} else {
		console.error(`[create-super-admin] ${message}`);
	}

	process.exitCode = 1;
} finally {
	await pool.end();
}
