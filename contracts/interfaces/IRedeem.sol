// SPDX-License-Identifier: https://github.com/lendroidproject/protocol.2.0/blob/master/LICENSE.md
pragma solidity 0.7.5;


/**
 * @dev Required interface of a Redeem compliant contract.
 */
interface IRedeem {
    // admin
    function enableRedeem() external;
    // end user
    function redeem(uint256 token0Amount) external;
    function unlockVault(uint256[] calldata assetIds) external;
    // getters
    function redeemToken2Amount() external view returns (uint256);
    function token2AmountRedeemable(uint256 token0Amount) external view returns (uint256);
}
