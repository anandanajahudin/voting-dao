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
  const options = ["Yes", "No"];
  const proposalTitle = "Test Anonymous Voting";
  const proposalDesc = "Do you support this DAO?";
  const countingMode = 0; // Simple mode

  before(async function () {
    if (!fs.existsSync(wasmFilePath)) throw new Error("WASM not found");
    if (!fs.existsSync(zkeyFilePath)) throw new Error("ZKEY not found");

    // Create voters and add to group
    for (let i = 0; i < voters; i++) {
      const id = new Identity();
      identities.push(id);
      group.addMember(id.commitment);
    }
    console.log("✅ Group Merkle Root:", group.root.toString());

    // Deploy Verifier contract
    const VerifierFactory = await ethers.getContractFactory("SemaphoreVerifier");
    verifier = await VerifierFactory.deploy();
    await verifier.waitForDeployment();
    const verifierAddr = await verifier.getAddress();

    // Deploy DAO with group root
    const DAOFactory = await ethers.getContractFactory("PrivacyVotingDAOv2");
    dao = await DAOFactory.deploy(verifierAddr, group.root, ethers.ZeroAddress);
    await dao.waitForDeployment();
    console.log("✅ DAO deployed at:", await dao.getAddress());
  });

  it("should allow multiple anonymous votes and tally them", async function () {
    const [owner] = await ethers.getSigners();

    console.log("\n🔨 Creating a Yes/No proposal...");
    const tx = await dao.connect(owner).createProposal(
      proposalTitle,
      proposalDesc,
      countingMode,
      options,
      120 // seconds
    );
    await tx.wait();

    const proposalId = 1;

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

      await dao.vote(
        proposalId,
        randomOption,
        proof.scope, // signalHash
        proof.nullifier,
        proof.merkleTreeRoot,
        proof.points // zk-SNARK proof
      );

      console.log(`🗳️ Voter ${i + 1} voted for: ${options[randomOption]}`);
    }

    // Fetch tallies
    const [yes, no] = await dao.tallies(proposalId, 0, 2);
    console.log("\n📊 Voting results:");
    console.log(`✔️ Yes: ${yes.toString()}`);
    console.log(`❌ No : ${no.toString()}`);

    expect(yes + no).to.equal(BigInt(voters));
  });
});
