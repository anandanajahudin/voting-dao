import { execSync } from "child_process";
import fs from "fs";

function runCommand(cmd: string) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
}

async function build() {
  try {
    // Buat folder circuits jika belum ada
    if (!fs.existsSync("circuits")) {
      fs.mkdirSync("circuits");
    }

    // 1. Compile circuit
    runCommand("circom circuits/semaphore.circom --r1cs --wasm --sym -o circuits");

    // 2. Powers of Tau ceremony (with prepare phase2)
    runCommand("snarkjs powersoftau new bn128 12 circuits/pot12_0000.ptau -v");
    runCommand("snarkjs powersoftau contribute circuits/pot12_0000.ptau circuits/pot12_0001.ptau --name=\"First contribution\" --entropy=\"my entropy\" -v");

    // 🔥 Penting: Prepare phase2 agar file valid untuk groth16
    runCommand("snarkjs powersoftau prepare phase2 circuits/pot12_0001.ptau circuits/pot12_final.ptau -v");

    // 3. Setup zkey
    runCommand("snarkjs groth16 setup circuits/semaphore.r1cs circuits/pot12_final.ptau circuits/semaphore_0000.zkey");

    // 4. Contribute to zkey
    runCommand(`snarkjs zkey contribute circuits/semaphore_0000.zkey circuits/semaphore.zkey --name="First contribution" --entropy="my random string" -v`);

    // 5. Export verifier contract
    runCommand("snarkjs zkey export solidityverifier circuits/semaphore.zkey contracts/Verifier_Groth16.sol");

    console.log("\n✅ Build complete, Verifier_Groth16.sol created in contracts/");
  } catch (e) {
    console.error("\n❌ Build failed:", e);
    process.exit(1);
  }
}

build();
