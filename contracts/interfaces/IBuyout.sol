// SPDX-License-Identifier: https://github.com/lendroidproject/protocol.2.0/blob/master/LICENSE.md
pragma solidity 0.7.5;


/**
 * @dev Required interface of a Buyout compliant contract.
 */
interface IBuyout {
    // admin
    function enableBuyout(address token0Address, address token2Address, uint256[3] memory uint256Values) external;
    function endBuyout() external;
    // end user
    function placeBid(uint256 totalBidAmount, uint256 token2Amount) external;
    function withdrawBid() external;
    function stakeToken0ToStopBuyout(uint256 token0Amount) external;
    function withdrawStakedToken0() external;
    // getters
    function buyoutEnd() external view returns (uint256);
    function requiredToken0ToBid(uint256 token2Amount) external view returns (uint256);
}
