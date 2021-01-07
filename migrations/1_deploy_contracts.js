/* eslint-disable prefer-const */
const Diamond = artifacts.require("AppDiamond");
const DiamondCutFacet = artifacts.require("DiamondCutFacet");
const DiamondLoupeFacet = artifacts.require("DiamondLoupeFacet");
const OwnershipFacet = artifacts.require("OwnershipFacet");

const VaultFacet = artifacts.require("VaultFacet");

const Token0 = artifacts.require("MockToken0");
const Token0AdminFacet = artifacts.require("Token0AdminFacet");

const SimpleWallet = artifacts.require("MockSimpleWallet");
const SimpleTreasury = artifacts.require("MockSimpleTreasury");
const MarketFacet = artifacts.require("MarketFacet");

const BuyoutFacet = artifacts.require("BuyoutFacet");

const RedeemFacet = artifacts.require("RedeemFacet");

const FacetCutAction = {
    Add: 0,
    Replace: 1,
    Remove: 2
};

function getSelectors (contract) {
    const selectors = contract.abi.reduce((acc, val) => {
        if (val.type === "function") {
            acc.push(val.signature);
            return acc;
        } else {
            return acc;
        }
    }, []);
    return selectors;
}

module.exports = function (deployer, network, accounts) {
    deployer.deploy(VaultFacet);
    deployer.deploy(Token0AdminFacet);
    deployer.deploy(MarketFacet);
    deployer.deploy(BuyoutFacet);
    deployer.deploy(RedeemFacet);

    deployer.deploy(Token0);
    deployer.deploy(SimpleWallet);
    deployer.deploy(SimpleTreasury);

    deployer.deploy(DiamondCutFacet);
    deployer.deploy(DiamondLoupeFacet);
    deployer.deploy(OwnershipFacet).then(() => {
        const diamondCut = [
            [DiamondCutFacet.address, FacetCutAction.Add, getSelectors(DiamondCutFacet)],
            [DiamondLoupeFacet.address, FacetCutAction.Add, getSelectors(DiamondLoupeFacet)],
            [OwnershipFacet.address, FacetCutAction.Add, getSelectors(OwnershipFacet)],
            [VaultFacet.address, FacetCutAction.Add, getSelectors(VaultFacet)],
            [Token0AdminFacet.address, FacetCutAction.Add, getSelectors(Token0AdminFacet)],
            [MarketFacet.address, FacetCutAction.Add, getSelectors(MarketFacet)],
            [BuyoutFacet.address, FacetCutAction.Add, getSelectors(BuyoutFacet)],
            [RedeemFacet.address, FacetCutAction.Add, getSelectors(RedeemFacet)]
        ];
        return deployer.deploy(Diamond, diamondCut, [accounts[0], SimpleTreasury.address]);
    });
};
