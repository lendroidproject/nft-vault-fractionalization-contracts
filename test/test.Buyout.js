const timeMachine = require("ganache-time-traveler");
const currentEpoch = require("./helpers/currentEpoch");

const { constants, time, ether, expectRevert } = require("@openzeppelin/test-helpers");

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

contract("SimpleBuyout", (accounts) => {

    const owner = accounts[0];
    const tester1 = accounts[1];
    const tester2 = accounts[2];
    const tester3 = accounts[3];
    const tester4 = accounts[4];
    const tester5 = accounts[5];
    const tester6 = accounts[6];
    const tester7 = accounts[7];

    this.currentTime = null;

    this.vault = null;

    this.token0 = null;
    this.token2 = null;

    this.buyout = null;
    this.redemption = null;

    this.snapshotIds = [];

    before(async () => {
        this.vault = await Vault.deployed();
        this.token0 = await Token0.deployed();
        this.token2 = await Token2.deployed();
        this.buyout = await Buyout.deployed();
        // Ownership of Vault is transferred to Buyout contract
        await this.vault.transferOwnership(this.buyout.address, { from: owner, gas: 50000 });
        // owner mints 10M Token0 to owner
        await this.token0.mint(owner, web3.utils.toWei("10000000", "ether"), { from: owner, gas: 100000 });
        // owner sends 1M Token0 to tester1
        await this.token0.transfer(tester1, web3.utils.toWei("1000000", "ether"), { from: owner, gas: 100000 });
        // owner sends 0.5M Token0 to tester2
        await this.token0.transfer(tester2, web3.utils.toWei("500000", "ether"), { from: owner, gas: 100000 });
        // owner sends 2.5M Token0 to tester3
        await this.token0.transfer(tester3, web3.utils.toWei("2500000", "ether"), { from: owner, gas: 100000 });
        // owner sends 0.5M Token0 to tester4
        await this.token0.transfer(tester4, web3.utils.toWei("500000", "ether"), { from: owner, gas: 100000 });
        // owner sends 0.5M Token0 to tester5
        await this.token0.transfer(tester5, web3.utils.toWei("500000", "ether"), { from: owner, gas: 100000 });
        // owner sends 0.5M Token0 to tester6
        await this.token0.transfer(tester6, web3.utils.toWei("500000", "ether"), { from: owner, gas: 100000 });
        // owner sends 0.5M Token0 to tester7
        await this.token0.transfer(tester7, web3.utils.toWei("500000", "ether"), { from: owner, gas: 100000 });
        // Ownership of Token0 is transferred to Buyout contract
        await this.token0.transferOwnership(this.buyout.address, { from: owner, gas: 50000 });
        this.redemption = new Redeem(this.buyout.address);
    });

    beforeEach(async () => {
        this.currentTime = await time.latest();
    });

    describe("constructor", () => {

        it("deploys with owner", async () => {
            assert.equal(owner, await this.buyout.owner(), "owner is not deployer");
        });

        it("[config] - buyout parameters correctly", async () => {
            assert.equal(await this.buyout.token0(), this.token0.address);
            assert.equal(await this.buyout.token2(), this.token2.address);
            assert.equal(await this.buyout.vault(), this.vault.address);
            assert.equal(await this.buyout.startThreshold(), web3.utils.toWei(BUYOUT_START_THRESHOLD.toString(), "ether"));
            // verify durationInEpochs
            expect(await this.buyout.epochs(2), BUYOUT_DURATION_IN_EPOCHS.toString());
            // verify bidIntervalInEpochs
            expect(await this.buyout.epochs(3), BID_INTERVAL_IN_EPOCHS.toString());
            expect(await this.buyout.stopThresholdPercent(), BUYOUT_STOP_THRESHOLD_PERCENTAGE.toString());
            assert.equal(await this.buyout.paused(), false);
            assert.equal(await this.buyout.vault(), this.vault.address);
            assert.equal(await this.buyout.redemption(), constants.ZERO_ADDRESS);
        });
    });

    describe("togglePause", async () => {

        it("[require] - caller needs to be the owner", async () => {
            await expectRevert(
                this.buyout.togglePause(true, { from: tester1, gas: 2000000 }),
                "Ownable: caller is not the owner",
            );
        });

        it("[success] - toggle pause", async () => {
            await this.buyout.togglePause(true, { from: owner, gas: 2000000 });
            assert.equal(await this.buyout.paused(), true);
            await this.buyout.togglePause(false, { from: owner, gas: 2000000 });
            assert.equal(await this.buyout.paused(), false);
        });

    });

    describe("setRedemption", async () => {

        it("[require] - caller needs to be the owner", async () => {
            await expectRevert(
                this.buyout.setRedemption(this.redemption.address, { from: tester1, gas: 2000000 }),
                "Ownable: caller is not the owner",
            );
        });

        it("[revert] - invalid redeem address", async () => {
            await expectRevert(
                this.buyout.setRedemption(constants.ZERO_ADDRESS, { from: owner, gas: 2000000 }),
                "{setRedemption} : invalid redeemAddress"
            );
        });

        it("[success] - set redemption", async () => {
            await this.buyout.setRedemption(this.redemption.address, { from: owner, gas: 2000000 });
            assert.equal(await this.buyout.redemption(), this.redemption.address);
        });

        it("[fail] - redemption already set", async () => {
            await expectRevert(
                this.buyout.setRedemption(this.redemption.address, { from: owner, gas: 2000000 }),
                "{setRedemption} : redemption address has already been set"
            );
        });

    });

    describe("placeBid", () => {

        before(async () => {
            this.snapshotIds.push((await timeMachine.takeSnapshot())["result"]);
        });

        after(async () => {
            await timeMachine.revertToSnapshot(this.snapshotIds.pop());
        });

        it("[require] - not paused", async () => {
            assert.equal(await this.buyout.paused(), false);
        });

        it("[require] - not ended", async () => {
            assert.notEqual(await this.buyout.paused(), 3);
        });

        it("fails with totalBidAmount < minimum threshold", async () => {
            const totalBidMinimum = web3.utils.toWei("9900000", "ether");// 9.9M worth of token2
            const token2Amount = web3.utils.toWei("10800000", "ether");// 10.8M token2
            await expectRevert(
                this.buyout.placeBid(totalBidMinimum, token2Amount, { from: tester2, gas: 275000 }),
                "{placeBid} : totalBidAmount does not meet minimum threshold",
            );
        });

        it("fails with insufficient token2 balance", async () => {
            const totalBidAmount = web3.utils.toWei("12000000", "ether");// 12M worth of token2
            const token2More = web3.utils.toWei("11000000", "ether");// 11M token2
            await expectRevert(
                this.buyout.placeBid(totalBidAmount, token2More, { from: tester1, gas: 275000 }),
                "{placeBid} : insufficient token2 balance",
            );
        });

        it("fails with insufficient token0 balance", async () => {
            const token2Amount = web3.utils.toWei("10800000", "ether");// 10.8M token2
            const token0Amount = web3.utils.toWei("1000000", "ether");// 1M token0
            // owner mints 10.8M token2 to tester1
            await this.token2.mint(tester1, token2Amount, { from: owner, gas: 100000 });
            // tester1 approves 10.8M token2 to buyout contract
            await this.token2.approve(this.buyout.address, token2Amount, { from: tester1, gas: 100000 });
            // tester1 approves 1.2M Token0 to buyout contract
            await this.token0.approve(this.buyout.address, token0Amount, { from: tester1, gas: 100000 });

            const totalBidMore = web3.utils.toWei("13000000", "ether");// 13M worth of token2
            await expectRevert(
                this.buyout.placeBid(totalBidMore, token2Amount, { from: tester1, gas: 275000 }),
                "{placeBid} : insufficient token0 balance",
            );
        });

        it("fails with less than 5% of token0 totalSupply", async () => {
            const totalBidAmount = web3.utils.toWei("11000000", "ether");// 12M worth of token2
            const token2Amount = web3.utils.toWei("10800000", "ether");// 10.8M token2
            await expectRevert(
                this.buyout.placeBid(totalBidAmount, token2Amount, { from: tester1, gas: 275000 }),
                "{placeBid} : token0Amount should be at least 5% of token0 totalSupply",
            );
        });

        it("success when inputs are correct", async () => {
            const totalBidAmount = web3.utils.toWei("12000000", "ether");// 12M worth of token2
            const token2Amount = web3.utils.toWei("10800000", "ether");// 10.8M token2
            const token0Amount = web3.utils.toWei("1000000", "ether");// 1M token0

            expect(await this.buyout.requiredToken0ToBid(totalBidAmount, token2Amount)).to.be.bignumber.equal(token0Amount.toString());
            // validate state pre-bid
            expect(await this.buyout.epochs(0)).to.be.bignumber.equal("0");
            expect(await this.buyout.epochs(1)).to.be.bignumber.equal("0");
            expect(await this.buyout.highestBidder()).equal(constants.ZERO_ADDRESS);
            expect(await this.buyout.highestBidValues(0)).to.be.bignumber.equal("0");
            expect(await this.buyout.highestBidValues(1)).to.be.bignumber.equal("0");
            expect(await this.buyout.highestBidValues(2)).to.be.bignumber.equal("0");
            expect(await this.token0.balanceOf(this.buyout.address)).to.be.bignumber.equal("0");
            expect(await this.token2.balanceOf(this.buyout.address)).to.be.bignumber.equal("0");
            // tester1 places a bid
            await this.buyout.placeBid(totalBidAmount, token2Amount, { from: tester1, gas: 475000 });
            // validate state post-bid
            expect(await this.buyout.epochs(0)).to.be.bignumber.equal(currentEpoch(await time.latest()).toString());
            expect(await this.buyout.epochs(1)).to.be.bignumber.equal((currentEpoch(await time.latest()) + BUYOUT_DURATION_IN_EPOCHS).toString());
            expect(await this.buyout.highestBidder()).equal(tester1);
            expect(await this.buyout.highestBidValues(0)).to.be.bignumber.equal(totalBidAmount.toString());
            expect(await this.buyout.highestBidValues(1)).to.be.bignumber.equal(token0Amount.toString());
            expect(await this.buyout.highestBidValues(2)).to.be.bignumber.equal(token2Amount.toString());
            expect(await this.token0.balanceOf(this.buyout.address)).to.be.bignumber.equal(token0Amount.toString());
            expect(await this.token2.balanceOf(this.buyout.address)).to.be.bignumber.equal(token2Amount.toString());
            expect(await this.token0.balanceOf(tester1)).to.be.bignumber.equal("0");
            expect(await this.token2.balanceOf(tester1)).to.be.bignumber.equal("0");
        });

        it("fails with totalBidAmount < previous bid", async () => {
            // tester3 sends 2.5M Token0 to tester2
            await this.token0.transfer(tester2, web3.utils.toWei("2500000", "ether"), { from: tester3, gas: 100000 });

            this.snapshotIds.push((await timeMachine.takeSnapshot())["result"]);

            //// tester2 decides to outbid tester1
            const totalBidAmount = web3.utils.toWei("11000000", "ether");// 11M worth of token2
            const token2Amount = web3.utils.toWei("9900000", "ether");// 15M token2
            const token0Amount = web3.utils.toWei("1000000", "ether");// 2.5M token0
            expect(await this.buyout.requiredToken0ToBid(totalBidAmount, token2Amount)).to.be.bignumber.equal(token0Amount.toString());
            // owner mints 15M token2 to tester2
            await this.token2.mint(tester2, token2Amount, { from: owner, gas: 100000 });
            // tester2 approves 15M token2 to buyout contract
            await this.token2.approve(this.buyout.address, token2Amount, { from: tester2, gas: 100000 });
            // tester2 approves 2.5M Token0 to buyout contract
            await this.token0.approve(this.buyout.address, token0Amount, { from: tester2, gas: 100000 });
            // tester2 places a bid
            await expectRevert(
                this.buyout.placeBid(totalBidAmount, token2Amount, { from: tester2, gas: 275000 }),
                "{placeBid} : there already is a higher bid",
            );

            await timeMachine.revertToSnapshot(this.snapshotIds.pop());
        });

        it("fails if buyout has ended", async () => {
            this.snapshotIds.push((await timeMachine.takeSnapshot())["result"]);

            // time travel to end epoch
            const currentEpochValue = currentEpoch(await time.latest());
            const endEpochValue = (await this.buyout.epochs(1)).toNumber();
            const epochDiff = endEpochValue > currentEpochValue ? endEpochValue - currentEpochValue : currentEpochValue;
            const endTimestamp = EPOCH_PERIOD * epochDiff;
            await timeMachine.advanceTimeAndBlock(endTimestamp + EPOCH_PERIOD);
            // buyout is ended
            await this.buyout.endBuyout({ from: owner, gas: 475000 });
            //// tester2 decides to outbid tester1
            const totalBidAmount = web3.utils.toWei("20000000", "ether");// 20M worth of token2
            const token2Amount = web3.utils.toWei("15000000", "ether");// 15M token2
            const token0Amount = web3.utils.toWei("2500000", "ether");// 2.5M token0
            // owner mints 15M token2 to tester2
            await this.token2.mint(tester2, token2Amount, { from: owner, gas: 100000 });
            // tester2 approves 15M token2 to buyout contract
            await this.token2.approve(this.buyout.address, token2Amount, { from: tester2, gas: 100000 });
            // tester2 approves 2.5M Token0 to buyout contract
            await this.token0.approve(this.buyout.address, token0Amount, { from: tester2, gas: 100000 });
            // tester2 places a bid
            await expectRevert(
                this.buyout.placeBid(totalBidAmount, token2Amount, { from: tester2, gas: 275000 }),
                "{placeBid} : buyout has ended",
            );

            await timeMachine.revertToSnapshot(this.snapshotIds.pop());
        });

        it("fails if buyout expiry has been reached", async () => {
            this.snapshotIds.push((await timeMachine.takeSnapshot())["result"]);

            // time travel to end epoch
            const currentEpochValue = currentEpoch(await time.latest());
            const endEpochValue = (await this.buyout.epochs(1)).toNumber();
            const epochDiff = endEpochValue > currentEpochValue ? endEpochValue - currentEpochValue : currentEpochValue;
            const endTimestamp = EPOCH_PERIOD * epochDiff;
            await timeMachine.advanceTimeAndBlock(endTimestamp + EPOCH_PERIOD);
            //// tester2 decides to outbid tester1
            const totalBidAmount = web3.utils.toWei("20000000", "ether");// 20M worth of token2
            const token2Amount = web3.utils.toWei("15000000", "ether");// 15M token2
            const token0Amount = web3.utils.toWei("2500000", "ether");// 2.5M token0
            // owner mints 15M token2 to tester2
            await this.token2.mint(tester2, token2Amount, { from: owner, gas: 100000 });
            // tester2 approves 15M token2 to buyout contract
            await this.token2.approve(this.buyout.address, token2Amount, { from: tester2, gas: 100000 });
            // tester2 approves 2.5M Token0 to buyout contract
            await this.token0.approve(this.buyout.address, token0Amount, { from: tester2, gas: 100000 });
            // tester2 places a bid
            await expectRevert(
                this.buyout.placeBid(totalBidAmount, token2Amount, { from: tester2, gas: 275000 }),
                "{placeBid} : buyout end epoch has been surpassed",
            );

            await timeMachine.revertToSnapshot(this.snapshotIds.pop());
        });

        it("updates storage correctly when bids are placed", async () => {
            //// tester2 decides to outbid tester1
            const totalBidAmount = web3.utils.toWei("20000000", "ether");// 20M worth of token2
            const token2Amount = web3.utils.toWei("15000000", "ether");// 15M token2
            const token0Amount = web3.utils.toWei("2500000", "ether");// 2.5M token0
            expect(await this.buyout.requiredToken0ToBid(totalBidAmount, token2Amount)).to.be.bignumber.equal(token0Amount.toString());
            // owner mints 15M token2 to tester2
            await this.token2.mint(tester2, token2Amount, { from: owner, gas: 100000 });
            // tester2 approves 15M token2 to buyout contract
            await this.token2.approve(this.buyout.address, token2Amount, { from: tester2, gas: 100000 });
            // tester2 approves 2.5M Token0 to buyout contract
            await this.token0.approve(this.buyout.address, token0Amount, { from: tester2, gas: 100000 });
            // tester2 places a bid
            await this.buyout.placeBid(totalBidAmount, token2Amount, { from: tester2, gas: 275000 });
            // validate state post-bid
            expect(await this.buyout.epochs(0)).to.be.bignumber.equal(currentEpoch(await time.latest()).toString());
            expect(await this.buyout.epochs(1)).to.be.bignumber.equal((currentEpoch(await time.latest()) + BID_INTERVAL_IN_EPOCHS).toString());
            expect(await this.buyout.highestBidder()).equal(tester2);
            expect(await this.buyout.highestBidValues(0)).to.be.bignumber.equal(totalBidAmount.toString());
            expect(await this.buyout.highestBidValues(1)).to.be.bignumber.equal(token0Amount.toString());
            expect(await this.buyout.highestBidValues(2)).to.be.bignumber.equal(token2Amount.toString());
            expect(await this.token0.balanceOf(this.buyout.address)).to.be.bignumber.equal(token0Amount.toString());
            expect(await this.token2.balanceOf(this.buyout.address)).to.be.bignumber.equal(token2Amount.toString());
            expect(await this.token0.balanceOf(tester1)).to.be.bignumber.equal(ether("1000000"));
            expect(await this.token2.balanceOf(tester1)).to.be.bignumber.equal(ether("10800000"));
            expect(await this.token0.balanceOf(tester2)).to.be.bignumber.equal(ether("500000"));
            expect(await this.token2.balanceOf(tester2)).to.be.bignumber.equal("0");
        });

    });

    // describe("stakeToken0ToStopBuyout", () => {

    //     beforeEach(async () => {
    //         snapshotId = (await timeMachine.takeSnapshot())["result"];
    //     });

    //     afterEach(async () => {
    //         await timeMachine.revertToSnapshot(snapshotId);
    //     });

    //     it("fails if buyout expiry has been reached", async () => {
    //         let totalBidAmount = web3.utils.toWei("12000000", "ether");// 12M worth of token2
    //         let token2Amount = web3.utils.toWei("10800000", "ether");// 10.8M token2
    //         let token0Amount = web3.utils.toWei("1000000", "ether");// 1M token0
    //         // owner mints 10.8M token2 to tester1
    //         await this.token2.mint(tester1, token2Amount, { from: owner, gas: 100000 });
    //         // tester1 approves 10.8M token2 to buyout contract
    //         await this.token2.approve(this.buyout.address, token2Amount, { from: tester1, gas: 100000 });
    //         // tester1 approves 1.2M Token0 to buyout contract
    //         await this.token0.approve(this.buyout.address, token0Amount, { from: tester1, gas: 100000 });
    //         // tester1 places a bid
    //         await this.buyout.placeBid(totalBidAmount, token2Amount, { from: tester1, gas: 275000 });
    //         // time travel to end epoch
    //         let currentEpochValue = currentEpoch(await time.latest());
    //         let endEpochValue = (await this.buyout.epochs(1)).toNumber();
    //         let epochDiff = endEpochValue > currentEpochValue ? endEpochValue - currentEpochValue : currentEpochValue;
    //         let endTimestamp = EPOCH_PERIOD * epochDiff;
    //         await timeMachine.advanceTimeAndBlock(endTimestamp + EPOCH_PERIOD);
    //         //// bid revokation begins
    //         token0Amount = web3.utils.toWei("500000", "ether");// 0.5M token0
    //         // tester2 approves 0.5M Token0 to buyout contract
    //         await this.token0.approve(this.buyout.address, token0Amount, { from: tester2, gas: 100000 });
    //         // tester2 tries to stake 0.5M token0 to stop bid
    //         await expectRevert(
    //             this.buyout.stakeToken0ToStopBuyout(token0Amount, { from: tester2, gas: 250000 }),
    //             "{stakeToken0ToStopBuyout} : buyout is not active",
    //         );
    //     });

    //     it("updates storage correctly when token0s are staked", async () => {
    //         let totalBidAmount = web3.utils.toWei("12000000", "ether");// 12M worth of token2
    //         let token2Amount = web3.utils.toWei("10800000", "ether");// 10.8M token2
    //         let token0Amount = web3.utils.toWei("1000000", "ether");// 1M token0
    //         // owner mints 10.8M token2 to tester1
    //         await this.token2.mint(tester1, token2Amount, { from: owner, gas: 100000 });
    //         // tester1 approves 10.8M token2 to buyout contract
    //         await this.token2.approve(this.buyout.address, token2Amount, { from: tester1, gas: 100000 });
    //         // tester1 approves 1.2M Token0 to buyout contract
    //         await this.token0.approve(this.buyout.address, token0Amount, { from: tester1, gas: 100000 });
    //         // tester1 places a bid
    //         await this.buyout.placeBid(totalBidAmount, token2Amount, { from: tester1, gas: 275000 });
    //         //// bid revokation begins
    //         token0Amount = web3.utils.toWei("500000", "ether");// 0.5M token0
    //         // tester2 approves 0.5M Token0 to buyout contract
    //         await this.token0.approve(this.buyout.address, token0Amount, { from: tester2, gas: 100000 });
    //         // tester2 stakes 0.5M token0 to stop bid
    //         await this.buyout.stakeToken0ToStopBuyout(token0Amount, { from: tester2, gas: 250000 });
    //         expect(await this.buyout.highestBidder()).equal(tester1);
    //         expect(await this.buyout.highestBidValues(0)).to.be.bignumber.equal(totalBidAmount.toString());
    //         expect(await this.buyout.highestBidValues(1)).to.be.bignumber.equal(ether("1000000"));
    //         expect(await this.buyout.highestBidValues(2)).to.be.bignumber.equal(token2Amount.toString());
    //         expect(await this.token2.balanceOf(this.buyout.address)).to.be.bignumber.equal(token2Amount.toString());
    //         expect(await this.token0.balanceOf(tester1)).to.be.bignumber.equal("0");
    //         expect(await this.token2.balanceOf(tester1)).to.be.bignumber.equal("0");
    //         expect(await this.buyout.totalToken0Staked()).to.be.bignumber.equal(ether("500000"));
    //         expect(await this.buyout.token0Staked(tester2)).to.be.bignumber.equal(token0Amount.toString());
    //         expect(await this.token0.balanceOf(this.buyout.address)).to.be.bignumber.equal(ether("1500000"));
    //         expect(await this.token0.balanceOf(tester2)).to.be.bignumber.equal("0");
    //         // tester3 approves 0.5M Token0 to buyout contract
    //         await this.token0.approve(this.buyout.address, token0Amount, { from: tester3, gas: 100000 });
    //         // tester3 stakes 0.5M token0 to stop bid
    //         await this.buyout.stakeToken0ToStopBuyout(token0Amount, { from: tester3, gas: 250000 });
    //         expect(await this.buyout.highestBidder()).equal(tester1);
    //         expect(await this.buyout.highestBidValues(0)).to.be.bignumber.equal(totalBidAmount.toString());
    //         expect(await this.buyout.highestBidValues(1)).to.be.bignumber.equal(ether("1000000"));
    //         expect(await this.buyout.highestBidValues(2)).to.be.bignumber.equal(token2Amount.toString());
    //         expect(await this.token2.balanceOf(this.buyout.address)).to.be.bignumber.equal(token2Amount.toString());
    //         expect(await this.token0.balanceOf(tester1)).to.be.bignumber.equal("0");
    //         expect(await this.token2.balanceOf(tester1)).to.be.bignumber.equal("0");
    //         expect(await this.buyout.totalToken0Staked()).to.be.bignumber.equal(ether("1000000"));
    //         expect(await this.buyout.token0Staked(tester3)).to.be.bignumber.equal(token0Amount.toString());
    //         expect(await this.token0.balanceOf(this.buyout.address)).to.be.bignumber.equal(ether("2000000"));
    //         expect(await this.token0.balanceOf(tester3)).to.be.bignumber.equal(ether("2000000"));
    //         // tester4 approves 0.5M Token0 to buyout contract
    //         await this.token0.approve(this.buyout.address, token0Amount, { from: tester4, gas: 100000 });
    //         // tester4 stakes 0.5M token0 to stop bid
    //         await this.buyout.stakeToken0ToStopBuyout(token0Amount, { from: tester4, gas: 250000 });
    //         expect(await this.buyout.highestBidder()).equal(tester1);
    //         expect(await this.buyout.highestBidValues(0)).to.be.bignumber.equal(totalBidAmount.toString());
    //         expect(await this.buyout.highestBidValues(1)).to.be.bignumber.equal(ether("1000000"));
    //         expect(await this.buyout.highestBidValues(2)).to.be.bignumber.equal(token2Amount.toString());
    //         expect(await this.token2.balanceOf(this.buyout.address)).to.be.bignumber.equal(token2Amount.toString());
    //         expect(await this.token0.balanceOf(tester1)).to.be.bignumber.equal("0");
    //         expect(await this.token2.balanceOf(tester1)).to.be.bignumber.equal("0");
    //         expect(await this.buyout.totalToken0Staked()).to.be.bignumber.equal(ether("1500000"));
    //         expect(await this.buyout.token0Staked(tester4)).to.be.bignumber.equal(token0Amount.toString());
    //         expect(await this.token0.balanceOf(this.buyout.address)).to.be.bignumber.equal(ether("2500000"));
    //         expect(await this.token0.balanceOf(tester4)).to.be.bignumber.equal("0");
    //         // tester5 approves 0.5M Token0 to buyout contract
    //         await this.token0.approve(this.buyout.address, token0Amount, { from: tester5, gas: 100000 });
    //         // tester5 stakes 0.5M token0 to stop bid
    //         await this.buyout.stakeToken0ToStopBuyout(token0Amount, { from: tester5, gas: 250000 });
    //         expect(await this.buyout.highestBidder()).equal(tester1);
    //         expect(await this.buyout.highestBidValues(0)).to.be.bignumber.equal(totalBidAmount.toString());
    //         expect(await this.buyout.highestBidValues(1)).to.be.bignumber.equal(ether("1000000"));
    //         expect(await this.buyout.highestBidValues(2)).to.be.bignumber.equal(token2Amount.toString());
    //         expect(await this.token2.balanceOf(this.buyout.address)).to.be.bignumber.equal(token2Amount.toString());
    //         expect(await this.token0.balanceOf(tester1)).to.be.bignumber.equal("0");
    //         expect(await this.token2.balanceOf(tester1)).to.be.bignumber.equal("0");
    //         expect(await this.buyout.totalToken0Staked()).to.be.bignumber.equal(ether("2000000"));
    //         expect(await this.buyout.token0Staked(tester5)).to.be.bignumber.equal(token0Amount.toString());
    //         expect(await this.token0.balanceOf(this.buyout.address)).to.be.bignumber.equal(ether("3000000"));
    //         expect(await this.token0.balanceOf(tester5)).to.be.bignumber.equal("0");
    //         // tester6 approves 0.5M Token0 to buyout contract
    //         await this.token0.approve(this.buyout.address, token0Amount, { from: tester6, gas: 100000 });
    //         // tester6 stakes 0.5M token0 to stop bid
    //         await this.buyout.stakeToken0ToStopBuyout(token0Amount, { from: tester6, gas: 250000 });
    //         expect(await this.buyout.highestBidder()).equal(constants.ZERO_ADDRESS);
    //         expect(await this.buyout.highestBidValues(0)).to.be.bignumber.equal("0");
    //         expect(await this.buyout.highestBidValues(1)).to.be.bignumber.equal("0");
    //         expect(await this.buyout.highestBidValues(2)).to.be.bignumber.equal("0");
    //         expect(await this.token2.balanceOf(this.buyout.address)).to.be.bignumber.equal("0");
    //         expect(await this.token0.balanceOf(tester1)).to.be.bignumber.equal(ether("1000000"));
    //         expect(await this.token2.balanceOf(tester1)).to.be.bignumber.equal(ether("10800000"));
    //         expect(await this.buyout.totalToken0Staked()).to.be.bignumber.equal("0");
    //         expect(await this.buyout.token0Staked(tester6)).to.be.bignumber.equal(token0Amount.toString());
    //         expect(await this.token0.balanceOf(this.buyout.address)).to.be.bignumber.equal(ether("2500000"));
    //         expect(await this.token0.balanceOf(tester6)).to.be.bignumber.equal("0");
    //     });

    // });

    // describe("withdrawStakedToken0", () => {

    //     beforeEach(async () => {
    //         snapshotId = (await timeMachine.takeSnapshot())["result"];
    //     });

    //     afterEach(async () => {
    //         await timeMachine.revertToSnapshot(snapshotId);
    //     });

    //     it("fails with invalid startThreshold", async () => {
    //         await expectRevert(
    //             this.buyout.withdrawStakedToken0({ from: tester2, gas: 300000 }),
    //             "{withdrawStakedToken0} : no staked token0Amount",
    //         );
    //     });

    //     it("updates storage correctly when buyout is active and staked token0s are unstaked", async () => {
    //         let totalBidAmount = web3.utils.toWei("12000000", "ether");// 12M worth of token2
    //         let token2Amount = web3.utils.toWei("10800000", "ether");// 10.8M token2
    //         let token0Amount = web3.utils.toWei("1000000", "ether");// 1M token0
    //         // owner mints 10.8M token2 to tester1
    //         await this.token2.mint(tester1, token2Amount, { from: owner, gas: 100000 });
    //         // tester1 approves 10.8M token2 to buyout contract
    //         await this.token2.approve(this.buyout.address, token2Amount, { from: tester1, gas: 100000 });
    //         // tester1 approves 1.2M Token0 to buyout contract
    //         await this.token0.approve(this.buyout.address, token0Amount, { from: tester1, gas: 100000 });
    //         // tester1 places a bid
    //         await this.buyout.placeBid(totalBidAmount, token2Amount, { from: tester1, gas: 275000 });
    //         //// bid revokation begins
    //         token0Amount = web3.utils.toWei("500000", "ether");// 0.5M token0
    //         // tester2 approves 0.5M Token0 to buyout contract
    //         await this.token0.approve(this.buyout.address, token0Amount, { from: tester2, gas: 100000 });
    //         // tester2 stakes 0.5M token0 to stop bid
    //         await this.buyout.stakeToken0ToStopBuyout(token0Amount, { from: tester2, gas: 250000 });
    //         expect(await this.buyout.totalToken0Staked()).to.be.bignumber.equal(ether("500000"));
    //         expect(await this.buyout.token0Staked(tester2)).to.be.bignumber.equal(token0Amount.toString());
    //         expect(await this.token0.balanceOf(this.buyout.address)).to.be.bignumber.equal(ether("1500000"));
    //         expect(await this.token0.balanceOf(tester2)).to.be.bignumber.equal("0");
    //         // tester2 unstakes her staked token0s
    //         await this.buyout.withdrawStakedToken0({ from: tester2, gas: 300000 });
    //         expect(await this.buyout.token0Staked(tester2)).to.be.bignumber.equal("0");
    //         expect(await this.token0.balanceOf(this.buyout.address)).to.be.bignumber.equal(ether("1000000"));
    //         expect(await this.token0.balanceOf(tester2)).to.be.bignumber.equal(token0Amount.toString());
    //     });

    // });

    // describe("endBuyout", () => {

    //     let totalBidAmount = web3.utils.toWei("12000000", "ether");// 12M worth of token2
    //     let token2Amount = web3.utils.toWei("10800000", "ether");// 10.8M token2
    //     let token0Amount = web3.utils.toWei("1000000", "ether");// 1M token0

    //     beforeEach(async () => {
    //         snapshotId = (await timeMachine.takeSnapshot())["result"];
    //         // owner mints 10.8M token2 to tester1
    //         await this.token2.mint(tester1, token2Amount, { from: owner, gas: 100000 });
    //         // tester1 approves 10.8M token2 to buyout contract
    //         await this.token2.approve(this.buyout.address, token2Amount, { from: tester1, gas: 100000 });
    //         // tester1 approves 1.2M Token0 to buyout contract
    //         await this.token0.approve(this.buyout.address, token0Amount, { from: tester1, gas: 100000 });
    //     });

    //     afterEach(async () => {
    //         await timeMachine.revertToSnapshot(snapshotId);
    //     });

    //     it("fails if currentEpoch has not surpassed endEpoch", async () => {
    //         // tester1 places a bid
    //         await this.buyout.placeBid(totalBidAmount, token2Amount, { from: tester1, gas: 275000 });
    //         await expectRevert(
    //             this.buyout.endBuyout({ from: owner, gas: 2000000 }),
    //             "{endBuyout} : end epoch has not yet been reached",
    //         );
    //     });

    //     it("fails if no bid was placed at all", async () => {
    //         await expectRevert(
    //             this.buyout.endBuyout({ from: owner, gas: 2000000 }),
    //             "{endBuyout} : buyout does not have highestBidder",
    //         );
    //     });

    //     it("updates storage correctly when successful", async () => {
    //         // tester1 places a bid
    //         await this.buyout.placeBid(totalBidAmount, token2Amount, { from: tester1, gas: 275000 });
    //         // time travel to end epoch
    //         let currentEpochValue = currentEpoch(await time.latest());
    //         let endEpochValue = (await this.buyout.epochs(1)).toNumber();
    //         let epochDiff = endEpochValue > currentEpochValue ? endEpochValue - currentEpochValue : currentEpochValue;
    //         let endTimestamp = EPOCH_PERIOD * epochDiff;
    //         await timeMachine.advanceTimeAndBlock(endTimestamp + EPOCH_PERIOD);
    //         let redeemAddress = await this.buyout.redemption();
    //         assert.equal(redeemAddress, constants.ZERO_ADDRESS);
    //         assert.equal(this.buyout.address, await this.vault.owner());
    //         expect(await this.token0.balanceOf(this.buyout.address)).to.be.bignumber.equal(token0Amount.toString());
    //         expect(await this.token2.balanceOf(this.buyout.address)).to.be.bignumber.equal(token2Amount.toString());
    //         await this.buyout.endBuyout({ from: owner, gas: 2000000 });
    //         redeemAddress = await this.buyout.redemption();
    //         assert.notEqual(redeemAddress, constants.ZERO_ADDRESS);
    //         assert.equal(tester1, await this.vault.owner());
    //         expect(await this.token0.balanceOf(this.buyout.address)).to.be.bignumber.equal("0");
    //         expect(await this.token2.balanceOf(this.buyout.address)).to.be.bignumber.equal("0");
    //         expect(await this.token2.balanceOf(redeemAddress)).to.be.bignumber.equal(token2Amount.toString());
    //         // fails if trying to endBuout again
    //         await expectRevert(
    //             this.buyout.endBuyout({ from: owner, gas: 2000000 }),
    //             "{endBuyout} : buyout has already ended",
    //         );
    //     });

    // });

    // describe("requiredToken0ToBid", () => {

    //     let totalBidAmount = web3.utils.toWei("12000000", "ether");// 12M worth of token2
    //     let token2Amount = web3.utils.toWei("10800000", "ether");// 10.8M token2
    //     let token0Amount = web3.utils.toWei("1000000", "ether");// 1M token0

    //     beforeEach(async () => {
    //         snapshotId = (await timeMachine.takeSnapshot())["result"];
    //     });

    //     afterEach(async () => {
    //         await timeMachine.revertToSnapshot(snapshotId);
    //     });

    //     it("fails if token2Amount >  totalBidAmount", async () => {
    //         token2Amount = web3.utils.toWei("12000001", "ether");// 15M token2
    //         await expectRevert(
    //             this.buyout.requiredToken0ToBid(totalBidAmount, token2Amount),
    //             "{requiredToken0ToBid} : token2Amount cannot exceed totalBidAmount",
    //         );
    //     });

    //     it("returns correct values", async () => {
    //         token2Amount = web3.utils.toWei("10800000", "ether");// 10.8M token2
    //         expect(await this.buyout.requiredToken0ToBid(totalBidAmount, token2Amount)).to.be.bignumber.equal(token0Amount.toString());
    //         totalBidAmount = web3.utils.toWei("10000000", "ether");// 10M worth of token2
    //         token2Amount = web3.utils.toWei("9900000", "ether");// 9.9M token2
    //         token0Amount = web3.utils.toWei("100000", "ether");// 0.1M token0
    //         expect(await this.buyout.requiredToken0ToBid(totalBidAmount, token2Amount)).to.be.bignumber.equal(token0Amount.toString());
    //         totalBidAmount = web3.utils.toWei("20000000", "ether");// 10M worth of token2
    //         token2Amount = web3.utils.toWei("19900000", "ether");// 9.9M token2
    //         token0Amount = web3.utils.toWei("50000", "ether");// 0.05M token0
    //         expect(await this.buyout.requiredToken0ToBid(totalBidAmount, token2Amount)).to.be.bignumber.equal(token0Amount.toString());
    //     });

    // });

});
