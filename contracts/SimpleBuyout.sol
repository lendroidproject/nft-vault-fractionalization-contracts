// SPDX-License-Identifier: https://github.com/lendroidproject/protocol.2.0/blob/master/LICENSE.md
pragma solidity 0.7.5;
pragma abicoder v2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./heartbeat/Pacemaker.sol";
import "./IToken0.sol";
import "./IVault.sol";


/** @title SimpleBuyout
    @author Lendroid Foundation
    @notice Smart contract representing a NFT bundle buyout
    @dev Audit certificate : Pending
*/
contract SimpleBuyout is Ownable, Pacemaker, Pausable {
    using SafeERC20 for IERC20;
    using SafeERC20 for IToken0;
    using SafeMath for uint256;
    using Address for address;

    enum BuyoutStatus { ENABLED, ACTIVE, REVOKED, ENDED }

    BuyoutStatus public status;
    IToken0 public token0;
    //// admin
    IERC20 public token2;
    uint256 public startThreshold;
    uint256[4] public epochs;// [startEpoch, endEpoch, durationInEpochs, bidIntervalInEpochs]
    //// vault
    IVault public vault;
    //// governance
    uint256 public stopThresholdPercent;
    uint256 public currentBidToken0Staked;
    mapping (address => uint256) public token0Staked;
    //// end user
    address public highestBidder;
    uint256[3] public highestBidValues;// [highestBid, highestToken0Bid, highestToken2Bid]
    //// bid and veto count
    uint256 public currentBidId;
    mapping (address => uint256) public lastVetoedBidId;
    //// redeem
    uint256 public redeemToken2Amount;
    //// prevent flash loan attacks on veto/withdrawVeto logic
    mapping (address => uint256) public lastVetoedBlockNumber;

    uint256 constant public MINIMUM_BID_PERCENTAGE_INCREASE_ON_VETO = 108;
    uint256 constant public MINIMUM_BID_TOKEN0_PERCENTAGE_REQUIRED = 5;

    // Events that will be emitted on changes.
    event HighestBidIncreased(address bidder, uint256 amount);
    event BuyoutStarted(address bidder, uint256 amount);
    event BuyoutRevoked(uint256 amount);
    event BuyoutEnded(address bidder, uint256 amount);

    // solhint-disable-next-line func-visibility
    constructor(address token0Address, address token2Address, address vaultAddress, uint256[4] memory uint256Values) {
        // input validations
        require(token0Address.isContract(), "{enableBuyout} : invalid token0Address");
        require(token2Address.isContract(), "{enableBuyout} : invalid token2Address");
        require(vaultAddress.isContract(), "{enableBuyout} : invalid vaultAddress");
        require(uint256Values[0] > 0, "{enableBuyout} : startThreshold cannot be zero");
        require(uint256Values[1] > 0, "{enableBuyout} : durationInEpochs cannot be zero");
        // uint256Values[2], aka, bidIntervalInEpochs can be zero, so no checks required.
        require(uint256Values[3] > 0 && uint256Values[3] <= 100,
            "{enableBuyout} : stopThresholdPercent should be between 1 and 100");
        // set values
        token0 = IToken0(token0Address);
        token2 = IERC20(token2Address);
        vault = IVault(vaultAddress);
        startThreshold = uint256Values[0];
        epochs[2] = uint256Values[1];
        epochs[3] = uint256Values[2];
        stopThresholdPercent = uint256Values[3];
        status = BuyoutStatus.ENABLED;
    }

    function togglePause(bool pause) external onlyOwner {
        if (pause) {
            _pause();
        } else {
            _unpause();
        }
    }

    /**
    * @notice Safety function to handle accidental token transfer to the contract
    */
    function escapeHatchERC20(address tokenAddress) external onlyOwner {
        IERC20 token = IERC20(tokenAddress);
        token.safeTransfer(owner(), token.balanceOf(address(this)));
    }

    function transferVaultOwnership(address newOwner) external onlyOwner whenPaused {
        require(newOwner != address(0), "{transferVaultOwnership} : invalid newOwner");
        // transfer ownership of Vault to newOwner
        vault.transferOwnership(newOwner);
    }

    function placeBid(uint256 totalBidAmount, uint256 token2Amount) external whenNotPaused {
        // verify buyout has not ended
        require(status != BuyoutStatus.ENDED, "{placeBid} : buyout has ended");
        // verify token0 and token2 amounts are sufficient to place bid
        require(totalBidAmount > startThreshold, "{placeBid} : totalBidAmount does not meet minimum threshold");
        require(token2.balanceOf(msg.sender) >= token2Amount, "{placeBid} : insufficient token2 balance");
        require(totalBidAmount > highestBidValues[0], "{placeBid} : there already is a higher bid");
        uint256 token0Amount = requiredToken0ToBid(totalBidAmount, token2Amount);
        require(token0.balanceOf(msg.sender) >= token0Amount, "{placeBid} : insufficient token0 balance");
        require(token0Amount >= token0.totalSupply().mul(MINIMUM_BID_TOKEN0_PERCENTAGE_REQUIRED).div(100),
            "{placeBid} : token0Amount should be at least 5% of token0 totalSupply");
        // check Vault ownership
        require(vault.vaultOwner() == address(this), "{placeBid} : failed vault-ownership verification");
        // increment bid number and reset veto count
        currentBidId = currentBidId.add(1);
        currentBidToken0Staked = 0;
        // update endEpoch
        if (status == BuyoutStatus.ACTIVE) {
            // already active
            require(currentEpoch() <= epochs[1], "{placeBid} : buyout end epoch has been surpassed");
            epochs[1] = currentEpoch().add(epochs[3]);
        } else {
            // activate buyout process if applicable
            status = BuyoutStatus.ACTIVE;
            epochs[1] = currentEpoch().add(epochs[2]);
        }
        // set startEpoch
        epochs[0] = currentEpoch();
        // return highest bid to previous bidder
        if (highestBidValues[1] > 0) {
            token0.safeTransfer(highestBidder, highestBidValues[1]);
        }
        if (highestBidValues[2] > 0) {
            token2.safeTransfer(highestBidder, highestBidValues[2]);
        }
        // set sender as highestBidder and totalBidAmount as highestBidValues[0]
        highestBidder = msg.sender;
        highestBidValues[0] = totalBidAmount;
        highestBidValues[1] = token0Amount;
        highestBidValues[2] = token2Amount;
        // transfer token0 and token2 to this contract
        token0.safeTransferFrom(msg.sender, address(this), token0Amount);
        token2.safeTransferFrom(msg.sender, address(this), token2Amount);
        // send notification
        emit HighestBidIncreased(msg.sender, totalBidAmount);
    }

    function veto(uint256 token0Amount) external whenNotPaused {
        require(token0Amount > 0, "{veto} : token0Amount cannot be zero");
        token0Staked[msg.sender] = token0Staked[msg.sender].add(token0Amount);
        uint256 vetoAmount = lastVetoedBidId[msg.sender] == currentBidId ? token0Amount : token0Staked[msg.sender];
        _veto(msg.sender, vetoAmount);
        token0.safeTransferFrom(msg.sender, address(this), token0Amount);
    }

    function extendVeto() external whenNotPaused {
        uint256 token0Amount = token0Staked[msg.sender];
        require(token0Amount > 0, "{extendVeto} : no staked token0Amount");
        require(lastVetoedBidId[msg.sender] != currentBidId, "{extendVeto} : already vetoed");
        _veto(msg.sender, token0Amount);
    }

    function withdrawStakedToken0(uint256 token0Amount) external {
        require(lastVetoedBlockNumber[msg.sender] < block.number, "{withdrawStakedToken0} : Flash attack!");
        require(token0Amount > 0, "{withdrawStakedToken0} : token0Amount cannot be zero");
        require(token0Staked[msg.sender] >= token0Amount,
            "{withdrawStakedToken0} : token0Amount cannot exceed staked amount");
        // ensure Token0 cannot be unstaked if users veto on current bid has not expired
        if ((status == BuyoutStatus.ACTIVE) && (currentEpoch() <= epochs[1])) {
            // already active
            require(lastVetoedBidId[msg.sender] != currentBidId,
                "{withdrawStakedToken0} : cannot unstake until veto on current bid expires");
        }
        token0Staked[msg.sender] = token0Staked[msg.sender].sub(token0Amount);
        token0.safeTransfer(msg.sender, token0Amount);
    }

    function endBuyout() external whenNotPaused {
        // solhint-disable-next-line not-rely-on-time
        require(currentEpoch() > epochs[1], "{endBuyout} : end epoch has not yet been reached");
        require(status != BuyoutStatus.ENDED, "{endBuyout} : buyout has already ended");
        require(highestBidder != address(0), "{endBuyout} : buyout does not have highestBidder");
        // additional safety checks
        require(((highestBidValues[1] > 0) || (highestBidValues[2] > 0)),
            "{endBuyout} : highestBidder deposits cannot be 0");
        // set status
        status = BuyoutStatus.ENDED;
        redeemToken2Amount = highestBidValues[2];
        highestBidValues[2] = 0;
        // burn token0Amount
        if (highestBidValues[1] > 0) {
            token0.burn(highestBidValues[1]);
        }
        // transfer ownership of Vault to highestBidder
        vault.transferOwnership(highestBidder);

        emit BuyoutEnded(highestBidder, highestBidValues[0]);
    }

    function withdrawBid() external whenPaused {
        require(highestBidder == msg.sender, "{withdrawBid} : sender is not highestBidder");
        _resetHighestBidDetails();

    }

    function redeem(uint256 token0Amount) external {
        require(status == BuyoutStatus.ENDED, "{redeem} : redeem has not yet been enabled");
        require(token0.balanceOf(msg.sender) >= token0Amount, "{redeem} : insufficient token0 amount");
        require(token0Amount > 0, "{redeem} : token0 amount cannot be zero");
        uint256 token2Amount = token2AmountRedeemable(token0Amount);
        redeemToken2Amount = redeemToken2Amount.sub(token2Amount);
        // burn token0Amount
        token0.burnFrom(msg.sender, token0Amount);
        // send token2Amount
        token2.safeTransfer(msg.sender, token2Amount);
    }

    function token2AmountRedeemable(uint256 token0Amount) public view returns (uint256) {
        return token0Amount.mul(redeemToken2Amount).div(token0.totalSupply());
    }

    function requiredToken0ToBid(uint256 totalBidAmount, uint256 token2Amount) public view returns (uint256) {
        uint256 token0Supply = token0.totalSupply();
        require(token2Amount <= totalBidAmount, "{requiredToken0ToBid} : token2Amount cannot exceed totalBidAmount");
        // token2Amount = threshold * ( (totalToken0Supply - token0Amount) / totalToken0Supply )
        return token0Supply
            .mul(
                totalBidAmount
                .sub(token2Amount)
            ).div(totalBidAmount);
    }

    function _resetHighestBidDetails() internal {
        uint256 token0Amount = highestBidValues[1];
        uint256 token2Amount = highestBidValues[2];
        if (token0Amount > 0) {
            token0.safeTransfer(highestBidder, token0Amount);
        }
        if (token2Amount > 0) {
            token2.safeTransfer(highestBidder, token2Amount);
        }
        // reset highestBidder
        highestBidder = address(0);
        // reset highestBidValues
        highestBidValues[0] = 0;
        highestBidValues[1] = 0;
        highestBidValues[2] = 0;
    }

    function _veto(address sender, uint256 token0Amount) internal {
        // verify buyout has not ended
        require((
            (status == BuyoutStatus.ACTIVE) && (currentEpoch() >= epochs[0]) && (currentEpoch() <= epochs[1])
        ), "{_veto} : buyout is not active");
        lastVetoedBlockNumber[sender] = block.number;
        lastVetoedBidId[sender] = currentBidId;
        uint256 updatedCurrentBidToken0Staked = currentBidToken0Staked.add(token0Amount);
        if (updatedCurrentBidToken0Staked < stopThresholdPercent.mul(token0.totalSupply().div(100))) {
            currentBidToken0Staked = updatedCurrentBidToken0Staked;
        } else {
            currentBidToken0Staked = 0;
            // increase startThreshold by 8% of last bid
            startThreshold = highestBidValues[0].mul(MINIMUM_BID_PERCENTAGE_INCREASE_ON_VETO).div(100);
            // reset endEpoch
            epochs[1] = 0;
            // set status
            status = BuyoutStatus.REVOKED;
            _resetHighestBidDetails();
            emit BuyoutRevoked(updatedCurrentBidToken0Staked);
        }
    }

}
