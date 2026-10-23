import crypto from "crypto";

let argon2Module: any = null;
let argon2Available = false;
try {
  argon2Module = require("argon2");
  argon2Available =
    argon2Module &&
    typeof argon2Module.hash === "function" &&
    typeof argon2Module.verify === "function";
} catch {
  argon2Available = false;
}

export const passwordService = {
  async hash(password: string): Promise<string> {
    if (argon2Available && argon2Module && typeof argon2Module.hash === "function") {
      return argon2Module.hash(password, {
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4,
        type: argon2Module.argon2id ?? 0x10,
      });
    }
    // Fallback puro-JS (scrypt) — usado quando o build nativo do argon2 não está disponível (ex. Windows sem toolchain).
    // Em produção (Linux/Docker) o Argon2id nativo é usado.
    return new Promise((resolve, reject) => {
      const salt = crypto.randomBytes(16).toString("hex");
      crypto.scrypt(password, salt, 64, (err, derivedKey) => {
        if (err) return reject(err);
        resolve(`$scrypt$v1$${salt}$${derivedKey.toString("hex")}`);
      });
    });
  },

  async verify(hash: string, password: string): Promise<boolean> {
    if (hash.startsWith("$scrypt$v1$")) {
      const parts = hash.split("$");
      const salt = parts[3];
      const expected = parts[4];
      return new Promise((resolve) => {
        crypto.scrypt(password, salt, 64, (err, derivedKey) => {
          if (err) return resolve(false);
          resolve(crypto.timingSafeEqual(Buffer.from(expected, "hex"), derivedKey));
        });
      });
    }

    if (argon2Available && argon2Module && typeof argon2Module.verify === "function") {
      return argon2Module.verify(hash, password);
    }
    return false;
  },
};
