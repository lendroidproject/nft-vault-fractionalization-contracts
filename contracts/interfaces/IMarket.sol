// SPDX-License-Identifier: https://github.com/lendroidproject/protocol.2.0/blob/master/LICENSE.md
pragma solidity 0.7.5;


/**
 * @dev Required interface of a Market compliant contract.
 */
interface IMarket {
    // admin
    function createMarket(address token0Address, address token1Address,
        address payable fundsWalletAddress,
        uint256[5] memory uint256Values) external;

    function changeIndividualCap(uint256 individualCapAmount) external;
    function closeMarket() external;
    function withdrawToken1() external;
    // end user
    function pay(uint256 token1Amount) external;
    function withdrawToken0() external;
    // getters
    function token0() external view returns (address);
    function token1() external view returns (address);
    function fundsWallet() external view returns (address);
    function marketStart() external view returns (uint256);
    function marketEnd() external view returns (uint256);
    function individualCap() external view returns (uint256);
    function totalCap() external view returns (uint256);
    function token0PerToken1() external view returns (uint256);
    function marketClosed() external view returns (bool);
    function totaltoken1Paid() external view returns (uint256);
    function buyers(uint256 arrayIndex) external view returns (address);

    function payments(address contributorAddress) external view returns (uint256 token1Amount,
        bool token0Withdrawn);

    function totalBuyers() external view returns (uint256);
}
