// SPDX-License-Identifier: https://github.com/lendroidproject/protocol.2.0/blob/master/LICENSE.md
pragma solidity 0.7.5;
pragma abicoder v2;


/**
 * @dev Required interface of a Vault compliant contract.
 */
interface IVault {

    function lockVault() external;

    function unlockVault() external;

    function safeAddAsset(address[] calldata tokenAddresses, uint256[] calldata tokenIds,
            string[] calldata categories) external;

    function safeTransferAsset(uint256[] calldata assetIds) external;

    function escapeHatchERC721(address tokenAddress, uint256 tokenId) external;

    function setDecentralandOperator(address registryAddress, address operatorAddress,
        uint256 assetId) external;

    function transferOwnership(address newOwner) external;

    function totalAssetSlots() external view returns (uint256);

    function vaultOwner() external view returns (address);

    function onERC721Received(address, uint256, bytes memory) external pure returns (bytes4);

}
