// SPDX-License-Identifier: Public Domain
pragma solidity ^0.8.24;
/// @title SemaphoreVerifier (Groth16)
/// @notice Actual verifier contract **must** be generated with snarkjs:
/// snarkjs zkey export solidity Verifier_Groth16.sol verifier.zkey
/// Copy the generated file into contracts/ and import below.

import "./Verifier_Groth16.sol"; // auto-generated – contains verifyProof()

contract SemaphoreVerifier is Verifier_Groth16 {
    // Nothing to add – inherits the `verifyProof` signature required by DAO.
}
