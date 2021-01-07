// SPDX-License-Identifier: https://github.com/lendroidproject/protocol.2.0/blob/master/LICENSE.md
pragma solidity 0.7.5;
pragma abicoder v2;


/**
 * @dev Required interface of a Vault compliant contract.
 */
interface IVault {
    // admin
    function lockVault() external;

    function safeAddAsset(address[] calldata tokenAddresses, uint256[] calldata tokenIds,
        string[] calldata categories) external;

    function safeTransferAsset(uint256[] calldata assetIds,
            address[] calldata ownerAddresses) external;

    // getters
    function assets(uint256 arrayIndex) external view returns (string memory category,
        address tokenAddress, uint256 tokenId);

    function totalAssets() external view returns (uint256);
    function totalAssetSlots() external view returns (uint256);
}
