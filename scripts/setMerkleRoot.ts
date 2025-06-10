import { ethers } from "hardhat";
import { Group } from "@semaphore-protocol/group";
import fs from "fs";
import path from "path";

async function main() {
  const identityPath = path.join(__dirname, "../data/identityCommitments.json");
  const raw = fs.readFileSync(identityPath, "utf8");
  const identityCommitments: string[] = JSON.parse(raw);

  const group = new Group();
  identityCommitments.forEach((commitment) => {
    group.addMember(BigInt(commitment));
  });

  const merkleRoot = group.root;
  console.log("Merkle Root:", merkleRoot.toString());

  const [signer] = await ethers.getSigners();
  const daoAddr = process.env.DAO!;

  const contract = await ethers.getContractAt(
    "PrivacyVotingDAOv2",
    "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512", // Ganti dengan alamat kontrakmu
  );

  const tx = await contract.updateMemberRoot(merkleRoot);
  await tx.wait();

  console.log("✅ Merkle root updated successfully");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
