import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { runMigrations } from "../db/migrate";
import { hashPassword } from "../auth/argon2";
import { upsertAccount } from "../auth/repository";

async function main(): Promise<void> {
  runMigrations();

  const rl = readline.createInterface({ input: stdin, output: stdout });
  try {
    // readline has no built-in masked input; since this is a one-time
    // local/ops script (never a public endpoint), a plain prompt is an
    // acceptable tradeoff. Never pass the password as a CLI arg — that
    // would land in shell history.
    const email = await rl.question("Account email: ");
    const password = await rl.question("Account password: ");

    if (!email.includes("@") || password.length < 12) {
      console.error("Refusing to seed: email must contain '@' and password must be at least 12 characters.");
      process.exitCode = 1;
      return;
    }

    const hash = await hashPassword(password);
    upsertAccount(email, hash);
    console.log(`Account for ${email} created/updated.`);
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exitCode = 1;
});
