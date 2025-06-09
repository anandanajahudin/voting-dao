import { expect } from "chai";
import { ethers } from "hardhat";
import { Identity } from "@semaphore-protocol/identity";
import { Group } from "@semaphore-protocol/group";
import { generateProof } from "@semaphore-protocol/proof";
import * as dotenv from "dotenv";
import path from "path";
import fs from "fs";

// Load env variables
dotenv.config();

describe("PrivacyVotingDAOv2", function () {
  const wasmFilePath = path.resolve(process.env.VERIFIER_WASM_PATH || "./circuits/semaphore.wasm");
  const zkeyFilePath = path.resolve(process.env.VERIFIER_ZKEY_PATH || "./circuits/semaphore.zkey");
  const merkleTreeDepth = parseInt(process.env.MERKLE_TREE_DEPTH || "20");

  let dao: any;
  let verifier: any;

  const group = new Group();
  const identities: Identity[] = [];
  const voters = 5;

  before(async function () {
    if (!fs.existsSync(wasmFilePath)) throw new Error("WASM not found");
    if (!fs.existsSync(zkeyFilePath)) throw new Error("ZKEY not found");

    for (let i = 0; i < voters; i++) {
      const id = new Identity();
      identities.push(id);
      group.addMember(id.commitment);
    }

    console.log("✅ Merkle Root:", group.root.toString());

    const VerifierFactory = await ethers.getContractFactory("SemaphoreVerifier");
    verifier = await VerifierFactory.deploy();
    await verifier.waitForDeployment();

    const DAOFactory = await ethers.getContractFactory("PrivacyVotingDAOv2");
    dao = await DAOFactory.deploy(await verifier.getAddress(), group.root, ethers.ZeroAddress);
    await dao.waitForDeployment();
  });

  it("should create one proposal (Yes/No or Multiple Options) and allow anonymous voting", async function () {
    const [owner] = await ethers.getSigners();

    // 🔀 Randomly choose proposal type
    const isYesNo = Math.random() < 0.5;

    const options = isYesNo
      ? ["Yes", "No"]
      : ["Red", "Blue", "Green", "Yellow"]; // Multiple options

    const title = isYesNo ? "Do you support the new DAO rules?" : "Choose your favorite color";
    const desc = isYesNo ? "Simple Yes/No vote for governance update." : "Color preference vote.";

    const tx = await dao.connect(owner).createProposal(
      title,
      desc,
      0, // CountingMode.Simple
      options,
      120 // duration (seconds)
    );
    await tx.wait();

    const proposalId = 1;

    console.log(`\n📄 Created proposal: "${title}"`);
    console.log(`🔢 Options: ${options.join(", ")}`);

    // 🗳 Each identity votes randomly
    for (let i = 0; i < voters; i++) {
      const identity = identities[i];
      const randomOption = Math.floor(Math.random() * options.length);

      const signal = BigInt(
        ethers.solidityPackedKeccak256(["string"], [`VOTE_${randomOption}`])
      );
      const externalNullifier = BigInt(proposalId);

      const proof = await generateProof(
        identity,
        group,
        externalNullifier,
        signal,
        merkleTreeDepth,
        {
          wasm: wasmFilePath,
          zkey: zkeyFilePath,
        }
      );

      // Kirim vote dan tunggu receipt-nya
      const tx = await dao.vote(
        proposalId,
        randomOption,
        proof.scope, // signalHash
        proof.nullifier,
        proof.merkleTreeRoot,
        proof.points
      );
      const receipt = await tx.wait();

      // Cari event ProofVerified di receipt
      for (const event of receipt.events ?? []) {
        if (event.event === "ProofVerified") {
          console.log(
            `🛡️ ProofVerified Event - Proposal: ${event.args.proposalId.toString()}, MerkleRoot: ${event.args.merkleRoot.toString()}, Nullifier: ${event.args.nullifierHash.toString()}, SignalHash: ${event.args.signalHash.toString()}`
          );
        }
      }

      console.log(`🗳️ Voter ${i + 1} voted for: ${options[randomOption]}`);
    }

    // 📊 Get result
    const tallies: bigint[] = await dao.tallies(proposalId, 0, options.length);
    console.log("\n📊 Voting results:");
    options.forEach((opt, idx) => {
      console.log(`🟢 ${opt}: ${tallies[idx].toString()}`);
    });

    const total = tallies.reduce((acc, val) => acc + val, BigInt(0));
    expect(total).to.equal(BigInt(voters));
  });
});
