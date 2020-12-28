// SPDX-License-Identifier: https://github.com/lendroidproject/protocol.2.0/blob/master/LICENSE.md
pragma solidity 0.7.5;


import "../nftshards/Festival.sol";


contract MockFestival is Festival {
    // solhint-disable-next-line func-visibility
    constructor (address shardTokenAddress, address payable fundsWalletAddress) Festival(
        shardTokenAddress, fundsWalletAddress,
        1613260800,// feb 14, 12am GMT
        1614556800,// mar 1, 12am GMT
        2 * 1e18,// 2 ETH
        1500 * 1e18,// 1500 ETH
        0.00041 * 1e18// 0.00041 ETH
    ) {}// solhint-disable-line no-empty-blocks
}
