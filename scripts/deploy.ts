import { ethers } from "hardhat";
import { AddressZero } from "@ethersproject/constants";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with:", deployer.address);

    const Verifier = await ethers.getContractFactory("SemaphoreVerifier");
    const verifier = await Verifier.deploy();
    await verifier.waitForDeployment(); // ⬅️ gunakan ini di ethers v6
    console.log("Verifier deployed at:", await verifier.getAddress());

    const merkleRoot = 1234567890n;

    const DAO = await ethers.getContractFactory("PrivacyVotingDAOv2");
    const dao = await DAO.deploy(await verifier.getAddress(), merkleRoot, AddressZero);
    await dao.waitForDeployment(); // ⬅️ gunakan ini juga
    console.log("DAO deployed at:", await dao.getAddress());
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
