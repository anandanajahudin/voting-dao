import { ethers as hardhatEthers } from "hardhat";
import { AddressZero } from "@ethersproject/constants";

async function main() {
    const [deployer] = await hardhatEthers.getSigners();

    const Verifier = await hardhatEthers.getContractFactory("SemaphoreVerifier");
    const verifier = await Verifier.deploy();
    await verifier.deployed();

    const DAO = await hardhatEthers.getContractFactory("PrivacyVotingDAO");
    const dao = await DAO.deploy(verifier.address, 0n, AddressZero);
    await dao.deployed();

    console.log("DAO deployed at:", dao.address);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
