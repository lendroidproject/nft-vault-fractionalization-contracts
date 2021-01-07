// SPDX-License-Identifier: https://github.com/lendroidproject/protocol.2.0/blob/master/LICENSE.md
pragma solidity 0.7.5;
pragma abicoder v2;

import "../libraries/LibAppStorage.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721Holder.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "../interfaces/IVault.sol";


/** @title VaultFacet
    @author Lendroid Foundation
    @notice Smart contract representing a NFT Vault
    @dev Audit certificate : Pending
*/
contract VaultFacet is LibAppStorageModifiers, IVault, ERC721Holder {
    using SafeMath for uint256;
    using Address for address;

    function lockVault() external override onlyOwner {
        require(app.mode == AppMode.BOOTSTRAPPED, "{lockVault} : app mode is not BOOTSTRAPPED");
        app.mode = AppMode.VAULT_LOCKED;
    }

    /**
    * @notice Allows owner to add NFTs to the vault.
    * Eg, [0x67678.., 0x2178..., 0x67678], [3, 1321, 33], ["kitty", "land", "kitty"]
    */
    function safeAddAsset(address[] calldata tokenAddresses, uint256[] calldata tokenIds,
            string[] calldata categories) external override onlyOwner {
        require(app.mode == AppMode.BOOTSTRAPPED, "{safeAddAsset} : app mode is not BOOTSTRAPPED");
        require(tokenAddresses.length > 0, "tokenAddresses cannot be empty");
        require(tokenAddresses.length == tokenIds.length, "tokenAddresses and tokenIds lengths are not equal");
        require(tokenAddresses.length == categories.length, "tokenAddresses and categories lengths are not equal");
        // validate inputs
        for (uint i = 0; i < tokenAddresses.length; i++) {
            require(tokenAddresses[i].isContract(), "invalid tokenAddress");
        }
        for (uint i = 0; i < tokenAddresses.length; i++) {
            app.totalAssets = app.totalAssets.add(1);
            // transfer the NFT
            IERC721(tokenAddresses[i]).safeTransferFrom(msg.sender, address(this), tokenIds[i]);
            // save asset to array
            app.assets.push(Asset({
                category: categories[i],
                tokenAddress: tokenAddresses[i],
                tokenId: tokenIds[i]
            }));
        }
    }

    /**
    * @notice Allows owner to transfer NFTs from the vault.
    * Eg, [3, 200, 54], [0xab43..., 0xdC31..., 0xA54b...]
    */
    function safeTransferAsset(uint256[] calldata assetIds,
            address[] calldata newOwnerAddresses) external override {
        require(
            (app.mode == AppMode.BOOTSTRAPPED && isCallerOwner()) ||
            (app.mode == AppMode.BUYOUT_ENABLED && app.buyoutStatus == BuyoutStatus.ENDED),
            "{safeTransferAsset} : app mode is not BOOTSTRAPPED or BUYOUT_ENABLED_ENDED"
        );
        require(assetIds.length > 0, "assetIds cannot be empty");
        require(assetIds.length == newOwnerAddresses.length,
            "assetIds and newOwnerAddresses lengths are not equal");
        // validate inputs
        for (uint i = 0; i < assetIds.length; i++) {
            require(newOwnerAddresses[i] != address(0), "invalid newOwnerAddress");
            require(app.assets.length > assetIds[i], "400 : Invalid assetId");
            require(app.assets[assetIds[i]].tokenAddress != address(0), "404 : asset does not exist");
        }
        for (uint i = 0; i < assetIds.length; i++) {
            app.totalAssets = app.totalAssets.sub(1);
            // transfer asset to new owner
            IERC721(app.assets[assetIds[i]].tokenAddress).safeTransferFrom(address(this),
                newOwnerAddresses[i], app.assets[assetIds[i]].tokenId);
            // remove asset but preserve array length
            delete app.assets[assetIds[i]];
        }
    }

    function assets(uint256 arrayIndex) external view override returns (string memory category,
        address tokenAddress, uint256 tokenId) {
        category = app.assets[arrayIndex].category;
        tokenAddress = app.assets[arrayIndex].tokenAddress;
        tokenId = app.assets[arrayIndex].tokenId;
    }

    function totalAssets() external view override returns (uint256) {
        return app.totalAssets;
    }

    function totalAssetSlots() external view override returns (uint256) {
        return app.assets.length;
    }

}
