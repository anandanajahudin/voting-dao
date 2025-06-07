pragma circom 2.1.5;

include "poseidon.circom";
include "comparators.circom"; // Diperlukan untuk LessThan

template Semaphore(merkleTreeDepth) {
    signal input secret;
    signal input merkleProofSiblings[merkleTreeDepth];
    signal input merkleProofIndices[merkleTreeDepth];
    signal input merkleProofLength; // <-- TAMBAHKAN KEMBALI BARIS INI
    signal input scope;
    signal input message;

    // Output signals
    signal output merkleTreeRoot;
    signal output nullifier;

    // --- Private key validation ---
    var l = 2736030358979909402780800718157159386076813972158567259200215660948447373041;
    component isSecretValid = LessThan(251);
    isSecretValid.in[0] <== secret;
    isSecretValid.in[1] <== l;
    isSecretValid.out === 1;

    // --- Identity & Nullifier generation ---
    component secretHasher = Poseidon(1);
    secretHasher.inputs[0] <== secret;

    component nullifierHasher = Poseidon(2);
    nullifierHasher.inputs[0] <== scope;
    nullifierHasher.inputs[1] <== secretHasher.out;
    nullifier <== nullifierHasher.out;

    // --- Merkle proof verification (Logic replaces binary-merkle-root.circom) ---
    component identityCommitmentHasher = Poseidon(1);
    identityCommitmentHasher.inputs[0] <== secretHasher.out;
    var identityCommitment = identityCommitmentHasher.out;

    component poseidon[merkleTreeDepth];
    signal currentLevelHashes[merkleTreeDepth];

    for (var i = 0; i < merkleTreeDepth; i++) {
        // Define the hash from the previous level for clarity.
        var previousHash = (i == 0) ? identityCommitment : currentLevelHashes[i-1];

        // This is the R1CS-compatible multiplexer logic:
        // out <== selector * (value_if_one - value_if_zero) + value_if_zero
        // Here, 'selector' is merkleProofIndices[i]

        // If index is 0, inputs are (previousHash, sibling).
        // If index is 1, inputs are (sibling, previousHash).

        var left  = merkleProofIndices[i] * (merkleProofSiblings[i] - previousHash) + previousHash;
        var right = merkleProofIndices[i] * (previousHash - merkleProofSiblings[i]) + merkleProofSiblings[i];

        poseidon[i] = Poseidon(2);
        poseidon[i].inputs[0] <== left;
        poseidon[i].inputs[1] <== right;

        currentLevelHashes[i] <== poseidon[i].out;
    }

    merkleTreeRoot <== currentLevelHashes[merkleTreeDepth-1];

    // --- Final validation ---
    signal s_squared;
    s_squared <== message * message;
}

component main {
    public [scope, message]
} = Semaphore(20);