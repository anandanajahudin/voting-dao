import { ethers } from "hardhat";
    async function main() {
    const daoAddr = process.env.DAO!;
    const newRoot = BigInt(process.env.ROOT!);
    const dao = await ethers.getContractAt("PrivacyVotingDAOv2", daoAddr);
    await (await dao.updateMemberRoot(newRoot)).wait();
    
    console.log("root updated");
}
main();