import argon2 from "argon2";

const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 19456, // 19 MiB, OWASP-recommended baseline for argon2id
  timeCost: 2,
  parallelism: 1,
};

// A hash of an unguessable fixed password, used to burn the same CPU time as a
// real verification when an account lookup misses — closes the timing oracle
// that would otherwise leak whether an email exists.
let dummyHashPromise: Promise<string> | undefined;
function getDummyHash(): Promise<string> {
  if (!dummyHashPromise) {
    dummyHashPromise = argon2.hash("tickerpulse-dummy-password-for-timing-safety", ARGON2_OPTIONS);
  }
  return dummyHashPromise;
}

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password);
}

export async function verifyAgainstDummy(password: string): Promise<void> {
  const dummy = await getDummyHash();
  await argon2.verify(dummy, password).catch(() => false);
}
