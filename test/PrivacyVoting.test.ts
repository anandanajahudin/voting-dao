import { expect } from "chai"
import { ethers } from "hardhat"
import { Identity } from "@semaphore-protocol/identity"
import { Group } from "@semaphore-protocol/group"
import { generateProof } from "@semaphore-protocol/proof"

describe("PrivacyVotingDAOv2", function () {
    let dao: any
    let verifier: any
    // !! PASTIKAN PATH INI BENAR SESUAI STRUKTUR PROYEK ANDA !!
    // Path ini harus relatif dari root proyek Anda (tempat package.json berada)
    const wasmFilePath = "./circuits/semaphore.wasm" // Ganti jika direktori sirkuit Anda berbeda
    const zkeyFilePath = "./circuits/semaphore.zkey" // Ganti jika direktori sirkuit Anda berbeda

    // Angka '20' ini adalah merkleTreeDepth.
    // Pastikan ini sesuai dengan kedalaman pohon Merkle yang digunakan saat kompilasi sirkuit Anda.
    const merkleTreeDepth = 20;

    // Inisialisasi grup tanpa argumen.
    // Kedalaman pohon Merkle akan ditentukan oleh implementasi default dari Group
    // atau akan secara efektif diatur/digunakan oleh generateProof.
    const group = new Group() 
    const identity = new Identity()

    beforeEach(async function () {
        const VerifierFactory = await ethers.getContractFactory("SemaphoreVerifier")
        verifier = await VerifierFactory.deploy()
        await verifier.waitForDeployment()
        const verifierAddress = await verifier.getAddress()

        // Tambahkan anggota ke grup.
        group.addMember(identity.commitment)
        
        const merkleRoot = group.root

        const DAOFactory = await ethers.getContractFactory("PrivacyVotingDAOv2")
        dao = await DAOFactory.deploy(
            verifierAddress,
            group.root.toString(),
            ethers.ZeroAddress
        )
        await dao.waitForDeployment()
    })

    it("should allow anonymous vote on a proposal", async function () {
        const [owner] = await ethers.getSigners()

        const tx = await dao.connect(owner).createProposal(
            "Test Proposal",
            "Should we use Semaphore?",
            0,
            ["Yes", "No"],
            60
        )
        await tx.wait()

        const proposalId = 1
        const voteOption = 0

        const signal = ethers.keccak256(
            ethers.AbiCoder.defaultAbiCoder().encode(["uint256", "uint8"], [proposalId, voteOption])
        )

        let fullProof: any; // Kita set ke any untuk sementara agar fokus pada runtime dulu
        try {
            console.log(`Attempting to generate proof with:`);
            console.log(`  WASM Path: ${wasmFilePath}`);
            console.log(`  ZKey Path: ${zkeyFilePath}`);
            console.log(`  Merkle Tree Depth for proof generation: ${merkleTreeDepth}`);
            console.log(`  External Nullifier (proposalId): ${proposalId.toString()}`);
            console.log(`  Signal: ${signal}`);

            fullProof = await generateProof(
                identity,
                group,
                proposalId.toString(), // externalNullifier
                signal,
                merkleTreeDepth,      // merkleTreeDepth yang ditentukan secara eksplisit untuk proof
                {
                    wasm: wasmFilePath, // Menggunakan 'wasm' sebagai kunci
                    zkey: zkeyFilePath  // Menggunakan 'zkey' sebagai kunci
                }
            )

            console.log("FullProof object structure:", JSON.stringify(fullProof, null, 2));

            if (!fullProof || typeof fullProof.proof === 'undefined' || typeof fullProof.publicSignals === 'undefined') {
                console.error("Error: fullProof, fullProof.proof, or fullProof.publicSignals is undefined.");
                throw new Error("Failed to generate a valid proof structure. Check console logs for details.");
            }
            if (!fullProof.publicSignals.nullifierHash || !fullProof.publicSignals.merkleRoot) {
                 console.error("Error: nullifierHash or merkleRoot is missing from publicSignals.");
                 throw new Error("Public signals object is incomplete. Check console logs.");
            }

        } catch (error: any) {
            console.error("ERROR during generateProof or initial validation:", error);
            if (error.message && error.message.includes("ENOENT")) {
                console.error("This likely means the .wasm or .zkey file was not found at the specified path.");
            }
            throw error; // Lempar ulang error agar tes gagal
        }

        const solidityProof = fullProof.proof;
        const nullifierHash = fullProof.publicSignals.nullifierHash;
        const proofMerkleRoot = fullProof.publicSignals.merkleRoot; 

        console.log("Proof components extracted successfully:");
        console.log("  Solidity Proof:", solidityProof);
        console.log("  Nullifier Hash:", nullifierHash);
        console.log("  Proof Merkle Root (from proof's publicSignals):", proofMerkleRoot);
        console.log("  Group Merkle Root (used for contract deployment):", group.root.toString());

        await dao.vote(
            proposalId,
            voteOption,
            nullifierHash, 
            group.root,     
            solidityProof   
        )

        const result = await dao.tallies(proposalId, 0, 2)
        expect(result[0]).to.equal(BigInt(1))
        expect(result[1]).to.equal(BigInt(0))
    })
})