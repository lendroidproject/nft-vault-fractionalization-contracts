const timeMachine = require("ganache-time-traveler");
const currentEpoch = require("./helpers/currentEpoch");

const { constants, time, ether, expectRevert } = require("@openzeppelin/test-helpers");

const { expect } = require("chai");

const Vault = artifacts.require("SimpleVault");

const Token0 = artifacts.require("MockToken0");
const Token2 = artifacts.require("MockToken2");

const Buyout = artifacts.require("SimpleBuyout");

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
        // owner sends 0.5M Token0 to tester3
        await this.token0.transfer(tester3, web3.utils.toWei("500000", "ether"), { from: owner, gas: 100000 });
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
    });

    beforeEach(async () => {
        this.currentTime = await time.latest();
    });

    describe("enableBuyout", () => {

        it("deploys with owner", async () => {
            assert.equal(owner, await this.buyout.owner(), "owner is not deployer");
        });

        it("cannot be called by non-owner", async () => {
            await expectRevert(
                this.buyout.enableBuyout(
                    this.token0.address, this.token2.address, this.vault.address,
                    [
                        web3.utils.toWei(BUYOUT_START_THRESHOLD.toString(), "ether"),
                        BUYOUT_DURATION_IN_EPOCHS,
                        BID_INTERVAL_IN_EPOCHS,
                        BUYOUT_STOP_THRESHOLD_PERCENTAGE
                    ], { from: tester1, gas: 2000000 }),
                "Ownable: caller is not the owner",
            );
        });

        it("fails with invalid token0Address", async () => {
            await expectRevert(
                this.buyout.enableBuyout(
                    constants.ZERO_ADDRESS, this.token2.address, this.vault.address,
                    [
                        web3.utils.toWei(BUYOUT_START_THRESHOLD.toString(), "ether"),
                        BUYOUT_DURATION_IN_EPOCHS,
                        BID_INTERVAL_IN_EPOCHS,
                        BUYOUT_STOP_THRESHOLD_PERCENTAGE
                    ], { from: owner, gas: 2000000 }),
                "{enableBuyout} : invalid token0Address",
            );
            await expectRevert(
                this.buyout.enableBuyout(
                    tester1, this.token2.address, this.vault.address,
                    [
                        web3.utils.toWei(BUYOUT_START_THRESHOLD.toString(), "ether"),
                        BUYOUT_DURATION_IN_EPOCHS,
                        BID_INTERVAL_IN_EPOCHS,
                        BUYOUT_STOP_THRESHOLD_PERCENTAGE
                    ], { from: owner, gas: 2000000 }),
                "{enableBuyout} : invalid token0Address",
            );
        });

        it("fails with invalid token2Address", async () => {
            await expectRevert(
                this.buyout.enableBuyout(
                    this.token0.address, constants.ZERO_ADDRESS, this.vault.address,
                    [
                        web3.utils.toWei(BUYOUT_START_THRESHOLD.toString(), "ether"),
                        BUYOUT_DURATION_IN_EPOCHS,
                        BID_INTERVAL_IN_EPOCHS,
                        BUYOUT_STOP_THRESHOLD_PERCENTAGE
                    ], { from: owner, gas: 2000000 }),
                "{enableBuyout} : invalid token2Address",
            );
            await expectRevert(
                this.buyout.enableBuyout(
                    this.token0.address, tester1, this.vault.address,
                    [
                        web3.utils.toWei(BUYOUT_START_THRESHOLD.toString(), "ether"),
                        BUYOUT_DURATION_IN_EPOCHS,
                        BID_INTERVAL_IN_EPOCHS,
                        BUYOUT_STOP_THRESHOLD_PERCENTAGE
                    ], { from: owner, gas: 2000000 }),
                "{enableBuyout} : invalid token2Address",
            );
        });

        it("fails with invalid vaultAddress", async () => {
            await expectRevert(
                this.buyout.enableBuyout(
                    this.token0.address, this.token2.address, constants.ZERO_ADDRESS,
                    [
                        web3.utils.toWei(BUYOUT_START_THRESHOLD.toString(), "ether"),
                        BUYOUT_DURATION_IN_EPOCHS,
                        BID_INTERVAL_IN_EPOCHS,
                        BUYOUT_STOP_THRESHOLD_PERCENTAGE
                    ], { from: owner, gas: 2000000 }),
                "{enableBuyout} : invalid vaultAddress",
            );
            await expectRevert(
                this.buyout.enableBuyout(
                    this.token0.address, this.token2.address, tester1,
                    [
                        web3.utils.toWei(BUYOUT_START_THRESHOLD.toString(), "ether"),
                        BUYOUT_DURATION_IN_EPOCHS,
                        BID_INTERVAL_IN_EPOCHS,
                        BUYOUT_STOP_THRESHOLD_PERCENTAGE
                    ], { from: owner, gas: 2000000 }),
                "{enableBuyout} : invalid vaultAddress",
            );
        });

        it("fails with invalid startThreshold", async () => {
            await expectRevert(
                this.buyout.enableBuyout(
                    this.token0.address, this.token2.address, this.vault.address,
                    [
                        0,
                        BUYOUT_DURATION_IN_EPOCHS,
                        BID_INTERVAL_IN_EPOCHS,
                        BUYOUT_STOP_THRESHOLD_PERCENTAGE
                    ], { from: owner, gas: 2000000 }),
                "{enableBuyout} : startThreshold cannot be zero",
            );
        });

        it("fails with invalid durationInEpochs", async () => {
            await expectRevert(
                this.buyout.enableBuyout(
                    this.token0.address, this.token2.address, this.vault.address,
                    [
                        web3.utils.toWei(BUYOUT_START_THRESHOLD.toString(), "ether"),
                        0,
                        BID_INTERVAL_IN_EPOCHS,
                        BUYOUT_STOP_THRESHOLD_PERCENTAGE
                    ], { from: owner, gas: 2000000 }),
                "{enableBuyout} : durationInEpochs cannot be zero",
            );
        });

        it("fails with invalid stopThresholdPercent", async () => {
            await expectRevert(
                this.buyout.enableBuyout(
                    this.token0.address, this.token2.address, this.vault.address,
                    [
                        web3.utils.toWei(BUYOUT_START_THRESHOLD.toString(), "ether"),
                        BUYOUT_DURATION_IN_EPOCHS,
                        BID_INTERVAL_IN_EPOCHS,
                        0
                    ], { from: owner, gas: 2000000 }),
                "{enableBuyout} : stopThresholdPercent should be between 1 and 100",
            );
            await expectRevert(
                this.buyout.enableBuyout(
                    this.token0.address, this.token2.address, this.vault.address,
                    [
                        web3.utils.toWei(BUYOUT_START_THRESHOLD.toString(), "ether"),
                        BUYOUT_DURATION_IN_EPOCHS,
                        BID_INTERVAL_IN_EPOCHS,
                        101
                    ], { from: owner, gas: 2000000 }),
                "{enableBuyout} : stopThresholdPercent should be between 1 and 100",
            );
        });

        it("configures buyout parameters correctly", async () => {
            assert.equal(await this.buyout.token0(), constants.ZERO_ADDRESS);
            assert.equal(await this.buyout.token2(), constants.ZERO_ADDRESS);
            assert.equal(await this.buyout.vault(), constants.ZERO_ADDRESS);
            expect(await this.buyout.startThreshold()).to.be.bignumber.equal("0");
            // verify durationInEpochs
            expect(await this.buyout.epochs(2)).to.be.bignumber.equal("0");
            // verify bidIntervalInEpochs
            expect(await this.buyout.epochs(3)).to.be.bignumber.equal("0");
            expect(await this.buyout.stopThresholdPercent()).to.be.bignumber.equal("0");
            await this.buyout.enableBuyout(
                this.token0.address, this.token2.address, this.vault.address,
                [
                    web3.utils.toWei(BUYOUT_START_THRESHOLD.toString(), "ether"),
                    BUYOUT_DURATION_IN_EPOCHS,
                    BID_INTERVAL_IN_EPOCHS,
                    BUYOUT_STOP_THRESHOLD_PERCENTAGE
                ], { from: owner, gas: 2000000 });
            assert.equal(await this.buyout.token0(), this.token0.address);
            assert.equal(await this.buyout.token2(), this.token2.address);
            assert.equal(await this.buyout.vault(), this.vault.address);
            // verify durationInEpochs
            expect(await this.buyout.epochs(2), BUYOUT_DURATION_IN_EPOCHS.toString());
            // verify bidIntervalInEpochs
            expect(await this.buyout.epochs(3), BID_INTERVAL_IN_EPOCHS.toString());
            expect(await this.buyout.stopThresholdPercent(), BUYOUT_STOP_THRESHOLD_PERCENTAGE.toString());
            // cannot enable again
            await expectRevert(
                this.buyout.enableBuyout(
                    this.token0.address, this.token2.address, this.vault.address,
                    [
                        web3.utils.toWei(BUYOUT_START_THRESHOLD.toString(), "ether"),
                        BUYOUT_DURATION_IN_EPOCHS,
                        BID_INTERVAL_IN_EPOCHS,
                        BUYOUT_STOP_THRESHOLD_PERCENTAGE
                    ], { from: owner, gas: 2000000 }),
                "{enableBuyout} : buyout has already been enabled",
            );
        });

    });

    describe("placeBid", () => {

        beforeEach(async () => {
            snapshotId = (await timeMachine.takeSnapshot())["result"];
        });

        afterEach(async() => {
            await timeMachine.revertToSnapshot(snapshotId);
        });

        it("updates storage correctly when bids are placed", async () => {
            let totalBidAmount = web3.utils.toWei("12000000", "ether");// 12M worth of token2
            let token2Amount = web3.utils.toWei("10800000", "ether");// 10.8M token2
            let token0Amount = web3.utils.toWei("1000000", "ether");// 1M token0
            expect(await this.buyout.requiredToken0ToBid(totalBidAmount, token2Amount)).to.be.bignumber.equal(token0Amount.toString());
            // owner mints 10.8M token2 to tester1
            await this.token2.mint(tester1, token2Amount, { from: owner, gas: 100000 });
            // tester1 approves 10.8M token2 to buyout contract
            await this.token2.approve(this.buyout.address, token2Amount, { from: tester1, gas: 100000 });
            // tester1 approves 1.2M Token0 to buyout contract
            await this.token0.approve(this.buyout.address, token0Amount, { from: tester1, gas: 100000 });
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
            await this.buyout.placeBid(totalBidAmount, token2Amount, { from: tester1, gas: 275000 });
            // validate state post-bid
            expect(await this.buyout.epochs(0)).to.be.bignumber.equal(currentEpoch(await time.latest()).toString());
            expect(await this.buyout.epochs(1)).to.be.bignumber.equal((currentEpoch(await time.latest())+BUYOUT_DURATION_IN_EPOCHS).toString());
            expect(await this.buyout.highestBidder()).equal(tester1);
            expect(await this.buyout.highestBidValues(0)).to.be.bignumber.equal(totalBidAmount.toString());
            expect(await this.buyout.highestBidValues(1)).to.be.bignumber.equal(token0Amount.toString());
            expect(await this.buyout.highestBidValues(2)).to.be.bignumber.equal(token2Amount.toString());
            expect(await this.token0.balanceOf(this.buyout.address)).to.be.bignumber.equal(token0Amount.toString());
            expect(await this.token2.balanceOf(this.buyout.address)).to.be.bignumber.equal(token2Amount.toString());
            expect(await this.token0.balanceOf(tester1)).to.be.bignumber.equal("0");
            expect(await this.token2.balanceOf(tester1)).to.be.bignumber.equal("0");
            // tester3 sends 0.5M Token0 to tester2
            await this.token0.transfer(tester2, web3.utils.toWei("500000", "ether"), { from: tester3, gas: 100000 });
            // tester4 sends 0.5M Token0 to tester2
            await this.token0.transfer(tester2, web3.utils.toWei("500000", "ether"), { from: tester4, gas: 100000 });
            // tester5 sends 0.5M Token0 to tester2
            await this.token0.transfer(tester2, web3.utils.toWei("500000", "ether"), { from: tester5, gas: 100000 });
            // tester6 sends 0.5M Token0 to tester2
            await this.token0.transfer(tester2, web3.utils.toWei("500000", "ether"), { from: tester6, gas: 100000 });
            // tester7 sends 0.5M Token0 to tester2
            await this.token0.transfer(tester2, web3.utils.toWei("500000", "ether"), { from: tester7, gas: 100000 });
            //// tester2 decides to outbid tester1
            totalBidAmount = web3.utils.toWei("20000000", "ether");// 20M worth of token2
            token2Amount = web3.utils.toWei("15000000", "ether");// 15M token2
            token0Amount = web3.utils.toWei("2500000", "ether");// 2.5M token0
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
            expect(await this.buyout.epochs(1)).to.be.bignumber.equal((currentEpoch(await time.latest())+BID_INTERVAL_IN_EPOCHS).toString());
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

    describe("stakeToken0ToStopBuyout", () => {

        beforeEach(async () => {
            snapshotId = (await timeMachine.takeSnapshot())["result"];
        });

        afterEach(async() => {
            await timeMachine.revertToSnapshot(snapshotId);
        });

        it("updates storage correctly when token0s are staked", async () => {
            let totalBidAmount = web3.utils.toWei("12000000", "ether");// 12M worth of token2
            let token2Amount = web3.utils.toWei("10800000", "ether");// 10.8M token2
            let token0Amount = web3.utils.toWei("1000000", "ether");// 1M token0
            // owner mints 10.8M token2 to tester1
            await this.token2.mint(tester1, token2Amount, { from: owner, gas: 100000 });
            // tester1 approves 10.8M token2 to buyout contract
            await this.token2.approve(this.buyout.address, token2Amount, { from: tester1, gas: 100000 });
            // tester1 approves 1.2M Token0 to buyout contract
            await this.token0.approve(this.buyout.address, token0Amount, { from: tester1, gas: 100000 });
            // tester1 places a bid
            await this.buyout.placeBid(totalBidAmount, token2Amount, { from: tester1, gas: 275000 });
            //// bid revokation begins
            token0Amount = web3.utils.toWei("500000", "ether");// 0.5M token0
            // tester2 approves 0.5M Token0 to buyout contract
            await this.token0.approve(this.buyout.address, token0Amount, { from: tester2, gas: 100000 });
            // tester2 stakes 0.5M token0 to stop bid
            await this.buyout.stakeToken0ToStopBuyout(token0Amount, { from: tester2, gas: 250000 });
            expect(await this.buyout.highestBidder()).equal(tester1);
            expect(await this.buyout.highestBidValues(0)).to.be.bignumber.equal(totalBidAmount.toString());
            expect(await this.buyout.highestBidValues(1)).to.be.bignumber.equal(ether("1000000"));
            expect(await this.buyout.highestBidValues(2)).to.be.bignumber.equal(token2Amount.toString());
            expect(await this.token2.balanceOf(this.buyout.address)).to.be.bignumber.equal(token2Amount.toString());
            expect(await this.token0.balanceOf(tester1)).to.be.bignumber.equal("0");
            expect(await this.token2.balanceOf(tester1)).to.be.bignumber.equal("0");
            expect(await this.buyout.totalToken0Staked()).to.be.bignumber.equal(ether("500000"));
            expect(await this.buyout.token0Staked(tester2)).to.be.bignumber.equal(token0Amount.toString());
            expect(await this.token0.balanceOf(this.buyout.address)).to.be.bignumber.equal(ether("1500000"));
            expect(await this.token0.balanceOf(tester2)).to.be.bignumber.equal("0");
            // tester3 approves 0.5M Token0 to buyout contract
            await this.token0.approve(this.buyout.address, token0Amount, { from: tester3, gas: 100000 });
            // tester3 stakes 0.5M token0 to stop bid
            await this.buyout.stakeToken0ToStopBuyout(token0Amount, { from: tester3, gas: 250000 });
            expect(await this.buyout.highestBidder()).equal(tester1);
            expect(await this.buyout.highestBidValues(0)).to.be.bignumber.equal(totalBidAmount.toString());
            expect(await this.buyout.highestBidValues(1)).to.be.bignumber.equal(ether("1000000"));
            expect(await this.buyout.highestBidValues(2)).to.be.bignumber.equal(token2Amount.toString());
            expect(await this.token2.balanceOf(this.buyout.address)).to.be.bignumber.equal(token2Amount.toString());
            expect(await this.token0.balanceOf(tester1)).to.be.bignumber.equal("0");
            expect(await this.token2.balanceOf(tester1)).to.be.bignumber.equal("0");
            expect(await this.buyout.totalToken0Staked()).to.be.bignumber.equal(ether("1000000"));
            expect(await this.buyout.token0Staked(tester3)).to.be.bignumber.equal(token0Amount.toString());
            expect(await this.token0.balanceOf(this.buyout.address)).to.be.bignumber.equal(ether("2000000"));
            expect(await this.token0.balanceOf(tester3)).to.be.bignumber.equal("0");
            // tester4 approves 0.5M Token0 to buyout contract
            await this.token0.approve(this.buyout.address, token0Amount, { from: tester4, gas: 100000 });
            // tester4 stakes 0.5M token0 to stop bid
            await this.buyout.stakeToken0ToStopBuyout(token0Amount, { from: tester4, gas: 250000 });
            expect(await this.buyout.highestBidder()).equal(tester1);
            expect(await this.buyout.highestBidValues(0)).to.be.bignumber.equal(totalBidAmount.toString());
            expect(await this.buyout.highestBidValues(1)).to.be.bignumber.equal(ether("1000000"));
            expect(await this.buyout.highestBidValues(2)).to.be.bignumber.equal(token2Amount.toString());
            expect(await this.token2.balanceOf(this.buyout.address)).to.be.bignumber.equal(token2Amount.toString());
            expect(await this.token0.balanceOf(tester1)).to.be.bignumber.equal("0");
            expect(await this.token2.balanceOf(tester1)).to.be.bignumber.equal("0");
            expect(await this.buyout.totalToken0Staked()).to.be.bignumber.equal(ether("1500000"));
            expect(await this.buyout.token0Staked(tester4)).to.be.bignumber.equal(token0Amount.toString());
            expect(await this.token0.balanceOf(this.buyout.address)).to.be.bignumber.equal(ether("2500000"));
            expect(await this.token0.balanceOf(tester4)).to.be.bignumber.equal("0");
            // tester5 approves 0.5M Token0 to buyout contract
            await this.token0.approve(this.buyout.address, token0Amount, { from: tester5, gas: 100000 });
            // tester5 stakes 0.5M token0 to stop bid
            await this.buyout.stakeToken0ToStopBuyout(token0Amount, { from: tester5, gas: 250000 });
            expect(await this.buyout.highestBidder()).equal(tester1);
            expect(await this.buyout.highestBidValues(0)).to.be.bignumber.equal(totalBidAmount.toString());
            expect(await this.buyout.highestBidValues(1)).to.be.bignumber.equal(ether("1000000"));
            expect(await this.buyout.highestBidValues(2)).to.be.bignumber.equal(token2Amount.toString());
            expect(await this.token2.balanceOf(this.buyout.address)).to.be.bignumber.equal(token2Amount.toString());
            expect(await this.token0.balanceOf(tester1)).to.be.bignumber.equal("0");
            expect(await this.token2.balanceOf(tester1)).to.be.bignumber.equal("0");
            expect(await this.buyout.totalToken0Staked()).to.be.bignumber.equal(ether("2000000"));
            expect(await this.buyout.token0Staked(tester5)).to.be.bignumber.equal(token0Amount.toString());
            expect(await this.token0.balanceOf(this.buyout.address)).to.be.bignumber.equal(ether("3000000"));
            expect(await this.token0.balanceOf(tester5)).to.be.bignumber.equal("0");
            // tester6 approves 0.5M Token0 to buyout contract
            await this.token0.approve(this.buyout.address, token0Amount, { from: tester6, gas: 100000 });
            // tester6 stakes 0.5M token0 to stop bid
            await this.buyout.stakeToken0ToStopBuyout(token0Amount, { from: tester6, gas: 250000 });
            expect(await this.buyout.highestBidder()).equal(constants.ZERO_ADDRESS);
            expect(await this.buyout.highestBidValues(0)).to.be.bignumber.equal("0");
            expect(await this.buyout.highestBidValues(1)).to.be.bignumber.equal("0");
            expect(await this.buyout.highestBidValues(2)).to.be.bignumber.equal("0");
            expect(await this.token2.balanceOf(this.buyout.address)).to.be.bignumber.equal("0");
            expect(await this.token0.balanceOf(tester1)).to.be.bignumber.equal(ether("1000000"));
            expect(await this.token2.balanceOf(tester1)).to.be.bignumber.equal(ether("10800000"));
            expect(await this.buyout.totalToken0Staked()).to.be.bignumber.equal("0");
            expect(await this.buyout.token0Staked(tester6)).to.be.bignumber.equal(token0Amount.toString());
            expect(await this.token0.balanceOf(this.buyout.address)).to.be.bignumber.equal(ether("2500000"));
            expect(await this.token0.balanceOf(tester6)).to.be.bignumber.equal("0");
        });

    });

    describe("withdrawStakedToken0", () => {

        beforeEach(async () => {
            snapshotId = (await timeMachine.takeSnapshot())["result"];
        });

        afterEach(async() => {
            await timeMachine.revertToSnapshot(snapshotId);
        });

        it("updates storage correctly when buyout is active and staked token0s are unstaked", async () => {
            let totalBidAmount = web3.utils.toWei("12000000", "ether");// 12M worth of token2
            let token2Amount = web3.utils.toWei("10800000", "ether");// 10.8M token2
            let token0Amount = web3.utils.toWei("1000000", "ether");// 1M token0
            // owner mints 10.8M token2 to tester1
            await this.token2.mint(tester1, token2Amount, { from: owner, gas: 100000 });
            // tester1 approves 10.8M token2 to buyout contract
            await this.token2.approve(this.buyout.address, token2Amount, { from: tester1, gas: 100000 });
            // tester1 approves 1.2M Token0 to buyout contract
            await this.token0.approve(this.buyout.address, token0Amount, { from: tester1, gas: 100000 });
            // tester1 places a bid
            await this.buyout.placeBid(totalBidAmount, token2Amount, { from: tester1, gas: 275000 });
            //// bid revokation begins
            token0Amount = web3.utils.toWei("500000", "ether");// 0.5M token0
            // tester2 approves 0.5M Token0 to buyout contract
            await this.token0.approve(this.buyout.address, token0Amount, { from: tester2, gas: 100000 });
            // tester2 stakes 0.5M token0 to stop bid
            await this.buyout.stakeToken0ToStopBuyout(token0Amount, { from: tester2, gas: 250000 });
            expect(await this.buyout.totalToken0Staked()).to.be.bignumber.equal(ether("500000"));
            expect(await this.buyout.token0Staked(tester2)).to.be.bignumber.equal(token0Amount.toString());
            expect(await this.token0.balanceOf(this.buyout.address)).to.be.bignumber.equal(ether("1500000"));
            expect(await this.token0.balanceOf(tester2)).to.be.bignumber.equal("0");
            // tester2 unstakes her staked token0s
            await this.buyout.withdrawStakedToken0({ from: tester2, gas: 250000 });
            expect(await this.buyout.totalToken0Staked()).to.be.bignumber.equal("0");
            expect(await this.buyout.token0Staked(tester2)).to.be.bignumber.equal("0");
            expect(await this.token0.balanceOf(this.buyout.address)).to.be.bignumber.equal(ether("1000000"));
            expect(await this.token0.balanceOf(tester2)).to.be.bignumber.equal(token0Amount.toString());
        });

    });

    describe("endBuyout", () => {

        let totalBidAmount = web3.utils.toWei("12000000", "ether");// 12M worth of token2
        let token2Amount = web3.utils.toWei("10800000", "ether");// 10.8M token2
        let token0Amount = web3.utils.toWei("1000000", "ether");// 1M token0

        beforeEach(async () => {
            snapshotId = (await timeMachine.takeSnapshot())["result"];
            // owner mints 10.8M token2 to tester1
            await this.token2.mint(tester1, token2Amount, { from: owner, gas: 100000 });
            // tester1 approves 10.8M token2 to buyout contract
            await this.token2.approve(this.buyout.address, token2Amount, { from: tester1, gas: 100000 });
            // tester1 approves 1.2M Token0 to buyout contract
            await this.token0.approve(this.buyout.address, token0Amount, { from: tester1, gas: 100000 });
        });

        afterEach(async() => {
            await timeMachine.revertToSnapshot(snapshotId);
        });

        it("fails if currentEpoch has not surpassed endEpoch", async () => {
            // tester1 places a bid
            await this.buyout.placeBid(totalBidAmount, token2Amount, { from: tester1, gas: 275000 });
            await expectRevert(
                this.buyout.endBuyout({ from: owner, gas: 2000000 }),
                "{endBuyout} : end epoch has not yet been reached",
            );
        });

        it("fails if no bid was placed at all", async () => {
            await expectRevert(
                this.buyout.endBuyout({ from: owner, gas: 2000000 }),
                "{endBuyout} : buyout does not have highestBidder",
            );
        });

        it("updates storage correctly when successful", async () => {
            // tester1 places a bid
            await this.buyout.placeBid(totalBidAmount, token2Amount, { from: tester1, gas: 275000 });
            // time travel to end epoch
            let currentEpochValue = currentEpoch(await time.latest());
            let endEpochValue = (await this.buyout.epochs(1)).toNumber();
            let epochDiff = endEpochValue > currentEpochValue ? endEpochValue - currentEpochValue : currentEpochValue;
            let endTimestamp = EPOCH_PERIOD * epochDiff;
            await timeMachine.advanceTimeAndBlock(endTimestamp+EPOCH_PERIOD);
            let redeemAddress = await this.buyout.redemption();
            assert.equal(redeemAddress, constants.ZERO_ADDRESS);
            assert.equal(this.buyout.address, await this.vault.owner());
            expect(await this.token0.balanceOf(this.buyout.address)).to.be.bignumber.equal(token0Amount.toString());
            expect(await this.token2.balanceOf(this.buyout.address)).to.be.bignumber.equal(token2Amount.toString());
            await this.buyout.endBuyout({ from: owner, gas: 2000000 });
            redeemAddress = await this.buyout.redemption();
            assert.notEqual(redeemAddress, constants.ZERO_ADDRESS);
            assert.equal(tester1, await this.vault.owner());
            expect(await this.token0.balanceOf(this.buyout.address)).to.be.bignumber.equal("0");
            expect(await this.token2.balanceOf(this.buyout.address)).to.be.bignumber.equal("0");
            expect(await this.token2.balanceOf(redeemAddress)).to.be.bignumber.equal(token2Amount.toString());
        });

    });

});
