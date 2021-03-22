module.exports = {
    norpc: true,
    mocha: {
        enableTimeouts: false,
        fgrep: '[skip-on-coverage]',
        invert: true,
    },
    skipFiles: [
        'mocks',
        'heartbeat/Pacemaker.sol'
    ]
};
