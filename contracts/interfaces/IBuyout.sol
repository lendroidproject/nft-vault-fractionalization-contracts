// SPDX-License-Identifier: https://github.com/lendroidproject/protocol.2.0/blob/master/LICENSE.md
pragma solidity 0.7.5;


/**
 * @dev Required interface of a Buyout compliant contract.
 */
interface IBuyout {
    // admin
    function enableBuyout(address token2Address, uint256[3] memory uint256Values) external;
    function endBuyout() external;
    // end user
    function placeBid(uint256 totalBidAmount, uint256 token2Amount) external;
    function withdrawBid() external;
    function stakeToken0ToStopBuyout(uint256 token0Amount) external;
    function withdrawStakedToken0() external;
    // getters
    function token2() external view returns (address);
    function buyoutThreshold() external view returns (uint256);
    function buyoutDuration() external view returns (uint256);
    function buyoutStart() external view returns (uint256);
    function buyoutStopThreshold() external view returns (uint256);
    function totalToken0Staked() external view returns (uint256);
    function buyoutStopStakes(address staker) external view returns (uint256 token0Amount);
    function highestBidder() external view returns (address);
    function highestBid() external view returns (uint256);
    function bidDeposits(address bidder) external view returns (uint256 token0Amount, uint256 token2Amount);

    function pendingBidWithdrawals(address bidder) external view returns (uint256 token0Amount,
            uint256 token2Amount);

    function buyoutEnd() external view returns (uint256);
    function requiredToken0ToBid(uint256 token2Amount) external view returns (uint256);
}
