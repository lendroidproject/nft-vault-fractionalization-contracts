const timeMachine = require("ganache-time-traveler");

const { time, ether } = require("@openzeppelin/test-helpers");

const { expect } = require("chai");

contract("Festival", (accounts) => {

    const START_TIME = 1613260800;// feb 14, 12am GMT
    const END_TIME = 1614556800;// mar 1, 12am GMT
    const INDIVIDUAL_CAP_IN_ETH = 2;
    const TOTAL_CAP_IN_ETH = 1500;
    const FESTIVAL_TOKEN_PRICE_IN_ETH = 0.00041;

    const MockFestival = artifacts.require("MockFestival");
    const MockFestivalToken = artifacts.require("MockFestivalToken");
    const SimpleWallet = artifacts.require("SimpleWallet");

    const owner = accounts[0];

    this.festival = null;

    beforeEach(async () => {
        this.festival = await MockFestival.deployed();
        this.festivalToken = await MockFestivalToken.deployed();
        this.fundsWallet = await SimpleWallet.deployed();
    });

    describe("constructor", () => {

        it("deploys with owner", async () => {
            assert.equal(owner, await this.festival.owner(), "owner is not deployer");
        });

        it("initializes correctly", async () => {
            assert.equal(await this.festival.shardToken(), this.festivalToken.address, "shardToken cannot be zero address");
            assert.equal(await this.festival.fundsWallet(), this.fundsWallet.address, "fundsWallet cannot be zero address");
            expect(await this.festival.startTimestamp()).to.be.bignumber.equal(START_TIME.toString());
            expect(await this.festival.endTimestamp()).to.be.bignumber.equal(END_TIME.toString());
            expect(await this.festival.individualCapInWei()).to.be.bignumber.equal(ether(INDIVIDUAL_CAP_IN_ETH.toString()));
            expect(await this.festival.totalCapInWei()).to.be.bignumber.equal(ether(TOTAL_CAP_IN_ETH.toString()));
            expect(await this.festival.shardPerWeiContributed()).to.be.bignumber.equal(ether(FESTIVAL_TOKEN_PRICE_IN_ETH.toString()));
        });

    });

});
