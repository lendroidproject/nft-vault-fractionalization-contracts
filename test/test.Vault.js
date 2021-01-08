const timeMachine = require("ganache-time-traveler");

const { constants, expectRevert } = require("@openzeppelin/test-helpers");

const { expect } = require("chai");

const NFT1 = artifacts.require("MockNFT1");
const NFT2 = artifacts.require("MockNFT2");
const Vault = artifacts.require("Vault");


contract("Vault", (accounts) => {

    const owner = accounts[0];
    const tester1 = accounts[1];
    const tester2 = accounts[2];

    const CATEGORY_1 = "category1";
    const CATEGORY_2 = "category2";

    this.currentTime = null;

    this.nft1 = null;
    this.nft2 = null;
    this.vault = null;

    beforeEach(async () => {
        this.nft1 = await NFT1.new();
        this.nft2 = await NFT2.new();
        this.vault = await Vault.deployed();
    });

    describe("safeAddAsset", () => {

        beforeEach(async() => {
            snapshotId = (await timeMachine.takeSnapshot())["result"];
        });

        afterEach(async() => {
            await timeMachine.revertToSnapshot(snapshotId);
        });

        it("deploys with owner", async () => {
            assert.equal(owner, await this.vault.owner(), "owner is not deployer");
        });

        it("works when owner adds his assets", async () => {
            // mint 4 TNFT1s to owner
            for (i = 0; i < 4; i++) {
                await this.nft1.mintTo(owner);
            }
            // mint 3 TNFT2s to owner
            for (i = 0; i < 3; i++) {
                await this.nft2.mintTo(owner);
            }
            await this.nft1.approve(this.vault.address, 1, {from: owner});
            await this.nft1.approve(this.vault.address, 2, {from: owner});
            await this.nft1.approve(this.vault.address, 3, {from: owner});
            await this.nft1.approve(this.vault.address, 4, {from: owner});
            await this.nft2.approve(this.vault.address, 1, {from: owner});
            await this.nft2.approve(this.vault.address, 2, {from: owner});
            await this.nft2.approve(this.vault.address, 3, {from: owner});
            expect(await this.vault.totalAssets()).to.be.bignumber.equal("0");
            expect(await this.vault.totalAssetSlots()).to.be.bignumber.equal("0");
            assert.equal(owner, await this.nft1.ownerOf(1));
            assert.equal(owner, await this.nft1.ownerOf(2));
            assert.equal(owner, await this.nft1.ownerOf(3));
            assert.equal(owner, await this.nft1.ownerOf(4));
            assert.equal(owner, await this.nft2.ownerOf(1));
            assert.equal(owner, await this.nft2.ownerOf(2));
            assert.equal(owner, await this.nft2.ownerOf(3));
            await this.vault.safeAddAsset(
                [
                    this.nft1.address, this.nft1.address, this.nft1.address, this.nft1.address,
                    this.nft2.address, this.nft2.address, this.nft2.address
                ],
                [
                    1,2,3,4,
                    1,2,3
                ],
                [
                    CATEGORY_1, CATEGORY_1, CATEGORY_1, CATEGORY_1,
                    CATEGORY_2, CATEGORY_2, CATEGORY_2
                ], { from: owner, gas: 2000000 });
            expect(await this.vault.totalAssets()).to.be.bignumber.equal("7");
            expect(await this.vault.totalAssetSlots()).to.be.bignumber.equal("7");
            assert.equal(this.vault.address, await this.nft1.ownerOf(1));
            assert.equal(this.vault.address, await this.nft1.ownerOf(2));
            assert.equal(this.vault.address, await this.nft1.ownerOf(3));
            assert.equal(this.vault.address, await this.nft1.ownerOf(4));
            assert.equal(this.vault.address, await this.nft2.ownerOf(1));
            assert.equal(this.vault.address, await this.nft2.ownerOf(2));
            assert.equal(this.vault.address, await this.nft2.ownerOf(3));
            // verify each assetInfo
            let assetInfo = await this.vault.assets(0);
            assert.equal(assetInfo.category, CATEGORY_1);
            assert.equal(assetInfo.tokenAddress, this.nft1.address);
            assert.equal(assetInfo.tokenId, 1);
            assetInfo = await this.vault.assets(1);
            assert.equal(assetInfo.category, CATEGORY_1);
            assert.equal(assetInfo.tokenAddress, this.nft1.address);
            assert.equal(assetInfo.tokenId, 2);
            assetInfo = await this.vault.assets(2);
            assert.equal(assetInfo.category, CATEGORY_1);
            assert.equal(assetInfo.tokenAddress, this.nft1.address);
            assert.equal(assetInfo.tokenId, 3);
            assetInfo = await this.vault.assets(3);
            assert.equal(assetInfo.category, CATEGORY_1);
            assert.equal(assetInfo.tokenAddress, this.nft1.address);
            assert.equal(assetInfo.tokenId, 4);
            assetInfo = await this.vault.assets(4);
            assert.equal(assetInfo.category, CATEGORY_2);
            assert.equal(assetInfo.tokenAddress, this.nft2.address);
            assert.equal(assetInfo.tokenId, 1);
            assetInfo = await this.vault.assets(5);
            assert.equal(assetInfo.category, CATEGORY_2);
            assert.equal(assetInfo.tokenAddress, this.nft2.address);
            assert.equal(assetInfo.tokenId, 2);
            assetInfo = await this.vault.assets(6);
            assert.equal(assetInfo.category, CATEGORY_2);
            assert.equal(assetInfo.tokenAddress, this.nft2.address);
            assert.equal(assetInfo.tokenId, 3);
            // cannot add again
            await expectRevert(
                this.vault.safeAddAsset(
                    [
                        this.nft1.address, this.nft1.address, this.nft1.address, this.nft1.address,
                        this.nft2.address, this.nft2.address, this.nft2.address
                    ],
                    [
                        1,2,3,4,
                        1,2,3
                    ],
                    [
                        CATEGORY_1, CATEGORY_1, CATEGORY_1, CATEGORY_1,
                        CATEGORY_2, CATEGORY_2, CATEGORY_2
                    ], { from: owner, gas: 2000000 }),
                "ERC721: transfer of token that is not own",
            );
        });

        it("fails when non-owner adds his assets", async () => {
            // mint 2 TNFT1s to tester1
            for (i = 0; i < 2; i++) {
                await this.nft1.mintTo(tester1);
            }
            // mint 2 TNFT2s to tester1
            for (i = 0; i < 2; i++) {
                await this.nft2.mintTo(tester1);
            }
            await this.nft1.approve(this.vault.address, 1, {from: tester1});
            await this.nft1.approve(this.vault.address, 2, {from: tester1});
            await this.nft2.approve(this.vault.address, 1, {from: tester1});
            await this.nft2.approve(this.vault.address, 2, {from: tester1});
            await expectRevert(
                this.vault.safeAddAsset(
                    [
                        this.nft1.address, this.nft1.address,
                        this.nft2.address, this.nft2.address,
                    ],
                    [
                        1,2,
                        1,2,
                    ],
                    [
                        CATEGORY_1, CATEGORY_1,
                        CATEGORY_2, CATEGORY_2,
                    ], { from: tester1, gas: 2000000 }),
                "Ownable: caller is not the owner.",
            );
        });
    });

    describe("safeTransferAsset", () => {

        beforeEach(async () => {
            snapshotId = (await timeMachine.takeSnapshot())["result"];
            // mint 4 TNFT1s to owner
            for (i = 0; i < 4; i++) {
                await this.nft1.mintTo(tester1);
            }
            // mint 3 TNFT2s to owner
            for (i = 0; i < 3; i++) {
                await this.nft2.mintTo(tester2);
            }
            await this.nft1.transferFrom(tester1, owner, 1, {from: tester1});
            await this.nft1.transferFrom(tester1, owner, 2, {from: tester1});
            await this.nft1.transferFrom(tester1, owner, 3, {from: tester1});
            await this.nft1.transferFrom(tester1, owner, 4, {from: tester1});
            await this.nft2.transferFrom(tester2, owner, 1, {from: tester2});
            await this.nft2.transferFrom(tester2, owner, 2, {from: tester2});
            await this.nft2.transferFrom(tester2, owner, 3, {from: tester2});
            await this.nft1.approve(this.vault.address, 1, {from: owner});
            await this.nft1.approve(this.vault.address, 2, {from: owner});
            await this.nft1.approve(this.vault.address, 3, {from: owner});
            await this.nft1.approve(this.vault.address, 4, {from: owner});
            await this.nft2.approve(this.vault.address, 1, {from: owner});
            await this.nft2.approve(this.vault.address, 2, {from: owner});
            await this.nft2.approve(this.vault.address, 3, {from: owner});
            await this.vault.safeAddAsset(
                [
                    this.nft1.address, this.nft1.address, this.nft1.address, this.nft1.address,
                    this.nft2.address, this.nft2.address, this.nft2.address
                ],
                [
                    1,2,3,4,
                    1,2,3
                ],
                [
                    CATEGORY_1, CATEGORY_1, CATEGORY_1, CATEGORY_1,
                    CATEGORY_2, CATEGORY_2, CATEGORY_2
                ], { from: owner, gas: 2000000 });
        });

        afterEach(async() => {
            await timeMachine.revertToSnapshot(snapshotId);
        });

        it("updates storage correctly", async () => {
            expect(await this.vault.totalAssets()).to.be.bignumber.equal("7");
            expect(await this.vault.totalAssetSlots()).to.be.bignumber.equal("7");
            assert.equal(this.vault.address, await this.nft1.ownerOf(4));
            // remove asset4. asset4 becomes null
            await this.vault.safeTransferAsset(
                [
                    3
                ],
                [
                    tester1
                ], { from: owner, gas: 2000000 });
            // pre-removal  : [1,2,3,4,5,6,7]
            // post-removal : [1,2,3,-,5,6,7]
            expect(await this.vault.totalAssets()).to.be.bignumber.equal("6");
            expect(await this.vault.totalAssetSlots()).to.be.bignumber.equal("7");
            assert.equal(tester1, await this.nft1.ownerOf(4));
            // verify asset4 is null
            let assetInfo4 = await this.vault.assets(3);
            assert.equal(assetInfo4.category, "");
            assert.equal(assetInfo4.tokenAddress, constants.ZERO_ADDRESS);
            assert.equal(assetInfo4.tokenId, "0");
            // remove asset2. asset2 becomes null
            await this.vault.safeTransferAsset(
                [
                    1
                ],
                [
                    tester1
                ], { from: owner, gas: 2000000 });
            // pre-removal  : [1,2,3,-,5,6,7]
            // post-removal : [1,-,3,-,5,6,7]
            expect(await this.vault.totalAssets()).to.be.bignumber.equal("5");
            expect(await this.vault.totalAssetSlots()).to.be.bignumber.equal("7");
            assert.equal(tester1, await this.nft1.ownerOf(2));
            // verify asset2 is null
            let assetInfo2 = await this.vault.assets(1);
            assert.equal(assetInfo2.category, "");
            assert.equal(assetInfo2.tokenAddress, constants.ZERO_ADDRESS);
            assert.equal(assetInfo2.tokenId, "0");
            // add asset2. asset8 becomes asset2
            await this.nft1.transferFrom(tester1, owner, 2, {from: tester1});
            await this.nft1.approve(this.vault.address, 2, {from: owner});
            await this.vault.safeAddAsset(
                [
                    this.nft1.address
                ],
                [
                    2
                ],
                [
                    CATEGORY_1
                ], { from: owner, gas: 2000000 });
            // pre-addition  : [1,-,3,-,5,6,7]
            // post-addition : [1,-,3,-,5,6,7,2]
            expect(await this.vault.totalAssets()).to.be.bignumber.equal("6");
            expect(await this.vault.totalAssetSlots()).to.be.bignumber.equal("8");
            assert.equal(this.vault.address, await this.nft1.ownerOf(2));
            let assetInfo8 = await this.vault.assets(7);
            assert.equal(assetInfo8.category, CATEGORY_1);
            assert.equal(assetInfo8.tokenAddress, this.nft1.address);
            assert.equal(assetInfo8.tokenId, 2);
        });

        it("works when called by owner", async () => {
            expect(await this.vault.totalAssets()).to.be.bignumber.equal("7");
            assert.equal(this.vault.address, await this.nft1.ownerOf(1));
            assert.equal(this.vault.address, await this.nft1.ownerOf(2));
            assert.equal(this.vault.address, await this.nft1.ownerOf(3));
            assert.equal(this.vault.address, await this.nft1.ownerOf(4));
            assert.equal(this.vault.address, await this.nft2.ownerOf(1));
            assert.equal(this.vault.address, await this.nft2.ownerOf(2));
            assert.equal(this.vault.address, await this.nft2.ownerOf(3));
            // mass transfer
            await this.vault.safeTransferAsset(
                [
                    0,1,2,3,
                    4,5,6
                ],
                [
                    tester1, tester1, tester1, tester1,
                    tester2, tester2, tester2
                ], { from: owner, gas: 2000000 });
            expect(await this.vault.totalAssets()).to.be.bignumber.equal("0");
            assert.equal(tester1, await this.nft1.ownerOf(1));
            assert.equal(tester1, await this.nft1.ownerOf(2));
            assert.equal(tester1, await this.nft1.ownerOf(3));
            assert.equal(tester1, await this.nft1.ownerOf(4));
            assert.equal(tester2, await this.nft2.ownerOf(1));
            assert.equal(tester2, await this.nft2.ownerOf(2));
            assert.equal(tester2, await this.nft2.ownerOf(3));
            // cannot mass transfer again
            await expectRevert(
                this.vault.safeTransferAsset(
                    [
                        0,1,2,3,
                        4,5,6
                    ],
                    [
                        tester1, tester1, tester1, tester1,
                        tester2, tester2, tester2
                    ], { from: owner, gas: 2000000 }),
                "{safeTransferAsset} : 404, asset does not exist",
            );
        });

        it("fails when called by non-owner", async () => {
            await expectRevert(
                this.vault.safeTransferAsset(
                    [
                        0,1,2,3,
                        4,5,6
                    ],
                    [
                        tester1, tester1, tester1, tester1,
                        tester2, tester2, tester2
                    ], { from: tester1, gas: 2000000 }),
                "Ownable: caller is not the owner.",
            );
            await expectRevert(
                this.vault.safeTransferAsset(
                    [
                        0,1,2,3,
                        4,5,6
                    ],
                    [
                        tester1, tester1, tester1, tester1,
                        tester2, tester2, tester2
                    ], { from: tester2, gas: 2000000 }),
                "Ownable: caller is not the owner.",
            );
        });

        it("fails when removing non-existent asset", async () => {
            await expectRevert(
                this.vault.safeTransferAsset(
                    [
                        7
                    ],
                    [
                        tester1
                    ], { from: owner, gas: 2000000 }),
                "{safeTransferAsset} : 400, Invalid assetId",
            );
        });

        it("fails when removing already removed asset", async () => {
            // remove asset4. asset4 becomes null
            await this.vault.safeTransferAsset(
                [
                    3
                ],
                [
                    tester1
                ], { from: owner, gas: 2000000 });
            // pre-removal  : [1,2,3,4,5,6,7]
            // post-removal : [1,2,3,-,5,6,7]
            // fails when removing asset4 again
            await expectRevert(
                this.vault.safeTransferAsset(
                    [
                        3
                    ],
                    [
                        tester1
                    ], { from: owner, gas: 2000000 }),
                "{safeTransferAsset} : 404, asset does not exist",
            );
        });
    });

    describe("lockVault", () => {

        beforeEach(async () => {
            snapshotId = (await timeMachine.takeSnapshot())["result"];
        });

        afterEach(async() => {
            await timeMachine.revertToSnapshot(snapshotId);
        });

        it("works when called by owner", async () => {
            await this.vault.lockVault({ from: owner, gas: 50000 });
        });

        it("fails when called more than once", async () => {
            await this.vault.lockVault({ from: owner, gas: 50000 });
            await expectRevert(
                this.vault.lockVault({ from: owner, gas: 50000 }),
                "{lockVault} : app mode is not BOOTSTRAPPED",
            );
        });

        it("fails when called by non-owner", async () => {
            await expectRevert(
                this.vault.lockVault({ from: tester1, gas: 50000 }),
                "Ownable: caller is not the owner.",
            );
        });

        it("prevents addition of assets into vault", async () => {
            // mint 4 TNFT1s to owner
            for (i = 0; i < 4; i++) {
                await this.nft1.mintTo(tester1);
            }
            // mint 3 TNFT2s to owner
            for (i = 0; i < 3; i++) {
                await this.nft2.mintTo(tester2);
            }
            await this.nft1.transferFrom(tester1, owner, 1, {from: tester1});
            await this.nft1.transferFrom(tester1, owner, 2, {from: tester1});
            await this.nft1.transferFrom(tester1, owner, 3, {from: tester1});
            await this.nft1.transferFrom(tester1, owner, 4, {from: tester1});
            await this.nft2.transferFrom(tester2, owner, 1, {from: tester2});
            await this.nft2.transferFrom(tester2, owner, 2, {from: tester2});
            await this.nft2.transferFrom(tester2, owner, 3, {from: tester2});
            await this.nft1.approve(this.vault.address, 1, {from: owner});
            await this.nft1.approve(this.vault.address, 2, {from: owner});
            await this.nft1.approve(this.vault.address, 3, {from: owner});
            await this.nft1.approve(this.vault.address, 4, {from: owner});
            await this.nft2.approve(this.vault.address, 1, {from: owner});
            await this.nft2.approve(this.vault.address, 2, {from: owner});
            await this.nft2.approve(this.vault.address, 3, {from: owner});
            await this.vault.safeAddAsset(
                [
                    this.nft1.address, this.nft1.address, this.nft1.address,
                    this.nft2.address, this.nft2.address
                ],
                [
                    1,2,3,
                    1,2
                ],
                [
                    CATEGORY_1, CATEGORY_1, CATEGORY_1,
                    CATEGORY_2, CATEGORY_2
                ], { from: owner, gas: 2000000 });
            await this.vault.lockVault({ from: owner, gas: 50000 });
            await expectRevert(
                this.vault.safeAddAsset(
                    [
                        this.nft1.address, this.nft2.address
                    ],
                    [
                        4,3
                    ],
                    [
                        CATEGORY_1, CATEGORY_2
                    ], { from: owner, gas: 2000000 }),
                "{safeAddAsset} : app mode is not BOOTSTRAPPED",
            );
        });

        it("prevents transfer of assets from vault", async () => {
            // mint 4 TNFT1s to owner
            for (i = 0; i < 4; i++) {
                await this.nft1.mintTo(tester1);
            }
            // mint 3 TNFT2s to owner
            for (i = 0; i < 3; i++) {
                await this.nft2.mintTo(tester2);
            }
            await this.nft1.transferFrom(tester1, owner, 1, {from: tester1});
            await this.nft1.transferFrom(tester1, owner, 2, {from: tester1});
            await this.nft1.transferFrom(tester1, owner, 3, {from: tester1});
            await this.nft1.transferFrom(tester1, owner, 4, {from: tester1});
            await this.nft2.transferFrom(tester2, owner, 1, {from: tester2});
            await this.nft2.transferFrom(tester2, owner, 2, {from: tester2});
            await this.nft2.transferFrom(tester2, owner, 3, {from: tester2});
            await this.nft1.approve(this.vault.address, 1, {from: owner});
            await this.nft1.approve(this.vault.address, 2, {from: owner});
            await this.nft1.approve(this.vault.address, 3, {from: owner});
            await this.nft1.approve(this.vault.address, 4, {from: owner});
            await this.nft2.approve(this.vault.address, 1, {from: owner});
            await this.nft2.approve(this.vault.address, 2, {from: owner});
            await this.nft2.approve(this.vault.address, 3, {from: owner});
            await this.vault.safeAddAsset(
                [
                    this.nft1.address, this.nft1.address, this.nft1.address, this.nft1.address,
                    this.nft2.address, this.nft2.address, this.nft2.address
                ],
                [
                    1,2,3,4,
                    1,2,3
                ],
                [
                    CATEGORY_1, CATEGORY_1, CATEGORY_1, CATEGORY_1,
                    CATEGORY_2, CATEGORY_2, CATEGORY_2
                ], { from: owner, gas: 2000000 });
            await this.vault.lockVault({ from: owner, gas: 50000 });
            await expectRevert(
                this.vault.safeTransferAsset(
                    [
                        3
                    ],
                    [
                        tester1
                    ], { from: owner, gas: 2000000 }),
                "{safeTransferAsset} : app mode is not BOOTSTRAPPED",
            );
        });

    });

});
