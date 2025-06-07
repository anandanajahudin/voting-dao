// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// Library Pairing berisi semua tipe data dan fungsi mock
library Pairing {
    struct G1Point {
        uint256 x;
        uint256 y;
    }

    struct G2Point {
        uint256[2] x;
        uint256[2] y;
    }

    // Struct Proof dan VerifyingKey berada di sini
    struct Proof {
        G1Point a;
        G2Point b;
        G1Point c;
    }

    struct VerifyingKey {
        G1Point a;
        G2Point b;
        G2Point g;
        G2Point d;
        G1Point[] ic;
    }

    function verify(
        Proof memory,
        uint256[] memory,
        VerifyingKey memory
    ) internal pure returns (bool) {
        return true;
    }
}

contract SemaphoreVerifier {
    using Pairing for *;

    /// @dev The verifier function for Semaphore proofs (Groth16).
    /// @param proof The Semaphore proof formatted for Groth16.
    /// @param publicSignals The public signals of the proof.
    /// @return True if the proof is valid, false otherwise.
    function verifyProof(
        uint256[8] calldata proof,         // <-- Nama ditambahkan kembali
        uint256[4] calldata publicSignals // <-- Nama ditambahkan kembali
    ) public pure returns (bool) {
        // Ini adalah mock verifier yang selalu mengembalikan true.
        // Cukup untuk membuat tes Anda berjalan.
        // JANGAN GUNAKAN DI PRODUCTION.
        (proof, publicSignals); // Menghilangkan warning "unused variable"
        return true;
    }
}