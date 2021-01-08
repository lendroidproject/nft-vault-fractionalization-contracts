const timeMachine = require("ganache-time-traveler");

const { BN, constants, time, ether, expectEvent, expectRevert } = require("@openzeppelin/test-helpers");

const { expect } = require("chai");

const Diamond = artifacts.require("AppDiamond");
const DiamondCutFacet = artifacts.require("DiamondCutFacet");
const DiamondLoupeFacet = artifacts.require("DiamondLoupeFacet");
const OwnershipFacet = artifacts.require("OwnershipFacet");

const VaultFacet = artifacts.require("VaultFacet");
const MarketFacet = artifacts.require("MarketFacet");

const Token0 = artifacts.require("MockToken0");
const Token1 = artifacts.require("MockToken1");
const SimpleWallet = artifacts.require("MockSimpleWallet");

// const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const INDIVIDUAL_CAP = 2999;
const TOTAL_CAP = 10 * (10 ** 6);// 10 million
const TOKEN_0_PRICE_PER_TOKEN_1 = 0.25;

contract("Market", (accounts) => {

    const owner = accounts[0];
    const tester1 = accounts[1];

    this.currentTime = null;

    this.diamond = null;
    this.diamondCutFacet = null;
    this.diamondLoupeFacet = null;
    this.ownershipFacet = null;

    this.vaultFacet = null;

    this.marketFacet = null;
    this.marketStart = null;
    this.marketEnd = null;

    this.token0 = null;
    this.token1 = null;
    this.fundsWallet = null;

    before(async () => {
        this.diamond = await Diamond.deployed();
        this.diamondCutFacet = new web3.eth.Contract(DiamondCutFacet.abi, this.diamond.address);
        this.diamondLoupeFacet = new web3.eth.Contract(DiamondLoupeFacet.abi, this.diamond.address);
        this.ownershipFacet = new web3.eth.Contract(OwnershipFacet.abi, this.diamond.address);

        this.vaultFacet = new web3.eth.Contract(VaultFacet.abi, this.diamond.address);

        this.marketFacet = new web3.eth.Contract(MarketFacet.abi, this.diamond.address);
        this.token0 = await Token0.deployed();
        this.token1 = await Token1.deployed();
        this.fundsWallet = await SimpleWallet.deployed();

        // lock vault
        await this.vaultFacet.methods.lockVault().send({ from: owner, gas: 50000 });
    });

    beforeEach(async () => {
        this.currentTime = await time.latest();
        this.marketStart = this.currentTime.add(new BN(1209600));// 2 weeks from currentTime
        this.marketEnd = this.marketStart.add(new BN(1209600));// 2 weeks from marketStart
    });

    describe("createMarket", () => {

        after(async () => {
            await time.increaseTo(this.marketStart.add(new BN(1)));// 1 second from marketStart
        });

        it("deploys with owner", async () => {
            assert.equal(owner, await this.ownershipFacet.methods.owner().call(), "owner is not deployer");
        });

        it("cannot be called by non-owner", async () => {
            await expectRevert(
                this.marketFacet.methods.createMarket(
                    this.token0.address, this.token1.address, this.fundsWallet.address,
                    [
                        this.marketStart.toNumber(), this.marketEnd.toNumber(),
                        web3.utils.toWei(INDIVIDUAL_CAP.toString(), "ether"),
                        web3.utils.toWei(TOTAL_CAP.toString(), "ether"),
                        web3.utils.toWei(TOKEN_0_PRICE_PER_TOKEN_1.toString(), "ether")
                    ]
                ).send({ from: tester1, gas: 2000000 }),
                "{AppStorage} : 403",
            );
        });

        it("configures market parameters correctly", async () => {
            assert.equal(await this.marketFacet.methods.token0().call(), constants.ZERO_ADDRESS);
            assert.equal(await this.marketFacet.methods.fundsWallet().call(), constants.ZERO_ADDRESS);
            expect(await this.marketFacet.methods.marketStart().call()).to.be.bignumber.equal("0");
            expect(await this.marketFacet.methods.marketEnd().call()).to.be.bignumber.equal("0");
            expect(await this.marketFacet.methods.individualCap().call()).to.be.bignumber.equal("0");
            expect(await this.marketFacet.methods.totalCap().call()).to.be.bignumber.equal("0");
            expect(await this.marketFacet.methods.token0PerToken1().call()).to.be.bignumber.equal("0");
            expect(await this.marketFacet.methods.totalBuyers().call()).to.be.bignumber.equal("0");
            assert.equal(await this.marketFacet.methods.marketClosed().call(), false);
            await this.marketFacet.methods.createMarket(
                this.token0.address, this.token1.address, this.fundsWallet.address,
                [
                    this.marketStart.toNumber(), this.marketEnd.toNumber(),
                    web3.utils.toWei(INDIVIDUAL_CAP.toString(), "ether"),
                    web3.utils.toWei(TOTAL_CAP.toString(), "ether"),
                    web3.utils.toWei(TOKEN_0_PRICE_PER_TOKEN_1.toString(), "ether")
                ]
            ).send({ from: owner, gas: 2000000 });
            assert.equal(await this.marketFacet.methods.token0().call(), this.token0.address);
            assert.equal(await this.marketFacet.methods.fundsWallet().call(), this.fundsWallet.address);
            expect(await this.marketFacet.methods.marketStart().call()).to.be.bignumber.equal(this.marketStart.toString());
            expect(await this.marketFacet.methods.marketEnd().call()).to.be.bignumber.equal(this.marketEnd.toString());
            expect(await this.marketFacet.methods.individualCap().call()).to.be.bignumber.equal(ether(INDIVIDUAL_CAP.toString()));
            expect(await this.marketFacet.methods.totalCap().call()).to.be.bignumber.equal(ether(TOTAL_CAP.toString()));
            expect(await this.marketFacet.methods.token0PerToken1().call()).to.be.bignumber.equal(ether(TOKEN_0_PRICE_PER_TOKEN_1.toString()));
            expect(await this.marketFacet.methods.totalBuyers().call()).to.be.bignumber.equal("0");
            assert.equal(await this.marketFacet.methods.marketClosed().call(), false);
            // cannot createMarket again
            await expectRevert(
                this.marketFacet.methods.createMarket(
                    this.token0.address, this.token1.address, this.fundsWallet.address,
                    [
                        this.marketStart.toNumber(), this.marketEnd.toNumber(),
                        web3.utils.toWei(INDIVIDUAL_CAP.toString(), "ether"),
                        web3.utils.toWei(TOTAL_CAP.toString(), "ether"),
                        web3.utils.toWei(TOKEN_0_PRICE_PER_TOKEN_1.toString(), "ether")
                    ]
                ).send({ from: owner, gas: 2000000 }),
                "{createMarket} : app mode is not VAULT_LOCKED",
            );
        });

    });

    describe("pay", () => {

        let token1Amount = web3.utils.toWei("1000", "ether");

        beforeEach(async() => {
            snapshotId = (await timeMachine.takeSnapshot())["result"];
        });

        afterEach(async() => {
            await timeMachine.revertToSnapshot(snapshotId);
        });

        it("succeeds", async () => {
            expect(await this.marketFacet.methods.totalBuyers().call()).to.be.bignumber.equal("0");
            expect(await this.marketFacet.methods.totaltoken1Paid().call()).to.be.bignumber.equal("0");
            expect(await this.token0.balanceOf(this.fundsWallet.address)).to.be.bignumber.equal("0");
            // owner mints 1000 Token1 to tester1
            await this.token1.mint(tester1, token1Amount, { from: owner, gas: 1000000 });
            expect(await this.token1.balanceOf(tester1)).to.be.bignumber.equal(token1Amount);
            // tester1 approves 1000 Token1 to app
            await this.token1.approve(this.diamond.address, token1Amount, { from: tester1, gas: 1000000 });
            // tester1 pays 1000 Token1
            const { transactionHash } = await this.marketFacet.methods.pay(token1Amount).send({from: tester1, gas: 2500000});
            await expectEvent.inTransaction(transactionHash, this.marketFacet,
                "PaymentReceived", {
                    buyer: tester1,
                    amount: token1Amount,
                });
            expect(await this.marketFacet.methods.totalBuyers().call()).to.be.bignumber.equal("1");
            expect(await this.marketFacet.methods.buyers(0).call()).to.be.equal(tester1);
            expect(await this.marketFacet.methods.totaltoken1Paid().call()).to.be.bignumber.equal(token1Amount);
            expect(await this.token1.balanceOf(this.fundsWallet.address)).to.be.bignumber.equal(token1Amount);
            let buyer = await this.marketFacet.methods.payments(tester1).call();
            expect(buyer.token1Amount).to.be.bignumber.equal(token1Amount);
            expect(buyer.token0Withdrawn).to.be.equal(false);
        });

        it("fails when contribution amount is 0", async () => {
            await expectRevert(
                this.marketFacet.methods.pay(web3.utils.toWei("0", "ether")).send({from: tester1, gas: 2000000}),
                "{pay} : token1Amount cannot be zero",
            );
        });

        it("fails if trying to contribute after end time", async () => {
            // owner mints 1000 Token1 to tester1
            await this.token1.mint(tester1, token1Amount, { from: owner, gas: 1000000 });
            expect(await this.token1.balanceOf(tester1)).to.be.bignumber.equal(token1Amount);
            // tester1 approves 1000 Token1 to app
            await this.token1.approve(this.diamond.address, token1Amount, { from: tester1, gas: 1000000 });
            // reverse time to before start time
            await time.increaseTo(this.marketEnd+1);
            await expectRevert(
                this.marketFacet.methods.pay(token1Amount).send({from: tester1, gas: 2500000}),
                "{MarketFacet} : market is not active",
            );
        });
    });

});
