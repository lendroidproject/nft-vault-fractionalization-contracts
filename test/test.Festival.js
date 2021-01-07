const timeMachine = require("ganache-time-traveler");

const { BN, constants, balance, time, ether, expectEvent, expectRevert } = require("@openzeppelin/test-helpers");

const { expect } = require("chai");

const Diamond = artifacts.require("FestivalDiamond");
const DiamondCutFacet = artifacts.require("DiamondCutFacet");
const DiamondLoupeFacet = artifacts.require("DiamondLoupeFacet");
const OwnershipFacet = artifacts.require("OwnershipFacet");

const FestivalFacet = artifacts.require("FestivalFacet");

const FestivalToken = artifacts.require("MockFestivalToken");
const SimpleWallet = artifacts.require("MockSimpleWallet");

// const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const INDIVIDUAL_CAP_IN_ETH = 2;
const TOTAL_CAP_IN_ETH = 1500;
const FESTIVAL_TOKEN_PRICE_IN_ETH = 0.00041;

contract("Festival", (accounts) => {

    const owner = accounts[0];
    const tester1 = accounts[1];

    this.currentTime = null;

    this.diamond = null;
    this.diamondCutFacet = null;
    this.diamondLoupeFacet = null;
    this.ownershipFacet = null;

    this.festivalFacet = null;
    this.festivalStartTime = null;
    this.festivalEndTime = null;

    this.festivalToken = null;
    this.fundsWallet = null;
    this.fundsTracker = null;

    beforeEach(async () => {
        this.diamond = await Diamond.deployed();
        this.diamondCutFacet = new web3.eth.Contract(DiamondCutFacet.abi, this.diamond.address);
        this.diamondLoupeFacet = new web3.eth.Contract(DiamondLoupeFacet.abi, this.diamond.address);
        this.ownershipFacet = new web3.eth.Contract(OwnershipFacet.abi, this.diamond.address);
        this.festivalFacet = new web3.eth.Contract(FestivalFacet.abi, this.diamond.address);
        this.festivalToken = await FestivalToken.deployed();
        this.fundsWallet = await SimpleWallet.deployed();
        this.fundsTracker = await balance.tracker(this.fundsWallet.address);

        this.currentTime = await time.latest();
        this.festivalStartTime = this.currentTime.add(new BN(1209600));// 2 weeks from currentTime
        this.festivalEndTime = this.festivalStartTime.add(new BN(1209600));// 2 weeks from festivalStartTime

    });

    describe("configuration", () => {

        after(async () => {
            await time.increaseTo(this.festivalStartTime.add(new BN(1)));// 1 second from festivalStartTime
        });

        it("deploys with owner", async () => {
            assert.equal(owner, await this.ownershipFacet.methods.owner().call(), "owner is not deployer");
        });

        it("cannot be configured by non-owner", async () => {
            await expectRevert(
                this.festivalFacet.methods.configure(
                    this.festivalToken.address, this.fundsWallet.address,
                    [
                        this.festivalStartTime.toNumber(), this.festivalEndTime.toNumber(),
                        web3.utils.toWei(INDIVIDUAL_CAP_IN_ETH.toString(), "ether"),
                        web3.utils.toWei(TOTAL_CAP_IN_ETH.toString(), "ether"),
                        web3.utils.toWei(FESTIVAL_TOKEN_PRICE_IN_ETH.toString(), "ether")
                    ]
                ).send({ from: tester1, gas: 2000000 }),
                "LibAppStorage: 403",
            );
        });

        it("configures correctly", async () => {
            assert.equal(await this.festivalFacet.methods.shardToken().call(), constants.ZERO_ADDRESS);
            assert.equal(await this.festivalFacet.methods.fundsWallet().call(), constants.ZERO_ADDRESS);
            expect(await this.festivalFacet.methods.startTimestamp().call()).to.be.bignumber.equal("0");
            expect(await this.festivalFacet.methods.endTimestamp().call()).to.be.bignumber.equal("0");
            expect(await this.festivalFacet.methods.individualCapInWei().call()).to.be.bignumber.equal("0");
            expect(await this.festivalFacet.methods.totalCapInWei().call()).to.be.bignumber.equal("0");
            expect(await this.festivalFacet.methods.shardPerWeiContributed().call()).to.be.bignumber.equal("0");
            expect(await this.festivalFacet.methods.totalContributors().call()).to.be.bignumber.equal("0");
            assert.equal(await this.festivalFacet.methods.shardIssuanceActivated().call(), false);
            await this.festivalFacet.methods.configure(
                this.festivalToken.address, this.fundsWallet.address,
                [
                    this.festivalStartTime.toNumber(), this.festivalEndTime.toNumber(),
                    web3.utils.toWei(INDIVIDUAL_CAP_IN_ETH.toString(), "ether"),
                    web3.utils.toWei(TOTAL_CAP_IN_ETH.toString(), "ether"),
                    web3.utils.toWei(FESTIVAL_TOKEN_PRICE_IN_ETH.toString(), "ether")
                ]
            ).send({ from: owner, gas: 2000000 });
            assert.equal(await this.festivalFacet.methods.shardToken().call(), this.festivalToken.address);
            assert.equal(await this.festivalFacet.methods.fundsWallet().call(), this.fundsWallet.address);
            expect(await this.festivalFacet.methods.startTimestamp().call()).to.be.bignumber.equal(this.festivalStartTime.toString());
            expect(await this.festivalFacet.methods.endTimestamp().call()).to.be.bignumber.equal(this.festivalEndTime.toString());
            expect(await this.festivalFacet.methods.individualCapInWei().call()).to.be.bignumber.equal(ether(INDIVIDUAL_CAP_IN_ETH.toString()));
            expect(await this.festivalFacet.methods.totalCapInWei().call()).to.be.bignumber.equal(ether(TOTAL_CAP_IN_ETH.toString()));
            expect(await this.festivalFacet.methods.shardPerWeiContributed().call()).to.be.bignumber.equal(ether(FESTIVAL_TOKEN_PRICE_IN_ETH.toString()));
            expect(await this.festivalFacet.methods.totalContributors().call()).to.be.bignumber.equal("0");
            assert.equal(await this.festivalFacet.methods.shardIssuanceActivated().call(), false);
            // cannot configure again
            await expectRevert(
                this.festivalFacet.methods.configure(
                    this.festivalToken.address, this.fundsWallet.address,
                    [
                        this.festivalStartTime.toNumber(), this.festivalEndTime.toNumber(),
                        web3.utils.toWei(INDIVIDUAL_CAP_IN_ETH.toString(), "ether"),
                        web3.utils.toWei(TOTAL_CAP_IN_ETH.toString(), "ether"),
                        web3.utils.toWei(FESTIVAL_TOKEN_PRICE_IN_ETH.toString(), "ether")
                    ]
                ).send({ from: owner, gas: 2000000 }),
                "Application has been configured",
            );
        });

    });

    describe("contributeWei", () => {

        let contributionAmount = web3.utils.toWei("0.01", "ether");

        beforeEach(async() => {
            snapshotId = (await timeMachine.takeSnapshot())["result"];
        });

        afterEach(async() => {
            await timeMachine.revertToSnapshot(snapshotId);
        });

        it("succeeds", async () => {
            expect(await this.festivalFacet.methods.totalContributors().call()).to.be.bignumber.equal("0");
            expect(await this.festivalFacet.methods.totalWeiContributed().call()).to.be.bignumber.equal("0");
            expect(await this.fundsTracker.get()).to.be.bignumber.equal("0");
            // tester1 contributes .01 ETH
            const { transactionHash } = await this.festivalFacet.methods.contributeWei().send({from: tester1, value: contributionAmount, gas: 1200000});
            await expectEvent.inTransaction(transactionHash, this.festivalFacet,
                "ContributionReceived", {
                    contributor: tester1,
                    amount: contributionAmount,
                });
            await expectEvent.inTransaction(transactionHash, this.fundsWallet,
                "ValueReceived", {
                    amount: contributionAmount
                });
            expect(await this.festivalFacet.methods.totalContributors().call()).to.be.bignumber.equal("1");
            expect(await this.festivalFacet.methods.contributors(0).call()).to.be.equal(tester1);
            expect(await this.festivalFacet.methods.totalWeiContributed().call()).to.be.bignumber.equal(contributionAmount);
            expect(await this.fundsTracker.get()).to.be.bignumber.equal(contributionAmount);
            let contributorInfo = await this.festivalFacet.methods.contributions(tester1).call();
            expect(contributorInfo.weiContributed).to.be.bignumber.equal(contributionAmount);
            expect(contributorInfo.hasWithdrawn).to.be.equal(false);
        });

        it("fails when contribution amount is 0", async () => {
            await expectRevert(
                this.festivalFacet.methods.contributeWei().send({from: tester1, value: 0, gas: 2000000}),
                "Contribution amount cannot be zero",
            );
        });

        it("fails if trying to contribute after end time", async () => {
            // reverse time to before start time
            await time.increaseTo(this.festivalEndTime+1);
            await expectRevert(
                this.festivalFacet.methods.contributeWei().send({from: tester1, value: contributionAmount, gas: 2000000}),
                "Event is not active",
            );
        });
    });

});
