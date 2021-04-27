const timeMachine = require("ganache-time-traveler");

const { constants, expectRevert } = require("@openzeppelin/test-helpers");

const { expect } = require("chai");

const NFT1 = artifacts.require("MockNFT1");
const NFT2 = artifacts.require("MockNFT2");
const NFT3 = artifacts.require("MockNFT3");
const Vault = artifacts.require("SimpleVault");


contract("SimpleVault", (accounts) => {

    const owner = accounts[0];
    const tester1 = accounts[1];
    const tester2 = accounts[2];

    const CATEGORY_1 = "category1";
    const CATEGORY_2 = "category2";
    const CATEGORY_3 = "category3";

    this.nft1 = null;
    this.nft2 = null;
    this.nft3 = null;

    this.vault = null;

    this.snapshotIds = [];

    before(async () => {
        this.nft1 = await NFT1.new();
        this.nft2 = await NFT2.new();
        this.nft3 = await NFT3.new();
        this.vault = await Vault.deployed();
    });

    describe("safeAddAsset", () => {

        before(async () => {
            this.snapshotIds.push((await timeMachine.takeSnapshot())["result"]);
        });

        after(async () => {
            await timeMachine.revertToSnapshot(this.snapshotIds.pop());
        });

        it("[require] - caller needs to be the owner", async () => {
            await expectRevert(
                this.vault.safeAddAsset(
                    [],
                    [],
                    [], { from: tester1, gas: 2000000 }),
                "Ownable: caller is not the owner",
            );
        });

        it("[require] - vault needs to be unlocked", async () => {
            assert.equal(false, await this.vault.locked());
        });

        it("[revert] - when empty tokenAddresses", async () => {
            await expectRevert(
                this.vault.safeAddAsset(
                    [],
                    [],
                    [], { from: owner, gas: 2000000 }),
                "{safeAddAsset} : tokenAddresses cannot be empty"
            );
        });

        it("[revert] - when tokenAddresses and tokenIds lengths are not equal", async () => {
            await expectRevert(
                this.vault.safeAddAsset(
                    [this.nft1.address],
                    [],
                    [CATEGORY_1], { from: owner, gas: 2000000 }),
                "{safeAddAsset} : tokenAddresses and tokenIds lengths are not equal"
            );
        });

        it("[revert] - when tokenAddresses and categories lengths are not equal", async () => {
            await expectRevert(
                this.vault.safeAddAsset(
                    [this.nft1.address],
                    [1],
                    [], { from: owner, gas: 2000000 }),
                "{safeAddAsset} : tokenAddresses and categories lengths are not equal"
            );
        });

        it("[revert] - when invalid tokenAddress", async () => {
            await expectRevert(
                this.vault.safeAddAsset(
                    [constants.ZERO_ADDRESS],
                    [1],
                    [CATEGORY_1], { from: owner, gas: 2000000 }),
                "{safeAddAsset} : invalid tokenAddress"
            );
        });

        it("[revert] - when invalid tokenId", async () => {
            const nftTest = await NFT1.new();
            await nftTest.mintTo(tester1);
            await nftTest.approve(this.vault.address, 1, { from: tester1 });

            await expectRevert(
                this.vault.safeAddAsset(
                    [nftTest.address],
                    [1],
                    [CATEGORY_1], { from: owner, gas: 2000000 }),
                "{safeAddAsset} : invalid tokenId"
            );
            await expectRevert(
                this.vault.safeAddAsset(
                    [nftTest.address],
                    [2],
                    [CATEGORY_1], { from: owner, gas: 2000000 }),
                "ERC721: owner query for nonexistent token"
            );
        });

        it("[success] - supports adding NFT with deprecated onERC721Received()", async () => {
            this.snapshotIds.push((await timeMachine.takeSnapshot())["result"]);
            // mint 1 TNFT3 to owner
            await this.nft3.mintTo(owner);
            await this.nft3.approve(this.vault.address, 1, { from: owner });
            expect(await this.vault.totalAssets()).to.be.bignumber.equal("0");
            expect(await this.vault.totalAssetSlots()).to.be.bignumber.equal("0");
            assert.equal(owner, await this.nft3.ownerOf(1));

            await this.vault.safeAddAsset(
                [
                    this.nft3.address
                ],
                [
                    1
                ],
                [
                    CATEGORY_3
                ], { from: owner, gas: 2000000 });

            expect(await this.vault.totalAssets()).to.be.bignumber.equal("1");
            expect(await this.vault.totalAssetSlots()).to.be.bignumber.equal("1");
            assert.equal(this.vault.address, await this.nft3.ownerOf(1));

            // verify recently added assetInfo
            let assetInfo = await this.vault.assets(0);
            assert.equal(assetInfo.category, CATEGORY_3);
            assert.equal(assetInfo.tokenAddress, this.nft3.address);
            assert.equal(assetInfo.tokenId, 1);
            await timeMachine.revertToSnapshot(this.snapshotIds.pop());
        });

        it("[success] - when owner adds his assets", async () => {
            // mint 4 TNFT1s to owner
            for (i = 0; i < 4; i++) {
                await this.nft1.mintTo(owner);
                await this.nft1.approve(this.vault.address, i + 1, { from: owner });
            }
            // mint 3 TNFT2s to owner
            for (i = 0; i < 3; i++) {
                await this.nft2.mintTo(owner);
                await this.nft2.approve(this.vault.address, i + 1, { from: owner });
            }
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
                    1, 2, 3, 4,
                    1, 2, 3
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
        });

    });

    describe("safeTransferAsset", async () => {

        before(async () => {
            this.snapshotIds.push((await timeMachine.takeSnapshot())["result"]);
        });

        after(async () => {
            await timeMachine.revertToSnapshot(this.snapshotIds.pop());
        });

        it("[require] - caller needs to be the owner", async () => {
            await expectRevert(
                this.vault.safeTransferAsset(
                    [], { from: tester1, gas: 2000000 }),
                "Ownable: caller is not the owner",
            );
        });

        it("[require] - vault needs to be unlocked", async () => {
            assert.equal(false, await this.vault.locked());
        });

        it("[revert] - when empty assetIndices", async () => {
            await expectRevert(
                this.vault.safeTransferAsset(
                    [], { from: owner, gas: 2000000 }),
                "{safeTransferAsset} : assetIndices cannot be empty"
            );
        });

        it("[revert] - when invalid assetIndices", async () => {
            await expectRevert(
                this.vault.safeTransferAsset(
                    [1], { from: owner, gas: 2000000 }),
                "{safeTransferAsset} : 400, Invalid assetIndex"
            );
        });

        it("[success] - works when called by owner", async () => {
            // mint 4 TNFT1s to owner
            for (i = 0; i < 4; i++) {
                await this.nft1.mintTo(owner);
                await this.nft1.approve(this.vault.address, i + 1, { from: owner });
            }
            // mint 3 TNFT2s to owner
            for (i = 0; i < 3; i++) {
                await this.nft2.mintTo(owner);
                await this.nft2.approve(this.vault.address, i + 1, { from: owner });
            }
            await this.vault.safeAddAsset(
                [
                    this.nft1.address, this.nft1.address, this.nft1.address, this.nft1.address,
                    this.nft2.address, this.nft2.address, this.nft2.address
                ],
                [
                    1, 2, 3, 4,
                    1, 2, 3
                ],
                [
                    CATEGORY_1, CATEGORY_1, CATEGORY_1, CATEGORY_1,
                    CATEGORY_2, CATEGORY_2, CATEGORY_2
                ], { from: owner, gas: 2000000 });

            this.snapshotIds.push((await timeMachine.takeSnapshot())["result"]);
            // mass transfer
            await this.vault.safeTransferAsset(
                [
                    0, 1, 2, 3,
                    4, 5, 6
                ], { from: owner, gas: 2000000 });
            expect(await this.vault.totalAssets()).to.be.bignumber.equal("0");
            assert.equal(owner, await this.nft1.ownerOf(1));
            assert.equal(owner, await this.nft1.ownerOf(2));
            assert.equal(owner, await this.nft1.ownerOf(3));
            assert.equal(owner, await this.nft1.ownerOf(4));
            assert.equal(owner, await this.nft2.ownerOf(1));
            assert.equal(owner, await this.nft2.ownerOf(2));
            assert.equal(owner, await this.nft2.ownerOf(3));
            await timeMachine.revertToSnapshot(this.snapshotIds.pop());
        });

        it("[success] - updates storage correctly", async () => {
            // remove asset4. asset4 becomes null
            await this.vault.safeTransferAsset(
                [3], { from: owner, gas: 2000000 });
            // pre-removal  : [1,2,3,4,5,6,7]
            // post-removal : [1,2,3,-,5,6,7]
            expect(await this.vault.totalAssets()).to.be.bignumber.equal("6");
            expect(await this.vault.totalAssetSlots()).to.be.bignumber.equal("7");
            assert.equal(owner, await this.nft1.ownerOf(4));
            // verify asset4 is null
            let assetInfo4 = await this.vault.assets(3);
            assert.equal(assetInfo4.category, "");
            assert.equal(assetInfo4.tokenAddress, constants.ZERO_ADDRESS);
            assert.equal(assetInfo4.tokenId, "0");
            // remove asset2. asset2 becomes null
            await this.vault.safeTransferAsset(
                [1], { from: owner, gas: 2000000 });
            // pre-removal  : [1,2,3,-,5,6,7]
            // post-removal : [1,-,3,-,5,6,7]
            expect(await this.vault.totalAssets()).to.be.bignumber.equal("5");
            expect(await this.vault.totalAssetSlots()).to.be.bignumber.equal("7");
            assert.equal(owner, await this.nft1.ownerOf(2));
            // verify asset2 is null
            let assetInfo2 = await this.vault.assets(1);
            assert.equal(assetInfo2.category, "");
            assert.equal(assetInfo2.tokenAddress, constants.ZERO_ADDRESS);
            assert.equal(assetInfo2.tokenId, "0");
            // add asset2. asset8 becomes asset2
            await this.nft1.approve(this.vault.address, 2, { from: owner });
            await this.vault.safeAddAsset(
                [this.nft1.address],
                [2],
                [CATEGORY_1], { from: owner, gas: 2000000 });
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

        it("[fails] - when transfer already transferred asset", async () => {
            // assets : [1,-,3,-,5,6,7,2]
            await this.vault.safeTransferAsset(
                [0], { from: owner, gas: 2000000 });
            await expectRevert(
                this.vault.safeTransferAsset(
                    [0], { from: owner, gas: 2000000 }),
                "{safeTransferAsset} : 404, asset does not exist",
            );
        });
    });

    describe("lockVault", () => {

        before(async () => {
            this.snapshotIds.push((await timeMachine.takeSnapshot())["result"]);

            // mint 4 TNFT1s to owner
            for (i = 0; i < 4; i++) {
                await this.nft1.mintTo(owner);
                await this.nft1.approve(this.vault.address, i + 1, { from: owner });
            }
            // mint 3 TNFT2s to owner
            for (i = 0; i < 3; i++) {
                await this.nft2.mintTo(owner);
                await this.nft2.approve(this.vault.address, i + 1, { from: owner });
            }

            await this.vault.safeAddAsset(
                [
                    this.nft1.address, this.nft1.address, this.nft1.address, this.nft1.address,
                    this.nft2.address, this.nft2.address
                ],
                [
                    1, 2, 3, 4,
                    1, 2
                ],
                [
                    CATEGORY_1, CATEGORY_1, CATEGORY_1, CATEGORY_1,
                    CATEGORY_2, CATEGORY_2
                ], { from: owner, gas: 2000000 });
        });

        after(async () => {
            await timeMachine.revertToSnapshot(this.snapshotIds.pop());
        });

        it("[require] - caller needs to be the owner", async () => {
            await expectRevert(
                this.vault.lockVault({ from: tester1, gas: 50000 }),
                "Ownable: caller is not the owner",
            );
        });

        it("[require] - vault needs to be unlocked", async () => {
            assert.equal(false, await this.vault.locked());
        });

        it("[success] - when called by owner", async () => {
            await this.vault.lockVault({ from: owner, gas: 50000 });
        });

        it("[fail] - when vault already locked", async () => {
            await expectRevert(
                this.vault.lockVault({ from: owner, gas: 50000 }),
                "{toggleLock} : incorrect value",
            );
        });

        it("[prevent] - when add assets after locking vault", async () => {
            await expectRevert(
                this.vault.safeAddAsset(
                    [this.nft1.address],
                    [1],
                    [CATEGORY_1], { from: owner, gas: 2000000 }),
                "{safeAddAsset} : locked"
            );
        });

        it("[prevent] - when transfer assets after locking vault", async () => {
            await expectRevert(
                this.vault.safeTransferAsset(
                    [0], { from: owner, gas: 2000000 }),
                "{safeTransferAsset} : locked",
            );
        });
    });

    describe("unlockVault", () => {

        before(async () => {
            this.snapshotIds.push((await timeMachine.takeSnapshot())["result"]);

            // mint 4 TNFT1s to owner
            for (i = 0; i < 4; i++) {
                await this.nft1.mintTo(owner);
                await this.nft1.approve(this.vault.address, i + 1, { from: owner });
            }
            // mint 3 TNFT2s to owner
            for (i = 0; i < 3; i++) {
                await this.nft2.mintTo(owner);
                await this.nft2.approve(this.vault.address, i + 1, { from: owner });
            }

            await this.vault.lockVault({ from: owner, gas: 50000 });
        });

        after(async () => {
            await timeMachine.revertToSnapshot(this.snapshotIds.pop());
        });

        it("[require] - caller needs to be the owner", async () => {
            await expectRevert(
                this.vault.unlockVault({ from: tester1, gas: 50000 }),
                "Ownable: caller is not the owner",
            );
        });

        it("[require] - vault needs to be locked", async () => {
            assert.equal(true, await this.vault.locked());
        });

        it("[success] - when called by owner", async () => {
            await this.vault.unlockVault({ from: owner, gas: 50000 });
        });

        it("[fail] - when vault already unlocked", async () => {
            await expectRevert(
                this.vault.unlockVault({ from: owner, gas: 50000 }),
                "{toggleLock} : incorrect value",
            );
        });

        it("[allow] - when add assets after unlocking vault", async () => {
            await this.vault.safeAddAsset(
                [this.nft1.address],
                [1],
                [CATEGORY_1], { from: owner, gas: 2000000 });
        });

        it("[allow] - when transfer assets after unlocking vault", async () => {
            await this.vault.safeTransferAsset(
                [0], { from: owner, gas: 2000000 });
        });
    });

    describe("transferOwnership", () => {

        before(async () => {
            this.snapshotIds.push((await timeMachine.takeSnapshot())["result"]);

            // mint 4 TNFT1s to owner
            for (i = 0; i < 4; i++) {
                await this.nft1.mintTo(owner);
                await this.nft1.approve(this.vault.address, i + 1, { from: owner });
            }
            // mint 3 TNFT2s to owner
            for (i = 0; i < 3; i++) {
                await this.nft2.mintTo(owner);
                await this.nft2.approve(this.vault.address, i + 1, { from: owner });
            }
            await this.vault.safeAddAsset(
                [
                    this.nft1.address, this.nft1.address, this.nft1.address,
                    this.nft2.address, this.nft2.address
                ],
                [
                    1, 2, 3,
                    1, 2
                ],
                [
                    CATEGORY_1, CATEGORY_1, CATEGORY_1,
                    CATEGORY_2, CATEGORY_2
                ], { from: owner, gas: 2000000 });
        });

        after(async () => {
            await timeMachine.revertToSnapshot(this.snapshotIds.pop());
        });

        it("[require] - caller needs to be the owner", async () => {
            await expectRevert(
                this.vault.transferOwnership(tester2, { from: tester1, gas: 2000000 }),
                "Ownable: caller is not the owner",
            );
        });

        it("[revert] - when invalid new owner", async () => {
            await expectRevert(
                this.vault.transferOwnership(constants.ZERO_ADDRESS, { from: owner, gas: 2000000 }),
                "{transferOwnership} : invalid new owner",
            );
        });

        it("[success] - when called by owner", async () => {
            await this.vault.transferOwnership(tester1, { from: owner, gas: 50000 });
            assert.equal(tester1, await this.vault.owner());
        });

        it("[prevent] - add/transfer assets after ownership transfer", async () => {
            // fails when previous owner tries to add assets
            await expectRevert(
                this.vault.safeAddAsset(
                    [this.nft1.address],
                    [1],
                    [CATEGORY_1], { from: owner, gas: 2000000 }),
                "Ownable: caller is not the owner",
            );
            // fails when previous owner tries to remove an asset
            await expectRevert(
                this.vault.safeTransferAsset(
                    [0], { from: owner, gas: 2000000 }),
                "Ownable: caller is not the owner",
            );
        });

        it("[allow] - add/transfer assets with new owner", async () => {
            const nftTest = await NFT1.new();
            await nftTest.mintTo(tester1);
            await nftTest.approve(this.vault.address, 1, { from: tester1 });

            await this.vault.safeAddAsset(
                [nftTest.address],
                [1],
                [CATEGORY_1], { from: tester1, gas: 2000000 });
            await this.vault.safeTransferAsset(
                [0], { from: tester1, gas: 2000000 });
        });
    });

    describe("escapeHatchERC721", () => {

        before(async () => {
            this.snapshotIds.push((await timeMachine.takeSnapshot())["result"]);
            // Mint and send nft to Vault contract address
            for (i = 0; i < 2; i++) {
                await this.nft1.mintTo(owner);
                await this.nft1.approve(this.vault.address, i + 1, { from: owner });
            }
            await this.nft1.transferFrom(owner, this.vault.address, 1, { from: owner });
        });

        after(async () => {
            await timeMachine.revertToSnapshot(this.snapshotIds.pop());
        });

        it("[require] - caller needs to be the owner", async () => {
            await expectRevert(
                this.vault.escapeHatchERC721(this.nft1.address, 1, { from: tester1, gas: 2000000 }),
                "Ownable: caller is not the owner",
            );
        });

        it("[revert] - when invalid tokenAddress", async () => {
            await expectRevert(
                this.vault.escapeHatchERC721(constants.ZERO_ADDRESS, 1, { from: owner, gas: 2000000 }),
                "{escapeHatchERC721} : invalid tokenAddress",
            );
        });

        it("[revert] - when invalid tokenId", async () => {
            await expectRevert(
                this.vault.escapeHatchERC721(this.nft1.address, 2, { from: owner, gas: 2000000 }),
                "{escapeHatchERC721} : invalid tokenId",
            );
        });

        it("[success] - when called by owner", async () => {
            await this.vault.escapeHatchERC721(this.nft1.address, 1, { from: owner, gas: 2000000 });
            assert.equal(owner, await this.nft1.ownerOf(1));
        });
    });

    describe("setDecentralandOperator", () => {

        before(async () => {
            this.snapshotIds.push((await timeMachine.takeSnapshot())["result"]);
            // Mint and send nft to Vault contract address
            for (i = 0; i < 2; i++) {
                await this.nft1.mintTo(owner);
                await this.nft1.approve(this.vault.address, i + 1, { from: owner });
            }
            await this.vault.safeAddAsset(
                [this.nft1.address],
                [1],
                [CATEGORY_1], { from: owner, gas: 2000000 });
        });

        after(async () => {
            await timeMachine.revertToSnapshot(this.snapshotIds.pop());
        });

        it("[require] - caller needs to be the owner", async () => {
            await expectRevert(
                this.vault.setDecentralandOperator(this.nft1.address, tester1, 1, { from: tester1, gas: 2000000 }),
                "Ownable: caller is not the owner",
            );
        });

        it("[revert] - when invalid addresses", async () => {
            await expectRevert(
                this.vault.setDecentralandOperator(constants.ZERO_ADDRESS, tester1, 1, { from: owner, gas: 2000000 }),
                "{setDecentralandOperator} : invalid registryAddress",
            );
            await expectRevert(
                this.vault.setDecentralandOperator(this.nft1.address, constants.ZERO_ADDRESS, 1, { from: owner, gas: 2000000 }),
                "{setDecentralandOperator} : invalid operatorAddress",
            );
        });

        it("[revert] - when invalid assetIndex", async () => {
            await expectRevert(
                this.vault.setDecentralandOperator(this.nft1.address, tester1, 2, { from: owner, gas: 2000000 }),
                "{setDecentralandOperator} : 400, Invalid assetIndex",
            );
        });

        it("[success] - when called by owner", async () => {
            await expectRevert(
                this.vault.setDecentralandOperator(this.nft1.address, owner, 0, { from: owner, gas: 2000000 }),
                "revert"
            );
        });
    });
});
