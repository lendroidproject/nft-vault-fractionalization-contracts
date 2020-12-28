// SPDX-License-Identifier: https://github.com/lendroidproject/protocol.2.0/blob/master/LICENSE.md
pragma solidity 0.7.5;


import "../nftshards/FestivalToken.sol";


contract MockFestivalToken is FestivalToken {
    // solhint-disable-next-line func-visibility
    constructor () FestivalToken(10000000 * 1e18, "Beeple 20", "B20") {}// solhint-disable-line no-empty-blocks
}
