// SPDX-License-Identifier: https://github.com/lendroidproject/protocol.2.0/blob/master/LICENSE.md
pragma solidity 0.7.5;

import "./LibERC20.sol";
import "./LibDiamond.sol";
import "../interfaces/IToken0.sol";

/* solhint-disable */

enum AppMode { BOOTSTRAPPED, VAULT_LOCKED, TOKEN0_CREATED, MARKET_CREATED, BUYOUT_ENABLED, REDEEM_ENABLED }

enum MarketStatus { OPEN, CLOSED }

enum BuyoutStatus { CONFIGURED, ACTIVE, REVOKED, ENDED }

struct Payment {
    uint256 token1Amount;
    bool token0Withdrawn;
}

struct BidDeposit {
    uint256 token0Amount;
    uint256 token2Amount;
}

struct PendingBidWithdrawal {
    uint256 token0Amount;
    uint256 token2Amount;
}

struct Asset {
    string category;
    address tokenAddress;
    uint256 tokenId;
}

struct BuyoutStopStake {
    uint256 token0Amount;
}

struct AppStorage {
    address treasury;
    AppMode mode;
    // Vault
    Asset[] assets;
    uint256 totalAssets;
    // Token0
    IToken0 token0;
    // Market
    MarketStatus marketStatus;
    //// admin
    IERC20 token1;
    uint256 marketStart;
    uint256 marketEnd;
    address payable fundsWallet;// address where funds are collected
    uint256 totalCap;// total payment cap
    uint256 individualCap;// individual payment cap
    uint256 totaltoken1Paid;
    bool token1Withdrawn;
    uint256 token0PerToken1;// token0 distributed per token1 paid
    //// end user
    address[] buyers;
    mapping (address => Payment) payments;
    // Buyout
    BuyoutStatus buyoutStatus;
    //// admin
    IERC20 token2;
    uint256 buyoutThreshold;
    uint256 buyoutDuration;
    uint256 buyoutStart;
    //// governance
    uint256 buyoutStopThreshold;
    uint256 totalToken0Staked;
    mapping (address => BuyoutStopStake) buyoutStopStakes;
    //// end user
    address highestBidder;
    uint256 highestBid;
    mapping (address => BidDeposit) bidDeposits;
    mapping (address => PendingBidWithdrawal) pendingBidWithdrawals;
    // Redeem
    uint256 redeemToken2Amount;
}
/* solhint-enable */

library LibAppStorage {

    function diamondStorage() internal pure returns (AppStorage storage ds) {
        assembly {// solhint-disable-line no-inline-assembly
            ds.slot := 0
        }
    }

}


contract LibAppStorageModifiers {
    AppStorage internal app;

    modifier onlyOwner {
        require(msg.sender == LibDiamond.contractOwner() || msg.sender == address(this), "LibAppStorage: 403");
        _;
    }

    function isCallerOwner() internal view returns (bool) {
        return msg.sender == LibDiamond.contractOwner() || msg.sender == address(this);
    }
}
