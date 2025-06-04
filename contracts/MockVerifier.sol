// SPDX-License-Identifier: Public Domain
pragma solidity ^0.8.24;
contract MockVerifier {
    function verifyProof(
        uint256,
        uint256,
        uint256,
        uint256[8] calldata
    ) external pure returns (bool) {
        return true; // always true – replace in prod
    }
}
