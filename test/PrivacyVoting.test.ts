import { expect } from "chai";
import { ethers } from "hardhat";
import { Identity } from "@semaphore-protocol/identity";
import { Group } from "@semaphore-protocol/group";
import { generateProof, SemaphoreProof } from "@semaphore-protocol/proof";
import * as dotenv from "dotenv";
import path from "path";
import fs from "fs";

// Load env variables
dotenv.config();

// Manual type to match zk-SNARK Groth16 proof structure
type Groth16Proof = {
    pi_a: [bigint, bigint];
    pi_b: [[bigint, bigint], [bigint, bigint]];
    pi_c: [bigint, bigint];
};

// Convert Groth16 proof to Solidity-compatible format
function packToSolidityProof(proof: Groth16Proof) {
    return {
        a: [proof.pi_a[0].toString(), proof.pi_a[1].toString()],
        b: [
            [proof.pi_b[0][1].toString(), proof.pi_b[0][0].toString()],
            [proof.pi_b[1][1].toString(), proof.pi_b[1][0].toString()]
        ],
        c: [proof.pi_c[0].toString(), proof.pi_c[1].toString()]
    };
}

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

    it("should create a proposal and allow anonymous voting using zk-SNARK", async function () {
        const [owner] = await ethers.getSigners();

        // Randomize proposal type
        const isYesNo = Math.random() < 0.5;

        const options = isYesNo
            ? ["Yes", "No"]
            : ["Red", "Blue", "Green", "Yellow"];

        const title = isYesNo ? "Do you support the new DAO rules?" : "Choose your favorite color";
        const desc = isYesNo ? "Yes/No governance vote." : "Color preference vote.";

        const tx = await dao.connect(owner).createProposal(
            title,
            desc,
            0, // CountingMode.Simple
            options,
            120 // duration in seconds
        );
        await tx.wait();

        const proposalId = 1;

        console.log(`\n📄 Created proposal: "${title}"`);
        console.log(`🔢 Options: ${options.join(", ")}`);

        const usedNullifiers = new Set<string>();

        for (let i = 0; i < voters; i++) {
            const identity = identities[i];
            const optionIndex = Math.floor(Math.random() * options.length);

            // Hashed signal — this protects the actual vote
            const signal = BigInt(
                ethers.solidityPackedKeccak256(["string"], [`VOTE_${optionIndex}`])
            );

            const externalNullifier = BigInt(proposalId);
            const { generateProof, SemaphoreProof, packToSolidityProof } = require("@semaphore-protocol/proof")
            const fullProof: SemaphoreProof  = await generateProof(
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
            const p = fullProof as any;
            // const solidityProof = {
            //   a: [p.proof[0].toString(), p.proof[1].toString()],
            //   b: [
            //     [p.proof[3].toString(), p.proof[2].toString()],
            //     [p.proof[5].toString(), p.proof[4].toString()]
            //   ],
            //   c: [p.proof[6].toString(), p.proof[7].toString()]
            // };
            // const solidityProof = packToSolidityProof(fullProof);
            const solidityProof = packToSolidityProof(fullProof);
            const nullifierHex = fullProof.nullifier.toString();

            expect(usedNullifiers.has(nullifierHex)).to.be.false;
            usedNullifiers.add(nullifierHex);

            const voteTx = await dao.vote(
                proposalId,
                optionIndex,
                fullProof.scope, // signalHash
                fullProof.nullifier,
                fullProof.merkleTreeRoot,
                solidityProof
            );
            const receipt = await voteTx.wait();

            for (const event of receipt.events ?? []) {
                if (event.event === "ProofVerified") {
                    console.log(`🛡️ ProofVerified - Proposal: ${event.args.proposalId.toString()}`);
                }
            }

            console.log(`🗳️ Voter ${i + 1} voted for: ${options[optionIndex]}`);
        }

        const tallies: bigint[] = await dao.tallies(proposalId, 0, options.length);
        console.log("\n📊 Voting results:");
        options.forEach((opt, idx) => {
            console.log(`🟢 ${opt}: ${tallies[idx].toString()}`);
        });

        const totalVotes = tallies.reduce((acc, val) => acc + val, BigInt(0));
        expect(totalVotes).to.equal(BigInt(voters));
    });
});
