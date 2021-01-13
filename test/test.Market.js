const timeMachine = require("ganache-time-traveler");

const { BN, constants, time, ether, expectRevert } = require("@openzeppelin/test-helpers");

const { expect } = require("chai");

const Market = artifacts.require("SimpleMarket");

const Token0 = artifacts.require("MockToken0");
const Token1 = artifacts.require("MockToken1");
const SimpleWallet = artifacts.require("MockSimpleWallet");

// const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const TOTAL_CAP = 576000;
const TOKEN_0_PRICE_IN_TOKEN_1 = 0.36;// 1 Token0 = 0.36 Token1

contract("SimpleMarket", (accounts) => {

    const owner = accounts[0];
    const tester1 = accounts[1];
    const tester2 = accounts[2];

    this.currentTime = null;

    this.market = null;
    this.marketStart = null;

    this.token0 = null;
    this.token1 = null;
    this.fundsWallet = null;

    before(async () => {
        this.market = await Market.deployed();
        this.token0 = await Token0.deployed();
        this.token1 = await Token1.deployed();
        this.fundsWallet = await SimpleWallet.deployed();
    });

    beforeEach(async () => {
        this.currentTime = await time.latest();
        this.marketStart = this.currentTime.add(new BN(1209600));// 2 weeks from currentTime
    });

    describe("createMarket", () => {

        after(async () => {
            await time.increaseTo(this.marketStart.add(new BN(1)));// 1 second from marketStart
        });

        it("deploys with owner", async () => {
            assert.equal(owner, await this.market.owner(), "owner is not deployer");
        });

        it("cannot be called by non-owner", async () => {
            await expectRevert(
                this.market.createMarket(
                    this.token0.address, this.token1.address, this.fundsWallet.address,
                    [
                        this.marketStart.toNumber(),
                        web3.utils.toWei(TOTAL_CAP.toString(), "ether"),
                        web3.utils.toWei(TOKEN_0_PRICE_IN_TOKEN_1.toString(), "ether")
                    ], { from: tester1, gas: 2000000 }),
                "Ownable: caller is not the owner.",
            );
        });

        it("configures market parameters correctly", async () => {
            assert.equal(await this.market.token0(), constants.ZERO_ADDRESS);
            assert.equal(await this.market.fundsWallet(), constants.ZERO_ADDRESS);
            expect(await this.market.marketStart()).to.be.bignumber.equal("0");
            expect(await this.market.totalCap()).to.be.bignumber.equal("0");
            expect(await this.market.token1PerToken0()).to.be.bignumber.equal("0");
            expect(await this.market.totalBuyers()).to.be.bignumber.equal("0");
            assert.equal(await this.market.marketClosed(), false);
            await this.market.createMarket(
                this.token0.address, this.token1.address, this.fundsWallet.address,
                [
                    this.marketStart.toNumber(),
                    web3.utils.toWei(TOTAL_CAP.toString(), "ether"),
                    web3.utils.toWei(TOKEN_0_PRICE_IN_TOKEN_1.toString(), "ether")
                ], { from: owner, gas: 2000000 });
            assert.equal(await this.market.token0(), this.token0.address);
            assert.equal(await this.market.fundsWallet(), this.fundsWallet.address);
            expect(await this.market.marketStart()).to.be.bignumber.equal(this.marketStart.toString());
            expect(await this.market.totalCap()).to.be.bignumber.equal(ether(TOTAL_CAP.toString()));
            expect(await this.market.token1PerToken0()).to.be.bignumber.equal(ether(TOKEN_0_PRICE_IN_TOKEN_1.toString()));
            expect(await this.market.totalBuyers()).to.be.bignumber.equal("0");
            assert.equal(await this.market.marketClosed(), false);
            // cannot createMarket again
            await expectRevert(
                this.market.createMarket(
                    this.token0.address, this.token1.address, this.fundsWallet.address,
                    [
                        this.marketStart.toNumber(),
                        web3.utils.toWei(TOTAL_CAP.toString(), "ether"),
                        web3.utils.toWei(TOKEN_0_PRICE_IN_TOKEN_1.toString(), "ether")
                    ], { from: owner, gas: 2000000 }),
                "{createMarket} : market has already been created",
            );
        });

    });

    describe("pay", () => {

        beforeEach(async() => {
            snapshotId = (await timeMachine.takeSnapshot())["result"];
        });

        afterEach(async() => {
            await timeMachine.revertToSnapshot(snapshotId);
        });

        it("succeeds", async () => {
            expect(await this.market.totalBuyers()).to.be.bignumber.equal("0");
            expect(await this.market.totaltoken1Paid()).to.be.bignumber.equal("0");
            expect(await this.token0.balanceOf(this.fundsWallet.address)).to.be.bignumber.equal("0");
            let token1Amount = web3.utils.toWei("1000", "ether");
            // owner mints 1000 Token1 to tester1
            await this.token1.mint(tester1, token1Amount, { from: owner, gas: 1000000 });
            expect(await this.token1.balanceOf(tester1)).to.be.bignumber.equal(token1Amount);
            // tester1 approves 1000 Token1 to app
            await this.token1.approve(this.market.address, token1Amount, { from: tester1, gas: 1000000 });
            // tester1 pays 1000 Token1
            await this.market.pay(token1Amount, {from: tester1, gas: 2500000});
            expect(await this.market.totalBuyers()).to.be.bignumber.equal("1");
            expect(await this.market.buyers(0)).to.be.equal(tester1);
            expect(await this.market.totaltoken1Paid()).to.be.bignumber.equal(token1Amount);
            expect(await this.token1.balanceOf(this.fundsWallet.address)).to.be.bignumber.equal(token1Amount);
            let buyer = await this.market.payments(tester1);
            expect(buyer.token1Amount).to.be.bignumber.equal(token1Amount);
            expect(buyer.token0Withdrawn).to.be.equal(false);
        });

        it("fails when contribution amount is 0", async () => {
            await expectRevert(
                this.market.pay(web3.utils.toWei("0", "ether"), {from: tester1, gas: 2000000}),
                "{pay} : token1Amount cannot be zero",
            );
        });

        it("fails if contribution amount exceeds totatlCap", async () => {
            // owner mints 300K Token1 to tester1
            let token1Amount = web3.utils.toWei("300000", "ether");
            await this.token1.mint(tester1, token1Amount, { from: owner, gas: 1000000 });
            expect(await this.token1.balanceOf(tester1)).to.be.bignumber.equal(token1Amount);
            // tester1 approves 300K Token1 to app
            await this.token1.approve(this.market.address, token1Amount, { from: tester1, gas: 1000000 });
            // owner mints 300K Token1 to tester2
            await this.token1.mint(tester2, token1Amount, { from: owner, gas: 1000000 });
            expect(await this.token1.balanceOf(tester2)).to.be.bignumber.equal(token1Amount);
            // tester2 approves 300K Token1 to app
            await this.token1.approve(this.market.address, token1Amount, { from: tester2, gas: 1000000 });
            // tester1 pays 150K Token1 to app
            await this.market.pay(web3.utils.toWei("150000", "ether"), {from: tester1, gas: 2500000});
            expect(await this.token1.balanceOf(this.fundsWallet.address)).to.be.bignumber.equal(web3.utils.toWei("150000", "ether"));
            // tester2 pays 150K Token1 to app
            await this.market.pay(web3.utils.toWei("150000", "ether"), {from: tester2, gas: 2500000});
            expect(await this.token1.balanceOf(this.fundsWallet.address)).to.be.bignumber.equal(web3.utils.toWei("300000", "ether"));
            // tester1 pays 150K Token1 to app
            await this.market.pay(web3.utils.toWei("150000", "ether"), {from: tester1, gas: 2500000});
            expect(await this.token1.balanceOf(this.fundsWallet.address)).to.be.bignumber.equal(web3.utils.toWei("450000", "ether"));
            // fails when tester2 tries to pay 150K Token1 to app
            await expectRevert(
                this.market.pay(web3.utils.toWei("150000", "ether"), {from: tester2, gas: 2500000}),
                "{pay} : token1Amount cannot exceed totalCap",
            );
        });
    });

    describe("closeMarket", () => {

        beforeEach(async() => {
            snapshotId = (await timeMachine.takeSnapshot())["result"];
        });

        afterEach(async() => {
            await timeMachine.revertToSnapshot(snapshotId);
        });

        it("succeeds", async () => {
            // owner mints 300K Token1 to tester1
            let token1Amount = web3.utils.toWei("300000", "ether");
            await this.token1.mint(tester1, token1Amount, { from: owner, gas: 1000000 });
            // tester1 approves 300K Token1 to app
            await this.token1.approve(this.market.address, token1Amount, { from: tester1, gas: 1000000 });
            // owner mints 300K Token1 to tester2
            await this.token1.mint(tester2, token1Amount, { from: owner, gas: 1000000 });
            // tester2 approves 300K Token1 to app
            await this.token1.approve(this.market.address, token1Amount, { from: tester2, gas: 1000000 });
            // tester1 pays 150K Token1 to app
            await this.market.pay(web3.utils.toWei("150000", "ether"), {from: tester1, gas: 2500000});
            // tester2 pays 150K Token1 to app
            await this.market.pay(web3.utils.toWei("150000", "ether"), {from: tester2, gas: 2500000});
            // tester1 pays 150K Token1 to app
            await this.market.pay(web3.utils.toWei("150000", "ether"), {from: tester1, gas: 2500000});
            // tester2 pays 150K Token1 to app
            await this.market.pay(web3.utils.toWei("126000", "ether"), {from: tester2, gas: 2500000});
            // owner mints 1.6M Token0 to owner
            await this.token0.mint(owner, web3.utils.toWei("1600000", "ether"), { from: owner, gas: 1000000 });
            // tester1 approves 1.5M Token0 to app
            await this.token0.approve(this.market.address, web3.utils.toWei("1500000", "ether"), { from: owner, gas: 1000000 });
            // owner tries to close the market without sufficient token0 approval
            await expectRevert(
                this.market.closeMarket({from: owner, gas: 100000}),
                "ERC20: transfer amount exceeds allowance",
            );
            // tester1 approves 1.6M Token0 to app
            await this.token0.approve(this.market.address, web3.utils.toWei("1600000", "ether"), { from: owner, gas: 1000000 });
            // owner successfully closes the market
            await this.market.closeMarket({from: owner, gas: 100000});
            expect(await this.token0.balanceOf(this.market.address)).to.be.bignumber.equal(web3.utils.toWei("1600000", "ether"));
        });

        it("works even if totaltoken1Paid is 0", async () => {
            expect(await this.market.totaltoken1Paid()).to.be.bignumber.equal("0");
            await this.market.closeMarket({from: owner, gas: 100000});
            expect(await this.token0.balanceOf(this.market.address)).to.be.bignumber.equal("0");
        });

        it("fails if called by non-owner", async () => {
            await expectRevert(
                this.market.closeMarket({from: tester1, gas: 100000}),
                "Ownable: caller is not the owner.",
            );
        });

        it("fails if called more than once", async () => {
            await this.market.closeMarket({from: owner, gas: 100000});
            await expectRevert(
                this.market.closeMarket({from: owner, gas: 100000}),
                "{closeMarket} : marketStatus is not OPEN",
            );
        });
    });

});
