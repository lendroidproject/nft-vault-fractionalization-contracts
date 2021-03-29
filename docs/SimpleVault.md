## `SimpleVault`






### `lockVault()` (external)





### `unlockVault()` (external)





### `safeAddAsset(address[] tokenAddresses, uint256[] tokenIds, string[] categories)` (external)

Allows owner to add NFTs to the vault.
Eg, [0x67678.., 0x2178..., 0x67678], [3, 1321, 33], ["kitty", "land", "kitty"]



### `safeTransferAsset(uint256[] assetIds)` (external)

Allows owner to transfer NFTs from the vault.
Eg, [3, 200, 54]



### `escapeHatchERC721(address tokenAddress, uint256 tokenId)` (external)





### `setDecentralandOperator(address registryAddress, address operatorAddress, uint256 assetId)` (external)





### `totalAssetSlots() → uint256` (external)





### `transferOwnership(address newOwner)` (public)



Transfers ownership of the contract to a new account (`newOwner`).
Can only be called by the current owner.

### `onERC721Received(address, uint256, bytes) → bytes4` (public)





### `toggleLock(bool value)` (internal)






