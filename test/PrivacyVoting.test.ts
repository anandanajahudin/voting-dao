import { expect } from "chai";
import { ethers } from "hardhat";
import { Identity } from "@semaphore-protocol/identity";
import { Group } from "@semaphore-protocol/group";
import { generateProof } from "@semaphore-protocol/proof";
import path from "path";
import fs from "fs";

describe("PrivacyVotingDAOv2", function () {
  let dao: any;
  let verifier: any;

  const wasmFilePath = path.resolve("./circuits/semaphore.wasm");
  const zkeyFilePath = path.resolve("./circuits/semaphore.zkey");
  const merkleTreeDepth = 20;

  const group = new Group();
  const identity = new Identity();

  beforeEach(async function () {
    // Validasi file proof
    if (!fs.existsSync(wasmFilePath)) {
      throw new Error(`WASM not found at ${wasmFilePath}`);
    }
    if (!fs.existsSync(zkeyFilePath)) {
      throw new Error(`ZKey not found at ${zkeyFilePath}`);
    }

    // Deploy Verifier
    const VerifierFactory = await ethers.getContractFactory("SemaphoreVerifier");
    verifier = await VerifierFactory.deploy();
    await verifier.waitForDeployment();
    const verifierAddress = await verifier.getAddress();

    // Add member to group
    group.addMember(identity.commitment);
    console.log("✅ Group Merkle Root:", group.root.toString());

    // Deploy DAO contract
    const DAOFactory = await ethers.getContractFactory("PrivacyVotingDAOv2");
    dao = await DAOFactory.deploy(verifierAddress, BigInt(group.root), ethers.ZeroAddress);
    await dao.waitForDeployment();
    console.log("✅ DAO deployed at:", await dao.getAddress());
  });

  it("should allow anonymous vote on a proposal", async function () {
    const [owner] = await ethers.getSigners();

    console.log("\n🔨 Creating proposal...");
    const createTx = await dao.connect(owner).createProposal(
      "Test Proposal",
      "Should we use Semaphore?",
      0,
      ["Yes", "No"],
      60
    );
    await createTx.wait();
    console.log("✅ Proposal created successfully.");

    const proposalId = 1;
    const voteOption = 0;

    // Generate signal and proof
    const signal = BigInt(
      ethers.solidityPackedKeccak256(["string"], [`VOTE_${voteOption}`])
    );
    const externalNullifier = BigInt(proposalId);

    console.log("\n🧠 Generating zero-knowledge proof...");
    const fullProof: any = await generateProof(
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
    console.log("✅ ZK Proof generated.");

    const {
      nullifier,
      scope, // signalHash
      merkleTreeRoot,
      points // solidity-formatted proof
    } = fullProof;

    console.log("\n🗳️ Voting anonymously...");
    const voteTx = await dao.vote(proposalId, voteOption, scope, nullifier, merkleTreeRoot, points);
    await voteTx.wait();
    console.log("✅ Vote submitted successfully.");

    // Query results
    console.log("\n📊 Fetching proposal tally...");
    const [yesCount, noCount] = await dao.tallies(proposalId, 0, 2);
    console.log(`🧮 Tally result for Proposal #${proposalId}:`);
    console.log(`   ✔️ Yes: ${yesCount.toString()}`);
    console.log(`   ❌ No : ${noCount.toString()}`);

    expect(yesCount).to.equal(BigInt(1));
    expect(noCount).to.equal(BigInt(0));
  });
});
