// SPDX-License-Identifier: https://github.com/lendroidproject/protocol.2.0/blob/master/LICENSE.md
pragma solidity 0.7.5;
pragma abicoder v2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721Holder.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/Address.sol";


/** @title SimpleVault
    @author Lendroid Foundation
    @notice Smart contract representing a NFT Vault
    @dev Audit certificate : Pending
*/
contract SimpleVault is Ownable, ERC721Holder {
    using SafeMath for uint256;
    using Address for address;

    struct Asset {
        string category;
        address tokenAddress;
        uint256 tokenId;
    }

    bool public locked;
    Asset[] public assets;
    uint256 public totalAssets;

    function lockVault() external onlyOwner {
        toggleLock(true);
    }

    function unlockVault() external onlyOwner {
        toggleLock(false);
    }

    /**
    * @notice Allows owner to add NFTs to the vault.
    * Eg, [0x67678.., 0x2178..., 0x67678], [3, 1321, 33], ["kitty", "land", "kitty"]
    */
    function safeAddAsset(address[] calldata tokenAddresses, uint256[] calldata tokenIds,
            string[] calldata categories) external onlyOwner {
        require(!locked, "{safeAddAsset} : locked");
        require(tokenAddresses.length > 0, "{safeAddAsset} : tokenAddresses cannot be empty");
        require(tokenAddresses.length == tokenIds.length,
            "{safeAddAsset} : tokenAddresses and tokenIds lengths are not equal");
        require(tokenAddresses.length == categories.length,
            "{safeAddAsset} : tokenAddresses and categories lengths are not equal");
        // validate inputs
        for (uint i = 0; i < tokenAddresses.length; i++) {
            require(tokenAddresses[i].isContract(), "{safeAddAsset} : invalid tokenAddress");
        }
        for (uint i = 0; i < tokenAddresses.length; i++) {
            totalAssets = totalAssets.add(1);
            // transfer the NFT
            IERC721(tokenAddresses[i]).safeTransferFrom(msg.sender, address(this), tokenIds[i]);
            // save asset to array
            assets.push(Asset({
                category: categories[i],
                tokenAddress: tokenAddresses[i],
                tokenId: tokenIds[i]
            }));
        }
    }

    /**
    * @notice Allows owner to transfer NFTs from the vault.
    * Eg, [3, 200, 54]
    */
    function safeTransferAsset(uint256[] calldata assetIds) external onlyOwner {
        require(!locked, "{safeTransferAsset} : locked");
        require(assetIds.length > 0, "{safeTransferAsset} : assetIds cannot be empty");
        // validate inputs
        for (uint i = 0; i < assetIds.length; i++) {
            require(assets.length > assetIds[i], "{safeTransferAsset} : 400, Invalid assetId");
            require(assets[assetIds[i]].tokenAddress != address(0),
                "{safeTransferAsset} : 404, asset does not exist");
        }
        for (uint i = 0; i < assetIds.length; i++) {
            totalAssets = totalAssets.sub(1);
            // transfer asset to new owner
            IERC721(assets[assetIds[i]].tokenAddress).safeTransferFrom(address(this),
                owner(), assets[assetIds[i]].tokenId);
            // remove asset but preserve array length
            delete assets[assetIds[i]];
        }
    }

    function totalAssetSlots() external view returns (uint256) {
        return assets.length;
    }

    function toggleLock(bool value) internal {
        require(locked == !value, "{toggleLock} : incorrect value");
        locked = value;
    }
}
