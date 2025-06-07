import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with account:", deployer.address);

  // Deploy verifier contract
  const Verifier = await ethers.getContractFactory("SemaphoreVerifier");
  const verifier = await Verifier.deploy();
  await verifier.waitForDeployment();
  console.log("SemaphoreVerifier deployed to:", await verifier.getAddress());

  // Dummy root for initialization (replace with actual Merkle root if needed)
  const dummyMerkleRoot = BigInt(0);
  const zeroAddress = ethers.ZeroAddress;

  // Deploy DAO contract
  const DAO = await ethers.getContractFactory("PrivacyVotingDAOv2");
  const dao = await DAO.deploy(
    await verifier.getAddress(),
    dummyMerkleRoot,
    zeroAddress
  );
  await dao.waitForDeployment();
  console.log("PrivacyVotingDAOv2 deployed to:", await dao.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
