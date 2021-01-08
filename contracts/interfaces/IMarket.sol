// SPDX-License-Identifier: https://github.com/lendroidproject/protocol.2.0/blob/master/LICENSE.md
pragma solidity 0.7.5;


/**
 * @dev Required interface of a Market compliant contract.
 */
interface IMarket {
    // admin
    function createMarket(address token0Address, address token1Address,
        address fundsWalletAddress, uint256[5] memory uint256Values) external;

    function changeIndividualCap(uint256 individualCapAmount) external;
    function closeMarket() external;
    function withdrawToken1() external;
    // end user
    function pay(uint256 token1Amount) external;
    function withdrawToken0() external;
    // getters
    function marketClosed() external view returns (bool);
    function totalBuyers() external view returns (uint256);
}
