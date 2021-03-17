const timeMachine = require("ganache-time-traveler");
const currentEpoch = require("./helpers/currentEpoch");

const { time, constants, ether, expectRevert } = require("@openzeppelin/test-helpers");

const { expect } = require("chai");

const Vault = artifacts.require("SimpleVault");

const Token0 = artifacts.require("MockToken0");
const Token2 = artifacts.require("MockToken2");

const Buyout = artifacts.require("SimpleBuyout");
const Redeem = artifacts.require("SimpleRedeem");

const EPOCH_PERIOD = 28800;// 8 hours = 60 * 60 * 8 seconds

const BUYOUT_START_THRESHOLD = 10000000;// 10 million worth of Token2
const BUYOUT_STOP_THRESHOLD_PERCENTAGE = 25;// Buyout stops if 25% of Token0 are staked
const BUYOUT_DURATION_IN_EPOCHS = 42;
const BID_INTERVAL_IN_EPOCHS = 9;

contract("SimpleRedeem", (accounts) => {

    const owner = accounts[0];
    const tester1 = accounts[1];
    const tester2 = accounts[2];

    this.vault = null;

    this.token0 = null;
    this.token2 = null;

    this.buyout = null;
    this.redemption = null;

    this.totalBidAmount = null;
    this.token2Amount = null;
    this.token0Amount = null;

    this.snapshotIds = [];

    before(async () => {
        this.vault = await Vault.deployed();
        this.token0 = await Token0.deployed();
        this.token2 = await Token2.deployed();
        this.buyout = await Buyout.deployed();

        this.totalBidAmount = web3.utils.toWei("12000000", "ether");// 12M worth of token2
        this.token2Amount = web3.utils.toWei("10800000", "ether");// 10.8M token2
        this.token0Amount = web3.utils.toWei("1000000", "ether");// 1M token0

        // Ownership of Vault is transferred to Buyout contract
        await this.vault.transferOwnership(this.buyout.address, { from: owner, gas: 50000 });
        // owner mints 10M Token0 to owner
        await this.token0.mint(owner, web3.utils.toWei("10000000", "ether"), { from: owner, gas: 100000 });
        // owner sends 1M Token0 to tester1
        await this.token0.transfer(tester1, web3.utils.toWei("1000000", "ether"), { from: owner, gas: 100000 });
        // owner sends 0.5M Token0 to tester2
        await this.token0.transfer(tester2, web3.utils.toWei("500000", "ether"), { from: owner, gas: 100000 });
        // Ownership of Token0 is transferred to Buyout contract
        await this.token0.transferOwnership(this.buyout.address, { from: owner, gas: 50000 });
        // buyout is enabled
        await this.buyout.enableBuyout(
            this.token0.address, this.token2.address, this.vault.address,
            [
                web3.utils.toWei(BUYOUT_START_THRESHOLD.toString(), "ether"),
                BUYOUT_DURATION_IN_EPOCHS,
                BID_INTERVAL_IN_EPOCHS,
                BUYOUT_STOP_THRESHOLD_PERCENTAGE
            ], { from: owner, gas: 2000000 });
        // owner mints 10.8M token2 to tester1
        await this.token2.mint(tester1, this.token2Amount, { from: owner, gas: 100000 });
        // tester1 approves 10.8M token2 to buyout contract
        await this.token2.approve(this.buyout.address, this.token2Amount, { from: tester1, gas: 100000 });
        // tester1 approves 1.2M Token0 to buyout contract
        await this.token0.approve(this.buyout.address, this.token0Amount, { from: tester1, gas: 100000 });
        // tester1 places a bid
        await this.buyout.placeBid(this.totalBidAmount, this.token2Amount, { from: tester1, gas: 300000 });
        // time travel to end epoch
        let currentEpochValue = currentEpoch(await time.latest());
        let endEpochValue = (await this.buyout.epochs(1)).toNumber();
        let epochDiff = endEpochValue > currentEpochValue ? endEpochValue - currentEpochValue : currentEpochValue;
        let endTimestamp = EPOCH_PERIOD * epochDiff;
        await timeMachine.advanceTimeAndBlock(endTimestamp + EPOCH_PERIOD);
        await this.buyout.endBuyout({ from: owner, gas: 2000000 });
        let redeemAddress = await this.buyout.redemption();
        this.redemption = new Redeem(redeemAddress);
    });

    describe("enableRedeem", () => {
        const redeemToken0Amount = web3.utils.toWei("500000", "ether");
        const redeemToken2Amount = web3.utils.toWei("600000", "ether");

        it("fails with invalid token0Address", async () => {
            let standaloneRedemption = await Redeem.new();
            await expectRevert(
                standaloneRedemption.enableRedeem(
                    constants.ZERO_ADDRESS, this.token2.address, redeemToken2Amount, { from: owner, gas: 2000000 }
                ),
                "{enableRedeem} : invalid token0Address"
            );
            await expectRevert(
                standaloneRedemption.enableRedeem(
                    tester1, this.token2.address, redeemToken2Amount, { from: owner, gas: 2000000 }
                ),
                "{enableRedeem} : invalid token0Address"
            );
        });

        it("fails with invalid token2Address", async () => {
            let standaloneRedemption = await Redeem.new();
            await expectRevert(
                standaloneRedemption.enableRedeem(
                    this.token0.address, constants.ZERO_ADDRESS, redeemToken2Amount, { from: owner, gas: 2000000 }
                ),
                "{enableRedeem} : invalid token2Address"
            );
            await expectRevert(
                standaloneRedemption.enableRedeem(
                    this.token0.address, tester1, redeemToken2Amount, { from: owner, gas: 2000000 }
                ),
                "{enableRedeem} : invalid token2Address"
            );
        });

        it("fails with zero token2 amount", async () => {
            let standaloneRedemption = await Redeem.new();
            await expectRevert(
                standaloneRedemption.enableRedeem(
                    this.token0.address, this.token2.address, 0, { from: owner, gas: 2000000 }
                ),
                "{enableRedeem} : token2Amount cannot be zero"
            );
        });

        it("deploys with correct parameters", async () => {
            assert.equal(1, await this.redemption.status.call());
            assert.equal(this.token0.address, await this.redemption.token0.call());
            assert.equal(this.token2.address, await this.redemption.token2.call());
            assert.equal(this.token2Amount, await this.redemption.redeemToken2Amount.call());
            assert.equal(redeemToken2Amount, await this.redemption.token2AmountRedeemable(redeemToken0Amount));
        });

        it("cannot be called twice", async () => {
            await expectRevert(
                this.redemption.enableRedeem(
                    this.token0.address, this.token2.address, this.token2Amount,
                    { from: tester1, gas: 2000000 }),
                "{enableRedeem} : redeem has already been enabled",
            );
        });

    });

    describe("redeem", () => {
        const redeemToken0Amount = web3.utils.toWei("500000", "ether");

        before(async () => {
            this.snapshotIds.push((await timeMachine.takeSnapshot())["result"]);

            // tester2 approves 0.5M Token0 to redeem contract
            await this.token0.approve(this.redemption.address, redeemToken0Amount, { from: tester2, gas: 200000 });
        });

        after(async () => {
            await timeMachine.revertToSnapshot(this.snapshotIds.pop());
        });

        it("fails if status is not ENABLED", async () => {
            let standaloneRedemption = await Redeem.new();
            await expectRevert(
                standaloneRedemption.redeem(redeemToken0Amount, { from: tester2, gas: 200000 }),
                "{redeem} : redeem has not yet been enabled"
            );
        });

        it("fails with invalid token0 amount (insufficient)", async () => {
            const invalidToken0Amount = web3.utils.toWei("1000000", "ether");
            await expectRevert(
                this.redemption.redeem(
                    invalidToken0Amount,
                    { from: tester2, gas: 2000000 }
                ),
                "{redeem} : insufficient token0 amount"
            );
        });

        it("fails with invalid token0 amount (zero)", async () => {
            const zeroToken0Amount = web3.utils.toWei("0", "ether");
            await expectRevert(
                this.redemption.redeem(
                    zeroToken0Amount,
                    { from: tester2, gas: 2000000 }
                ),
                "{redeem} : token0 amount cannot be zero"
            );
        });

        it("works as expected", async () => {
            await this.redemption.redeem(redeemToken0Amount, { from: tester2, gas: 200000 });
            expect(await this.token0.balanceOf(tester2)).to.be.bignumber.equal("0");
            expect(await this.token2.balanceOf(tester2)).to.be.bignumber.equal(ether("600000"));
        });

    });

});
