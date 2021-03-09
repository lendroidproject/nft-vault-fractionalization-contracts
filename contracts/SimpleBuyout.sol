// SPDX-License-Identifier: https://github.com/lendroidproject/protocol.2.0/blob/master/LICENSE.md
pragma solidity 0.7.5;
pragma abicoder v2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "./heartbeat/Pacemaker.sol";
import "./SimpleRedeem.sol";
import "./IRedeem.sol";
import "./IToken0.sol";
import "./IVault.sol";


/** @title SimpleBuyout
    @author Lendroid Foundation
    @notice Smart contract representing a NFT bundle buyout
    @dev Audit certificate : Pending
*/
contract SimpleBuyout is Ownable, Pacemaker {
    using SafeERC20 for IERC20;
    using SafeERC20 for IToken0;
    using SafeMath for uint256;
    using Address for address;

    enum BuyoutStatus { CREATED, ENABLED, ACTIVE, REVOKED, ENDED }

    BuyoutStatus public status;
    IToken0 public token0;
    //// admin
    IERC20 public token2;
    uint256 public startThreshold;
    uint256[4] public epochs;// [startEpoch, endEpoch, durationInEpochs, bidIntervalInEpochs]
    //// vault
    IVault public vault;
    //// redeem
    IRedeem public redemption;
    //// governance
    uint256 public stopThresholdPercent;
    uint256 public totalToken0Staked;
    mapping (address => uint256) public token0Staked;
    //// end user
    address public highestBidder;
    uint256[3] public highestBidValues;// [highestBid, highestToken0Bid, highestToken2Bid]

    // Events that will be emitted on changes.
    event HighestBidIncreased(address bidder, uint256 amount);
    event BuyoutStarted(address bidder, uint256 amount);
    event BuyoutRevoked(uint256 amount);
    event BuyoutEnded(address bidder, uint256 amount);

    function enableBuyout(address token0Address, address token2Address, address vaultAddress,
        uint256[4] memory uint256Values) external onlyOwner {
        require(status == BuyoutStatus.CREATED, "{enableBuyout} : buyout has already been enabled");
        // input validations
        require(token0Address.isContract(), "{enableBuyout} : invalid token0Address");
        require(token2Address.isContract(), "{enableBuyout} : invalid token2Address");
        require(vaultAddress.isContract(), "{enableBuyout} : invalid vaultAddress");
        require(uint256Values[0] > 0, "{enableBuyout} : startThreshold cannot be zero");
        require(uint256Values[1] > 0, "{enableBuyout} : durationInEpochs cannot be zero");
        // uint256Values[1], aka, bidIntervalInEpochs can be zero, so no checks required.
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

    function placeBid(uint256 totalBidAmount, uint256 token2Amount) external {
        // verify buyout has not ended
        require(status != BuyoutStatus.ENDED, "{placeBid} : buyout has ended");
        // verify token0 and token2 amounts are sufficient to place bid
        require(totalBidAmount > startThreshold, "{placeBid} : totalBidAmount does not meet minimum threshold");
        require(totalBidAmount > highestBidValues[0], "{placeBid} : there already is a higher bid");
        require(token2.balanceOf(msg.sender) >= token2Amount, "insufficient token2 balance");
        uint256 token0Amount = requiredToken0ToBid(totalBidAmount, token2Amount);
        require(token0.balanceOf(msg.sender) >= token0Amount, "insufficient token0 balance");
        // update epochs
        if (status == BuyoutStatus.ACTIVE) {
            require(currentEpoch() <= epochs[1], "{placeBid} : buyout has ended");
            epochs[1] = currentEpoch().add(epochs[3]);
        }
        // activate buyout process if applicable
        if ((status == BuyoutStatus.ENABLED) || (status == BuyoutStatus.REVOKED)) {
            _activateBuyout();
            epochs[1] = currentEpoch().add(epochs[2]);
        }
        // set startEpoch
        epochs[0] = currentEpoch();
        // return highest bid to previous bidder
        if (highestBidValues[0] > 0) {
            if (highestBidValues[1] > 0) {
                token0.safeTransfer(highestBidder, highestBidValues[1]);
            }
            if (highestBidValues[2] > 0) {
                token2.safeTransfer(highestBidder, highestBidValues[2]);
            }
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

    function stakeToken0ToStopBuyout(uint256 token0Amount) external {
        // verify buyout has not ended
        require((
            (status == BuyoutStatus.ACTIVE) && (currentEpoch() >= epochs[0]) && (currentEpoch() <= epochs[1])
        ), "{stakeToken0ToStopBuyout} : Buyout is not active");
        uint256 updatedTotalToken0Staked = totalToken0Staked.add(token0Amount);
        if (updatedTotalToken0Staked < stopThresholdPercent.mul(token0.totalSupply().div(100))) {
            totalToken0Staked = updatedTotalToken0Staked;
        } else {
            totalToken0Staked = 0;
            // reset bid parameters
            if (highestBidValues[1] > 0) {
                token0.safeTransfer(highestBidder, highestBidValues[1]);
            }
            if (highestBidValues[2] > 0) {
                token2.safeTransfer(highestBidder, highestBidValues[2]);
            }
            // reset highestBidder
            highestBidder = address(0);
            // reset highestBidValues
            highestBidValues[0] = 0;
            highestBidValues[1] = 0;
            highestBidValues[2] = 0;
            // reset endEpoch
            epochs[1] = 0;
            // set status
            status = BuyoutStatus.REVOKED;
            // increase startThreshold by 8%
            startThreshold = startThreshold.mul(108).div(100);
            emit BuyoutRevoked(updatedTotalToken0Staked);
        }
        token0Staked[msg.sender] = token0Staked[msg.sender].add(token0Amount);
        token0.safeTransferFrom(msg.sender, address(this), token0Amount);
    }

    function withdrawStakedToken0() external {
        uint256 token0Amount = token0Staked[msg.sender];
        require(token0Amount > 0, "{withdrawStakedToken0} : no staked token0Amount");
        token0Staked[msg.sender] = 0;
        token0.safeTransfer(msg.sender, token0Amount);
    }

    function endBuyout() external {
        // solhint-disable-next-line not-rely-on-time
        require(currentEpoch() > epochs[1], "{endBuyout} : end epoch has not yet been reached");
        require(status != BuyoutStatus.ENDED, "{endBuyout} : buyout has already ended");
        require(highestBidder != address(0), "{endBuyout} : buyout does not have highestBidder");
        // additional safety checks
        require(((highestBidValues[1] > 0) || (highestBidValues[2] > 0)),
            "{endBuyout} : highestBidder deposits cannot be 0");
        // set status
        status = BuyoutStatus.ENDED;
        // deploy SimpleRedeem contract
        bytes memory bytecode = type(SimpleRedeem).creationCode;
        bytes32 salt = keccak256(abi.encodePacked(address(this), owner(),
            block.timestamp));// solhint-disable-line not-rely-on-time
        address redeemAddress;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            redeemAddress := create2(0, add(bytecode, 32), mload(bytecode), salt)
        }
        redemption = IRedeem(redeemAddress);
        redemption.enableRedeem(address(token0), address(token2), highestBidValues[2]);
        // burn token0Amount
        if (highestBidValues[1] > 0) {
            token0.burn(highestBidValues[1]);
        }
        // send token2Amount to redeem contract
        if (highestBidValues[2] > 0) {
            token2.safeTransfer(redeemAddress, highestBidValues[2]);
        }
        // transfer ownership of Vault to highestBidder
        vault.transferOwnership(highestBidder);

        emit BuyoutEnded(highestBidder, highestBidValues[0]);
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

    function _activateBuyout() internal {
        status = BuyoutStatus.ACTIVE;
        // reset values
        highestBidValues[0] = 0;
        highestBidder = address(0);
    }

}
