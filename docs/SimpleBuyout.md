## `SimpleBuyout`






### `constructor(address token0Address, address token2Address, address vaultAddress, uint256[4] uint256Values)` (public)





### `togglePause(bool pause)` (external)





### `transferVaultOwnership(address newOwner)` (external)





### `placeBid(uint256 totalBidAmount, uint256 token2Amount)` (external)





### `veto(uint256 token0Amount)` (external)





### `extendVeto()` (external)





### `withdrawStakedToken0(uint256 token0Amount)` (external)





### `endBuyout()` (external)





### `withdrawBid()` (external)





### `redeem(uint256 token0Amount)` (external)





### `token2AmountRedeemable(uint256 token0Amount) → uint256` (public)





### `requiredToken0ToBid(uint256 totalBidAmount, uint256 token2Amount) → uint256` (public)





### `_resetHighestBidDetails()` (internal)





### `_veto(address sender, uint256 token0Amount)` (internal)






### `HighestBidIncreased(address bidder, uint256 amount)`





### `BuyoutStarted(address bidder, uint256 amount)`





### `BuyoutRevoked(uint256 amount)`





### `BuyoutEnded(address bidder, uint256 amount)`





