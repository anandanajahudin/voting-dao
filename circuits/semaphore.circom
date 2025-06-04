template Semaphore() {
    signal input nullifier;
    signal input signalHash;
    signal input root;

    signal output out;

    out <== nullifier + signalHash + root;
}

component main = Semaphore();
