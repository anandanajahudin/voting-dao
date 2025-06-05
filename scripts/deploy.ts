import { ethers as hardhatEthers } from "hardhat";
import { AddressZero } from "@ethersproject/constants";

async function main() {
    const [deployer] = await hardhatEthers.getSigners();
    console.log("Deploying contracts with:", deployer.address);

    const Verifier = await hardhatEthers.getContractFactory("SemaphoreVerifier");
    const verifier = await Verifier.deploy();
    await verifier.deployed();
    console.log("Verifier deployed at:", verifier.address);

    const merkleRoot = 1234567890n; // Ganti ini jika sudah punya root hasil dari frontend
    const DAO = await hardhatEthers.getContractFactory("PrivacyVotingDAOv2");
    const dao = await DAO.deploy(verifier.address, merkleRoot, AddressZero); // AddressZero kalau tidak pakai quadratic token
    await dao.deployed();
    console.log("DAO deployed at:", dao.address);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
