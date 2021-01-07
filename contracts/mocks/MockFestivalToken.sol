// SPDX-License-Identifier: https://github.com/lendroidproject/protocol.2.0/blob/master/LICENSE.md
pragma solidity 0.7.5;


import "../Token0.sol";


contract MockKey is Token0 {
    // solhint-disable-next-line func-visibility
    constructor () Token0(10000000 * 1e18, "Purple 20", "P20") {}// solhint-disable-line no-empty-blocks
}
